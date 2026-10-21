// src/data/rulerVirtues.js
// The Virtue tree (plans/RULER-PLAN.md 4.4, differentiation plan U11): five branches, six tiers.
// A tier opens with the nation's own research age (KTD1: tier t opens at age index
// round((t - 1) x (ages - 1) / 5), so one tier an age over six ages) and needs the tier before it
// in the same branch. Tier VI is a capstone: one per ruler. Costs 1, 1, 1, 2, 2, 3 (10 a branch).
// `effects` are modifier-sheet lines in the short hook names (modifiers/registry.js LEGACY_HOOK);
// `rules` are read straight by the systems that own them, summed with the laws' rules
// (engine/lawRules.js lawRulesOf), so every consumer serves the player and the AI alike:
//   rulerOpinion       opinion of this nation in every other nation (opinion.js)
//   warlikeOpinion     opinion of this nation in every nation that borders it (opinion.js)
//   theocracyOpinion   opinion of this nation in every theocracy (opinion.js)
//   marriageOpinionMult  royal marriage opinion x (1 + this) (opinion.js)
//   battleMoraleLoss   battle-start morale losses x (1 + this), at least -0.75 (battleInputs.js)
//   generalMartial     + Martial for every general of the nation (data/generals.js generalsWithCommand)
//   siegeDamage        walls battered x (1 + this) (sieges.js)
//   battleWarScore     war score from won battles x (1 + this) (battleOutcome.js)
//   battleXpMult       XP of won battles x (1 + this) (battleOutcome.js)
//   aeMult             aggressive expansion from conquest x (1 + this) (conquest.js)
//   aeDecayMult        AE against this nation fades x (1 + this) faster (expansion.js)
//   conqueredLoyaltyMult  the conquered-city loyalty penalty x (1 + this) (loyalty.js)
//   buildingCostMult, settlerCostMult, wonderCostMult  city production costs (world/cities.js)
//   productionMult, scienceMult, cultureMult  every city's yields (world/cities.js)
//   capitalScience, capitalCulture  flat on the capital (world/cities.js)
//   boostMult          map research boosts worth x (1 + this) (boosts.js)
//   diffusionMult      the share of known holders of a tech x (1 + this) (techDiffusion.js)
//   tradePacts         + trade pact capacity (diplomacy.js)
//   peaceScore         + to the AI's acceptance of this nation's peace offers (peace.js)
//   indepJoinMult      independents join after JOIN_TURNS x (1 - this) (indepPolicy.js)
//   warStability       stability when this nation declares a war (diplomacy.js declareWar)
//   legitimacy         + legitimacy a turn (nationalPower.js)
//   culturePressure    this nation's culture pressure x (1 + this) (loyalty.js)
//   authority          + authority (authority.js)
//   loyaltyBonus, warExhaustionMult  as the laws' rules (lawRules.js)
import { RULER_START } from './rulers';

export const BRANCHES = ['conqueror', 'builder', 'sage', 'diplomat', 'prophet'];
export const BRANCH_LABELS = { conqueror: 'Conqueror', builder: 'Builder', sage: 'Sage', diplomat: 'Diplomat', prophet: 'Prophet' };
export const TIER_COSTS = [1, 1, 1, 2, 2, 3];
export const TIERS = TIER_COSTS.length;
export const CAPSTONE_TIER = TIERS;

const v = (id, name, branch, tier, text, { effects = {}, rules = {}, drawback = null } = {}) =>
  ({ id, name, branch, tier, cost: TIER_COSTS[tier - 1], text, drawback, effects, rules });

