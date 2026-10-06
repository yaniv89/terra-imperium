import { getResearched } from '../engine/nationState';
// src/data/laws.js
// Plan §M8.2: laws replace the 8 flat policies (src/data/policies.js, now deleted). Each of 6
// categories holds exactly one law at a time (`nation.laws = { taxation, conscription, religion,
// trade, land, justice }`), rather than a shared slot pool a government's slot count limits — every
// nation always has a law in every category, defaulting to that category's tier-1 (DEFAULT_LAWS).
// Changing a law costs `50 x its tier` ADM (see getLawChangeCost's discounts) and has a cooldown
// (LAW_CHANGE_COOLDOWN_TURNS) before that category can change again.
//
// Tiers within a category aren't a prerequisite chain the way techs are — you can switch straight to
// any tier your tech/identity unlocks, matching a policy swap rather than a research queue. Each
// tier's `effects` uses the same LEGACY_HOOK vocabulary as government reforms. A tier's `rules` are the hooks the tile world's systems read directly (src/engine/lawRules.js:
// loyalty, army upkeep, war exhaustion, trade gold, partners' opinion, raids).
import { TECH_TREE } from './techTree';
import { leansPositive, leansNegative } from './identity';
import { getGovernmentReformEffectSum } from './government';
import { canEnactLaws } from '../engine/authority';

export const LAW_CATEGORIES = {
  taxation: [
    { id: 'tribute', name: 'Tribute', tier: 1, requiresTech: null, description: 'The baseline levy.', effects: {} },
    { id: 'land_tax', name: 'Land Tax', tier: 2, requiresTech: 'economy_minted_coinage', description: '+10% tax income.', effects: { goldMult: 0.1 } },
    { id: 'head_tax', name: 'Head Tax', tier: 3, requiresTech: 'economy_guild_charters', description: '+15% tax income; +1 unrest.', effects: { goldMult: 0.15, stabilityBonus: -1 } },
    { id: 'income_tax', name: 'Income Tax', tier: 4, requiresTech: 'economy_banking_houses', description: '+25% tax income; +0.5 unrest.', effects: { goldMult: 0.25, stabilityBonus: -0.5 } },
    { id: 'progressive_tax', name: 'Progressive Tax', tier: 5, requiresTech: 'economy_industrial_capital', description: '+30% tax income.', effects: { goldMult: 0.3 } }
  ],
  conscription: [
    { id: 'warrior_caste', name: 'Warrior Caste', tier: 1, requiresTech: null, description: 'The baseline levy pool.', effects: {} },
    { id: 'feudal_levy', name: 'Feudal Levy', tier: 2, requiresTech: 'military_feudal_levies', description: '+30% manpower; army upkeep -20%.', effects: { hrMult: 0.3 }, rules: { unitUpkeepMult: -0.2 } },
    { id: 'professional_army', name: 'Professional Army', tier: 3, requiresTech: 'military_standing_armies', description: '-10% manpower; army upkeep +30%; morale recovers 15% faster.', effects: { hrMult: -0.1, moraleRecovery: 0.15 }, rules: { unitUpkeepMult: 0.3 } },
    { id: 'mass_conscription', name: 'Mass Conscription', tier: 4, requiresTech: 'military_mechanized_warfare', description: '+60% manpower; army upkeep -10%; +2 unrest; war exhaustion rises 20% slower.', effects: { hrMult: 0.6, stabilityBonus: -2 }, rules: { unitUpkeepMult: -0.1, warExhaustionMult: -0.2 } },
    { id: 'volunteer_army', name: 'Volunteer Army', tier: 5, requiresTech: 'governance_digital_administration', description: '-20% manpower; army upkeep +50%; morale recovers 20% faster.', effects: { hrMult: -0.2, moraleRecovery: 0.2 }, rules: { unitUpkeepMult: 0.5 } }
  ],
  religion: [
    { id: 'state_cult', name: 'State Cult', tier: 1, requiresTech: null, description: 'The baseline faith.', effects: {} },
    { id: 'established_church', name: 'Established Church', tier: 2, requiresTech: 'science_scholastic_method', description: '-10% stability cost; -1 unrest.', effects: { stabilityCost: -0.1, stabilityBonus: 1 } },
    { id: 'tolerance', name: 'Tolerance', tier: 3, requiresTech: 'governance_constitutional_law', description: '-0.5 unrest; no loyalty penalty for cities of a foreign culture.', effects: { stabilityBonus: 0.5 }, rules: { tolerance: true } },
    { id: 'secularism', name: 'Secularism', tier: 4, requiresTech: 'science_scientific_method', requiresIdentity: { axis: 'secularism', pole: 'negative' }, description: '+10% stability cost.', effects: { stabilityCost: 0.1 } }
  ],
  trade: [
    { id: 'barter', name: 'Barter', tier: 1, requiresTech: null, description: 'The baseline exchange.', effects: {} },
    { id: 'mercantilism', name: 'Mercantilism', tier: 2, requiresTech: 'economy_joint_stock_companies', description: '+20% income; +2 gold per trade pact; trade partners -5 opinion.', effects: { goldMult: 0.2 }, rules: { tradeGoldPerRoute: 2, partnerOpinion: -5 } },
    { id: 'free_trade', name: 'Free Trade', tier: 3, requiresTech: 'economy_global_markets', description: '+30% income; trade partners +15 opinion.', effects: { goldMult: 0.3 }, rules: { partnerOpinion: 15 } },
    { id: 'autarky', name: 'Autarky', tier: 4, requiresTech: 'economy_industrial_capital', description: '-10% income; army upkeep -20%; trade partners -20 opinion.', effects: { goldMult: -0.1 }, rules: { partnerOpinion: -20, unitUpkeepMult: -0.2 } }
  ],
  land: [
    { id: 'communal', name: 'Communal', tier: 1, requiresTech: null, description: '+0.1% pop growth.', effects: { popGrowthBonus: 0.001 } },
    { id: 'manorialism', name: 'Manorialism', tier: 2, requiresTech: 'governance_feudal_charters', description: '-5% income; +1 loyalty in every city.', effects: { goldMult: -0.05 }, rules: { loyaltyBonus: 1 } },
    { id: 'private_property', name: 'Private Property', tier: 3, requiresTech: 'economy_joint_stock_companies', description: '+0.1% pop growth; +15% production.', effects: { popGrowthBonus: 0.001, goldMult: 0.15 } },
    // "+2 unrest for 10 turns after enacting" is a real timed nation.modifiers[] entry — see the
    // COLLECTIVIZATION_UNREST_MODIFIER/COLLECTIVIZATION_UNREST_TURNS constants below and
    // gameReducer.js's CHANGE_LAW case, which is what actually pushes it.
    { id: 'collectivization', name: 'Collectivization', tier: 4, requiresTech: 'economy_industrial_capital', description: '-0.1% pop growth; +25% production; +2 unrest for 10 turns after enacting.', effects: { popGrowthBonus: -0.001, goldMult: 0.25 } }
  ],
  justice: [
    { id: 'customary_law', name: 'Customary Law', tier: 1, requiresTech: null, description: 'The baseline courts.', effects: {} },
    { id: 'codified_law', name: 'Codified Law', tier: 2, requiresTech: 'governance_code_of_laws', description: '+2 loyalty in every city; -0.5 unrest.', effects: { stabilityBonus: 0.5 }, rules: { loyaltyBonus: 2 } },
    { id: 'rule_of_law', name: 'Rule of Law', tier: 3, requiresTech: 'governance_constitutional_law', description: '+4 loyalty in every city; -1 unrest.', effects: { stabilityBonus: 1 }, rules: { loyaltyBonus: 4 } },
    // "-1 stability to enact" is a one-time cost applied directly by gameReducer.js's CHANGE_LAW
    // case (not part of `effects`, which are ongoing per-turn bonuses, not one-shot costs).
    { id: 'martial_law', name: 'Martial Law', tier: 4, requiresTech: null, description: '-20% tax, -1 DIP/turn; -1 stability to enact; +2 unrest; +6 loyalty in every city; war exhaustion rises 20% slower.', effects: { goldMult: -0.2, dipBonus: -1, stabilityBonus: -2 }, rules: { loyaltyBonus: 6, warExhaustionMult: -0.2 } }
  ]
};

