// src/data/government.js
// Plan §M8.1: the flat 10-type government model is replaced by 5 TYPES (Tribal/Monarchy/Republic/
// Theocracy/Dictatorship), each with a REFORM TIER per age — a nation picks one of 2-3 reforms as it
// reaches each age, and every tier it has picked stays in effect (they stack, they don't replace one
// another). `nation.government = { type, reforms: { [ageId]: reformId } }` replaces the old flat id.
//
// Changing TYPE (CHANGE_GOVERNMENT_TYPE) costs 300 ADM and -2 stability, and resets every reached
// age tier to the new type's first reform choice (resetReformsForType) — the plan's own "a real cost
// of switching, not just a formality". Enacting a REFORM for the current age tier
// (ENACT_GOVERNMENT_REFORM) costs 100 ADM and can only be done once per tier (it locks in).
//
// Every reform's `effects` uses the same LEGACY_HOOK vocabulary techs/buildings/traits already do,
// wherever the plan's own described effect maps onto a real, consumed hook. A reform whose plan text
// names a system that doesn't exist yet (raiding/cohesion, estate loyalty/influence, combat morale,
// election-candidate choice, trade pact capacity, casus belli, espionage defense) is left with no
// entry for that part — still real flavor and a real age-gated choice, just not a faked modifier.
// Two reforms use raw (non-LEGACY_HOOK) keys consumed directly by name rather than through the
// modifier engine, because they aren't economic multipliers: `heirClaimBonus`/
// `successionLegitimacyPenalty` (read by src/engine/succession.js) and `lawCostMult` (read by
// src/data/laws.js's getLawChangeCost) — see getGovernmentReformEffectSum below.
import { getAgeIndex } from './ages';
import { leansPositive } from './identity';

export const GOVERNMENT_TYPES = {
  tribal: { id: 'tribal', name: 'Tribal Council', minAgeId: 'bronze' },
  monarchy: { id: 'monarchy', name: 'Monarchy', minAgeId: 'bronze' },
  theocracy: { id: 'theocracy', name: 'Theocracy', minAgeId: 'bronze' },
  republic: { id: 'republic', name: 'Republic', minAgeId: 'classical' },
  dictatorship: { id: 'dictatorship', name: 'Dictatorship', minAgeId: 'modern' }
};