export const VIRTUES = Object.fromEntries([
  v('warlord', 'Warlord', 'conqueror', 1, '+10% manpower', { effects: { hrMult: 0.1 }, rules: { warlikeOpinion: -5 }, drawback: 'Neighbours: -5 opinion' }),
  v('ironDiscipline', 'Iron Discipline', 'conqueror', 2, 'Battle-start morale losses -20%, morale recovery +20%', { effects: { moraleRecovery: 0.2 }, rules: { battleMoraleLoss: -0.2 } }),
  v('siegeLord', 'Siege Lord', 'conqueror', 3, 'Sieges batter walls 20% faster', { rules: { siegeDamage: 0.2 } }),
  v('terrorOfTheField', 'Terror of the Field', 'conqueror', 4, 'War score from battles +20%, XP from won battles +25%', { rules: { battleWarScore: 0.2, battleXpMult: 0.25, aeMult: 0.1 }, drawback: 'Aggressive expansion from conquest +10%' }),
  v('grandStrategist', 'Grand Strategist', 'conqueror', 5, 'Supply range +2, attrition -20%', { effects: { supplyRange: 2, attrition: -0.2 } }),
  v('conquerorsPeace', "Conqueror's Peace", 'conqueror', 6, 'Conquered cities resent you half as much, aggressive expansion -25%', { effects: { stabilityBonus: -1 }, rules: { conqueredLoyaltyMult: -0.5, aeMult: -0.25 }, drawback: 'Stability -1' }),

  v('founder', 'Founder', 'builder', 1, 'Settlers cost 5% less', { rules: { settlerCostMult: -0.05 } }),
  v('masterBuilder', 'Master Builder', 'builder', 2, 'Buildings cost 10% less', { rules: { buildingCostMult: -0.1 } }),
  v('surveyor', 'Surveyor', 'builder', 3, '+5 governing capacity', { effects: { governingCapacity: 5 } }),
  v('granaries', 'Granaries', 'builder', 4, 'Population growth +1', { effects: { popGrowthBonus: 1 } }),
  v('engineerKing', 'Engineer-King', 'builder', 5, 'Wonders cost 15% less', { rules: { wonderCostMult: -0.15 } }),
  v('builderOfAges', 'Builder of Ages', 'builder', 6, '+10% production in every city', { effects: { milBonus: -1 }, rules: { productionMult: 0.1 }, drawback: 'Military power -1 a turn' }),

  v('scribe', 'Scribe', 'sage', 1, '+5% science', { rules: { scienceMult: 0.05 } }),
  v('patronOfLearning', 'Patron of Learning', 'sage', 2, 'Research boosts from the map worth 10% more', { rules: { boostMult: 0.1 } }),
  v('royalLibrary', 'Royal Library', 'sage', 3, 'The capital +2 science and +1 culture', { rules: { capitalScience: 2, capitalCulture: 1 } }),
  v('philosopher', 'Philosopher', 'sage', 4, 'Research cost -8%', { effects: { researchCost: -0.08 } }),
  v('academy', 'Academy', 'sage', 5, 'Techs spread from neighbours 25% more', { rules: { diffusionMult: 0.25 } }),
  v('enlightened', 'Enlightened', 'sage', 6, '+10% science, +15% culture', { effects: { hrMult: -0.1 }, rules: { scienceMult: 0.1, cultureMult: 0.15 }, drawback: 'Manpower -10%' }),

  v('envoy', 'Envoy', 'diplomat', 1, '+5 opinion of you everywhere', { rules: { rulerOpinion: 5 } }),
  v('merchantPrince', 'Merchant Prince', 'diplomat', 2, '+1 trade pact, +5% gold', { effects: { goldMult: 0.05 }, rules: { tradePacts: 1 } }),
  v('peacemaker', 'Peacemaker', 'diplomat', 3, 'Your peace offers need 10 less war score', { rules: { peaceScore: 10 } }),
  v('matchmaker', 'Matchmaker', 'diplomat', 4, 'Royal marriages count half again, +5 opinion of you everywhere', { rules: { marriageOpinionMult: 0.5, rulerOpinion: 5 } }),
  v('greatGame', 'Great Game', 'diplomat', 5, 'Aggressive expansion against you fades 25% faster', { rules: { aeDecayMult: 0.25 } }),
  v('arbiterOfNations', 'Arbiter of Nations', 'diplomat', 6, '+10 opinion of you everywhere, independents join you 25% sooner', { rules: { rulerOpinion: 10, indepJoinMult: 0.25, warStability: -1 }, drawback: 'Declaring a war costs 1 stability' }),

  v('anointed', 'Anointed', 'prophet', 1, '+0.2 legitimacy a turn', { rules: { legitimacy: 0.2 } }),
  v('beloved', 'Beloved', 'prophet', 2, 'Stability +1', { effects: { stabilityBonus: 1 } }),
  v('cultOfTheRuler', 'Cult of the Ruler', 'prophet', 3, '+5 loyalty in every city', { rules: { loyaltyBonus: 5 } }),
  v('unifier', 'Unifier', 'prophet', 4, 'Your culture presses 15% harder', { rules: { culturePressure: 0.15 } }),
  v('divineMandate', 'Divine Mandate', 'prophet', 5, 'War exhaustion rises 20% slower, stability costs 15% less', { effects: { stabilityCost: -0.15 }, rules: { warExhaustionMult: -0.2 } }),
  v('livingGod', 'Living God', 'prophet', 6, '+10 authority', { rules: { authority: 10, theocracyOpinion: -10 }, drawback: 'Other theocracies: -10 opinion' })
].map((x) => [x.id, x]));