export const LAW_CATEGORY_IDS = Object.keys(LAW_CATEGORIES);

export const DEFAULT_LAWS = LAW_CATEGORY_IDS.reduce((acc, category) => {
  acc[category] = LAW_CATEGORIES[category][0].id;
  return acc;
}, {});

export const LAW_CHANGE_COOLDOWN_TURNS = 5;
export const COLLECTIVIZATION_UNREST_MODIFIER = -2; // national.stabilityBonus (negative = +2 unrest)
export const COLLECTIVIZATION_UNREST_TURNS = 10;

export const getLaw = (category, id) => LAW_CATEGORIES[category]?.find((l) => l.id === id) || null;

const checkIdentityGate = (identity, gate) => {
  if (!gate) return true;
  return gate.pole === 'negative' ? leansNegative(identity, gate.axis) : leansPositive(identity, gate.axis);
};

export const canEnactLaw = (state, nationId, category, lawId) => {
  const nation = state.nations?.[nationId];
  const law = getLaw(category, lawId);
  if (!nation || !law || nation.laws?.[category] === lawId) return false;
  if (law.requiresTech) {
    const researched = getResearched(state,nationId).includes(law.requiresTech);
    if (!researched) return false;
  }
  if (!checkIdentityGate(nation.identity, law.requiresIdentity)) return false;
  if (!canEnactLaws(state, nationId)) return false; // authority under AUTHORITY_NO_LAWS (authority.js)
  const cooldownUntil = nation.lawCooldowns?.[category] || 0;
  return (state.turnNumber || 0) >= cooldownUntil;
};

// 50 x tier ADM (plan §M2), discounted by any active lawCostMult reform (Parliamentary Monarchy/
// Democracy) and by identity leaning the "natural" direction for that category (plan §M8.3:
// collectivism discounts Conscription/Land, individualism discounts Taxation/Trade, religiosity
// discounts Religion) — each discount is -25%, stacking additively before the floor at 0.
export const getLawChangeCost = (state, nationId, category, lawId) => {
  const nation = state.nations?.[nationId];
  const law = getLaw(category, lawId);
  if (!nation || !law) return Infinity;
  let mult = 1 + getGovernmentReformEffectSum(nation, 'lawCostMult');
  if (category === 'religion' && leansPositive(nation.identity, 'secularism')) mult -= 0.25;
  if ((category === 'conscription' || category === 'land') && leansPositive(nation.identity, 'collectivism')) mult -= 0.25;
  if ((category === 'taxation' || category === 'trade') && leansNegative(nation.identity, 'collectivism')) mult -= 0.25;
  return Math.max(0, Math.round(50 * law.tier * Math.max(0, mult)));
};

// Referenced by the tech-gating UI/tests the same way buildings.js's canBuildTier callers show a
// greyed-out requirement — kept here so callers don't need to reach into TECH_TREE themselves.
export const getRequiredTechName = (law) => (law.requiresTech ? TECH_TREE[law.requiresTech]?.name : null);