export const GOVERNMENT_REFORMS = {
  tribal: {
    bronze: [
      { id: 'chieftaincy', name: 'Chieftaincy', description: 'Raid neighboring lands for gold and build cohesion (not yet a mechanic).', effects: {} },
      { id: 'warrior_council', name: 'Warrior Council', description: '+20% manpower, +10% land morale (combat bonus arrives with M14).', effects: { hrMult: 0.2 } }
    ]
  },
  monarchy: {
    bronze: [
      { id: 'despotic_rule', name: 'Despotic Rule', description: '+1 MIL/turn, +1 unrest.', effects: { milBonus: 1, stabilityBonus: -1 } },
      { id: 'divine_kingship', name: 'Divine Kingship', description: 'Halves legitimacy decay (not yet a mechanic); clergy +10 loyalty (Estates, M9).', effects: {} }
    ],
    classical: [
      { id: 'feudal_nobility', name: 'Feudal Nobility', description: '+30% manpower; nobility influence +10 (Estates, M9).', effects: { hrMult: 0.3 } },
      { id: 'imperial_bureaucracy', name: 'Imperial Bureaucracy', description: '+10 governing capacity, +1 ADM/turn.', effects: { governingCapacity: 10, admBonus: 1 } }
    ],
    kingdoms: [
      { id: 'hereditary_primogeniture', name: 'Hereditary Primogeniture', description: '+20 heir claim, sharply reducing succession-crisis risk.', effects: { heirClaimBonus: 20 } },
      { id: 'elective_monarchy', name: 'Elective Monarchy', description: 'Choose the next ruler from three candidates (not yet a mechanic); the transition costs -10 legitimacy.', effects: { successionLegitimacyPenalty: 10 } }
    ],
    gunpowder: [
      { id: 'absolutism', name: 'Absolutism', description: '"Harsh Treatment" unrest-suppression action (not yet wired); +1 ADM; estate influence -10 (M9).', effects: { admBonus: 1 } },
      { id: 'parliamentary_monarchy', name: 'Parliamentary Monarchy', description: 'Law changes cost 50% less ADM; +1 DIP; burghers +10 loyalty (M9).', effects: { dipBonus: 1, lawCostMult: -0.5 } }
    ],
    modern: [
      { id: 'constitutional_monarchy', name: 'Constitutional Monarchy', description: '+1 stability floor (not yet wired as a floor); +10% tax.', effects: { goldMult: 0.1 } },
      { id: 'autocratic_monarchy', name: 'Autocratic Monarchy', description: '+2 MIL/turn, +2 unrest; -20 opinion with democracies (M12).', effects: { milBonus: 2, stabilityBonus: -2 } }
    ]
  },
  theocracy: {
    bronze: [
      { id: 'temple_state', name: 'Temple State', description: '+1 ADM; clergy influence +15 (Estates, M9).', effects: { admBonus: 1 } }
    ],
    classical: [
      { id: 'priest_kings', name: 'Priest-Kings', description: 'Devotion +1/turn (folded into legitimacy gain automatically); -1 unrest.', effects: { stabilityBonus: 1 } },
      { id: 'oracle_council', name: 'Oracle Council', description: '+15% tech point income.', effects: { techPointsMult: 0.15 } }
    ],
    kingdoms: [
      { id: 'holy_order', name: 'Holy Order', description: '+15% land morale (combat, M14); a Crusade casus belli vs other culture groups (M12).', effects: {} },
      { id: 'monastic_state', name: 'Monastic State', description: '+20% pop growth; +10% tech point income.', effects: { popGrowthBonus: 0.004, techPointsMult: 0.1 } }
    ],
    gunpowder: [
      { id: 'ecclesiastical_absolutism', name: 'Ecclesiastical Absolutism', description: '+1 ADM; -10% stability cost.', effects: { admBonus: 1, stabilityCost: -0.1 } }
    ],
    modern: [
      { id: 'theocratic_republic', name: 'Theocratic Republic', description: '+1 stability floor (not yet wired); -15 opinion from secular nations (M12).', effects: {} }
    ]
  },
  republic: {
    classical: [
      { id: 'oligarchic_republic', name: 'Oligarchic Republic', description: 'Elections every 8 turns; +1 DIP.', effects: { dipBonus: 1 } },
      { id: 'merchant_republic', name: 'Merchant Republic', description: '+25% trade income; +1 trade pact capacity (M12); burghers influence +15 (M9).', effects: { goldMult: 0.25 } }
    ],
    kingdoms: [
      { id: 'signoria', name: 'Signoria', description: 'Ruler re-electable twice (not yet a distinct mechanic); +0.5 tradition/turn.', effects: {} },
      { id: 'maritime_republic', name: 'Maritime Republic', description: '+20% naval morale (combat, M14); -25% ship cost (per-unit-type recruit cost, M14).', effects: {} }
    ],
    gunpowder: [
      { id: 'federal_republic', name: 'Dutch-style Federal Republic', description: '+20 governing capacity; vassals -50% liberty desire (M12).', effects: { governingCapacity: 20 } },
      { id: 'revolutionary_republic', name: 'Revolutionary Republic', description: '+20% manpower, +1 MIL; -10 opinion with monarchies (M12).', effects: { hrMult: 0.2, milBonus: 1 } }
    ],
    modern: [
      { id: 'parliamentary_democracy', name: 'Parliamentary Democracy', description: '+2 DIP; law changes cost 25% less ADM; +1 stability floor (not yet wired).', effects: { dipBonus: 2, lawCostMult: -0.25 } },
      { id: 'presidential_republic', name: 'Presidential Republic', description: '+1 ADM/DIP/MIL; elections every 4 turns (not yet a distinct mechanic).', effects: { admBonus: 1, dipBonus: 1, milBonus: 1 } }
    ]
  },
  dictatorship: {
    modern: [
      { id: 'military_junta', name: 'Military Junta', description: '+2 MIL; +20% land morale (combat, M14); -1 stability floor (not yet wired).', effects: { milBonus: 2 } },
      { id: 'one_party_state', name: 'One-Party State', description: '+2 ADM; -50% estate influence (M9); +3 unrest; secret police (+50% espionage defense, M12).', effects: { admBonus: 2, stabilityBonus: -3 } }
    ]
  }
};