/** The virtue of `branch` at `tier` (1-based). */
export const virtueAt = (branch, tier) => Object.values(VIRTUES).find((x) => x.branch === branch && x.tier === tier) || null;

/** The age index at which `tier` opens, over `ageCount` ages (KTD1: never an age id). */
export const tierAgeIndex = (tier, ageCount) => (ageCount <= 1 ? 0 : Math.round(((tier - 1) * (ageCount - 1)) / (TIERS - 1)));

// How an AI ruler grows (RULER-PLAN 5), by doctrine (data/nations.js DOCTRINES): branches and
// attributes first in this order, then the rest in their usual order.
export const DOCTRINE_RULER_PLAN = {
  conqueror: { branches: ['conqueror', 'prophet', 'builder'], attributes: ['mil', 'cmd', 'adm'] },
  blitz: { branches: ['conqueror', 'prophet', 'builder'], attributes: ['mil', 'cmd', 'adm'] },
  zealot: { branches: ['conqueror', 'prophet', 'builder'], attributes: ['mil', 'cmd', 'adm'] },
  opportunist: { branches: ['conqueror', 'diplomat', 'builder'], attributes: ['mil', 'dip', 'cmd'] },
  merchant: { branches: ['diplomat', 'builder', 'sage'], attributes: ['dip', 'adm', 'lrn'] },
  cautious: { branches: ['builder', 'prophet', 'sage'], attributes: ['adm', 'maj', 'cmd'] },
  defender: { branches: ['builder', 'prophet', 'sage'], attributes: ['adm', 'maj', 'cmd'] },
  isolationist: { branches: ['sage', 'builder', 'prophet'], attributes: ['lrn', 'adm', 'maj'] },
  attrition: { branches: ['builder', 'conqueror', 'sage'], attributes: ['adm', 'mil', 'lrn'] }
};

// The attributes' own rules (RULER-PLAN 3, U5 deferred the hooks past authority to U11):
//   DIP  +1 opinion per level above 3        CMD  battle-start morale losses -8% a level,
//   MAJ  +1 loyalty and +0.05 legitimacy          +1 Martial per 3 levels
//   LRN  +2% science and culture a level     (MIL's manpower and CMD's morale recovery are sheet
//                                             lines: modifiers/sources.js)
export const ATTRIBUTE_RULES = {
  dipOpinionAbove: 3,
  cmdMoraleLoss: -0.08, cmdMartialEvery: 3,
  lrnScience: 0.02, lrnCulture: 0.02,
  majLoyalty: 1, majLegitimacy: 0.05
};
export const MORALE_LOSS_FLOOR = -0.75;

const cache = new WeakMap();
/** A ruler's rules: its attributes' and its virtues' (see the header), summed. */
export const rulerRules = (ruler) => {
  if (!ruler) return {};
  const hit = cache.get(ruler);
  if (hit) return hit;
  const A = ATTRIBUTE_RULES;
  const out = {
    rulerOpinion: Math.max(0, (ruler.dip ?? RULER_START.dip) - A.dipOpinionAbove),
    battleMoraleLoss: A.cmdMoraleLoss * (ruler.cmd || 0),
    generalMartial: Math.floor((ruler.cmd || 0) / A.cmdMartialEvery),
    scienceMult: A.lrnScience * (ruler.lrn || 0),
    cultureMult: A.lrnCulture * (ruler.lrn || 0),
    loyaltyBonus: A.majLoyalty * (ruler.maj || 0),
    legitimacy: A.majLegitimacy * (ruler.maj || 0)
  };
  (ruler.traits || []).forEach((id) => Object.entries(VIRTUES[id]?.rules || {}).forEach(([k, x]) => { out[k] = (out[k] || 0) + x; }));
  out.battleMoraleLoss = Math.max(MORALE_LOSS_FLOOR, out.battleMoraleLoss);
  Object.keys(out).forEach((k) => { if (!out[k]) delete out[k]; }); // a starting ruler adds no rule at all
  cache.set(ruler, out);
  return out;
};