export const getGovernmentType = (id) => GOVERNMENT_TYPES[id] || null;

// Theocracy additionally needs the nation to have leaned Religious (plan §M8.3: "Religiosity > 40
// allows Theocracy") — every other type gates on age alone.
const meetsIdentityGate = (typeId, identity) => typeId !== 'theocracy' || leansPositive(identity, 'secularism');

export const getAvailableGovernmentTypes = (ageId, identity) =>
  Object.values(GOVERNMENT_TYPES).filter((t) => getAgeIndex(t.minAgeId) <= getAgeIndex(ageId) && meetsIdentityGate(t.id, identity));

export const getReformChoices = (typeId, ageId) => GOVERNMENT_REFORMS[typeId]?.[ageId] || [];

// Every reform tier the nation has actually reached and picked (earlier tiers keep contributing
// once a later one is chosen — see this file's header comment on why they stack).
export const getActiveReforms = (nation) => {
  const type = nation?.government?.type;
  const reforms = nation?.government?.reforms;
  if (!type || !reforms) return [];
  return Object.entries(reforms)
    .map(([ageId, reformId]) => GOVERNMENT_REFORMS[type]?.[ageId]?.find((r) => r.id === reformId))
    .filter(Boolean);
};

// Sums a RAW (non-LEGACY_HOOK) numeric effect field across every active reform — for the handful of
// reform effects that aren't economic modifiers (heirClaimBonus/successionLegitimacyPenalty, read by
// succession.js; lawCostMult, read by laws.js).
export const getGovernmentReformEffectSum = (nation, key) =>
  getActiveReforms(nation).reduce((sum, reform) => sum + (reform.effects?.[key] || 0), 0);

export const canChangeGovernmentType = (nation, newTypeId, calendarAgeId) => {
  const type = GOVERNMENT_TYPES[newTypeId];
  if (!type || nation?.government?.type === newTypeId) return false;
  if (getAgeIndex(type.minAgeId) > getAgeIndex(calendarAgeId)) return false;
  return meetsIdentityGate(newTypeId, nation?.identity);
};

export const canEnactReform = (nation, ageId, reformId, calendarAgeId) => {
  const type = nation?.government?.type;
  if (!type) return false;
  if (getAgeIndex(ageId) > getAgeIndex(calendarAgeId)) return false;
  if (nation.government.reforms?.[ageId]) return false; // once per tier — it locks in
  return getReformChoices(type, ageId).some((r) => r.id === reformId);
};

// On a type change, every age tier up to (and including) the calendar age that the NEW type
// actually offers reforms for is filled with that type's first choice (plan: "Earlier-tier slots
// are filled with the first choice") — ages beyond the calendar stay unset, to be picked later via
// ENACT_GOVERNMENT_REFORM as the nation actually reaches them.
export const resetReformsForType = (newTypeId, calendarAgeId) => {
  const reforms = {};
  Object.entries(GOVERNMENT_REFORMS[newTypeId] || {}).forEach(([ageId, choices]) => {
    if (getAgeIndex(ageId) <= getAgeIndex(calendarAgeId) && choices.length) reforms[ageId] = choices[0].id;
  });
  return reforms;
};
