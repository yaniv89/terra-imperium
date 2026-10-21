// src/data/government.js
// Plan §M8.1: the flat 10-type government model is replaced by 5 TYPES (Tribal/Monarchy/Republic/
// Theocracy/Dictatorship), each with a REFORM TIER per age — a nation picks one of 2-3 reforms as it
// reaches each age, and every tier it has picked stays in effect (they stack, they don't replace one
// another). `nation.government = { type, reforms: { [ageId]: reformId } }` replaces the old flat id.
//
// Changing TYPE (CHANGE_GOVERNMENT_TYPE) costs 2 decrees and -2 stability, and resets every reached
// age tier to the new type's first reform choice (resetReformsForType) — the plan's own "a real cost
// of switching, not just a formality". Enacting a REFORM for the current age tier
// (ENACT_GOVERNMENT_REFORM) costs 1 decree and can only be done once per tier (it locks in).
//
// Every reform's `effects` uses the same LEGACY_HOOK vocabulary techs/buildings/traits already do,
// wherever the plan's own described effect maps onto a real, consumed hook. A reform whose plan text
// names a system that doesn't exist yet (raiding/cohesion, combat morale, election-candidate choice,
// trade pact capacity, casus belli, espionage defense) is left with no entry for that part — still
// real flavor and a real age-gated choice, just not a faked modifier.
// The old pool bonuses are now decreePace (decrees come faster), opinion and hrMult (differentiation
// plan KTD5; the old lawCostMult discounts became decreePace too). The estates and
// succession keys (estateLoyalty, estateInfluence, heirClaimBonus, successionLegitimacyPenalty) went
// with those systems (master plan decision 37); a reform that only had them now carries a small
// stability or opinion bonus instead, under the same id so saves keep it.
import { getAgeIndex } from './ages';
import { leansPositive } from './identity';

export const GOVERNMENT_TYPES = {
  // Stone Age villages are Tribal only; Monarchy and Theocracy open with the first cities (stonePhase.js).
  tribal: { id: 'tribal', name: 'Tribal Council', minAgeId: 'stone' },
  monarchy: { id: 'monarchy', name: 'Monarchy', minAgeId: 'stone', minPhase: 'cities' },
  theocracy: { id: 'theocracy', name: 'Theocracy', minAgeId: 'stone', minPhase: 'cities' },
  republic: { id: 'republic', name: 'Republic', minAgeId: 'classical' },
  dictatorship: { id: 'dictatorship', name: 'Dictatorship', minAgeId: 'modern' },
  // Eight-ages plan U55: rule by experts and their machines.
  technocracy: { id: 'technocracy', name: 'Technocracy', minAgeId: 'information', requiresTech: 'science_artificial_intelligence' },
  // Eight-ages plan U69: the firms run the state.
  corporate: { id: 'corporate', name: 'Corporate State', minAgeId: 'future', requiresTech: 'economy_automated_industry' }
};

export const GOVERNMENT_REFORMS = {
  tribal: {
    stone: [
      { id: 'council_of_elders', name: 'Council of Elders', description: 'The elders settle disputes before they spread: -1 unrest.', effects: { stabilityBonus: 1 } },
      { id: 'big_man', name: 'Big Man', description: 'One strong headman leads the clan: +20% manpower.', effects: { hrMult: 0.2 } }
    ],
    bronze: [
      { id: 'chieftaincy', name: 'Chieftaincy', description: 'Raids on enemy land yield double gold; +1 loyalty in every city.', effects: {}, rules: { pillageGoldMult: 1, loyaltyBonus: 1 } },
      { id: 'warrior_council', name: 'Warrior Council', description: '+20% manpower; morale recovers 10% faster.', effects: { hrMult: 0.2, moraleRecovery: 0.1 } }
    ],
    information: [
      { id: 'networked_clans', name: 'Networked Clans', description: 'The clans keep in touch across the land: -1 unrest; +1 loyalty in every city.', effects: { stabilityBonus: 1 }, rules: { loyaltyBonus: 1 } }
    ],
    future: [
      { id: 'kinship_habitats', name: 'Kinship Habitats', description: 'Each clan keeps its own habitat: +2 loyalty in every city; +0.1% pop growth.', effects: { popGrowthBonus: 0.001 }, rules: { loyaltyBonus: 2 } }
    ]
  },
  monarchy: {
    stone: [
      { id: 'city_king', name: 'City-King', description: 'A king rules the city and its fields: +1 loyalty in every city.', effects: {}, rules: { loyaltyBonus: 1 } },
      { id: 'warlord_king', name: 'Warlord King', description: 'A king who won his crown in battle: +25% manpower, +1 unrest.', effects: { hrMult: 0.25, stabilityBonus: -1 } }
    ],
    bronze: [
      { id: 'despotic_rule', name: 'Despotic Rule', description: '+5% manpower, +1 unrest.', effects: { hrMult: 0.05, stabilityBonus: -1 } },
      { id: 'divine_kingship', name: 'Divine Kingship', description: 'The king rules by divine will: -1 unrest.', effects: { stabilityBonus: 1 } }
    ],
    classical: [
      { id: 'feudal_nobility', name: 'Feudal Nobility', description: '+30% manpower.', effects: { hrMult: 0.3 } },
      { id: 'imperial_bureaucracy', name: 'Imperial Bureaucracy', description: '+10 governing capacity; decrees come faster.', effects: { governingCapacity: 10, decreePace: 1 } }
    ],
    kingdoms: [
      { id: 'hereditary_primogeniture', name: 'Hereditary Primogeniture', description: 'A settled royal line: -1 unrest.', effects: { stabilityBonus: 1 } },
      { id: 'elective_monarchy', name: 'Elective Monarchy', description: 'The great houses elect each new king: +2 opinion with every nation.', effects: { opinion: 2 } }
    ],
    gunpowder: [
      { id: 'absolutism', name: 'Absolutism', description: 'Decrees come faster; a firm hand keeps order in the cities.', effects: { decreePace: 1 } },
      { id: 'parliamentary_monarchy', name: 'Parliamentary Monarchy', description: 'Decrees come much faster; +2 opinion with every nation.', effects: { opinion: 2, decreePace: 2 } }
    ],
    modern: [
      { id: 'constitutional_monarchy', name: 'Constitutional Monarchy', description: '+10% tax; a steady throne keeps the realm calm.', effects: { goldMult: 0.1 } },
      { id: 'autocratic_monarchy', name: 'Autocratic Monarchy', description: '+10% manpower, +2 unrest; -20 opinion with democracies.', effects: { hrMult: 0.1, stabilityBonus: -2 } }
    ],
    information: [
      { id: 'ceremonial_crown', name: 'Ceremonial Crown', description: 'The crown reigns and the cabinet rules: -1 unrest; +10% tax.', effects: { stabilityBonus: 1, goldMult: 0.1 } }
    ],
    future: [
      { id: 'heritage_throne', name: 'Heritage Throne', description: 'An old crown over a new world: -1 unrest; +2 opinion with every nation.', effects: { stabilityBonus: 1, opinion: 2 } }
    ]
  },
  theocracy: {
    stone: [
      { id: 'temple_city', name: 'Temple City', description: 'The temple keeps the stores and the calendar: +10% tech point income.', effects: { techPointsMult: 0.1 } }
    ],
    bronze: [
      { id: 'temple_state', name: 'Temple State', description: 'Decrees come faster.', effects: { decreePace: 1 } }
    ],
    classical: [
      { id: 'priest_kings', name: 'Priest-Kings', description: 'Devotion +1/turn (folded into legitimacy gain automatically); -1 unrest.', effects: { stabilityBonus: 1 } },
      { id: 'oracle_council', name: 'Oracle Council', description: '+15% tech point income.', effects: { techPointsMult: 0.15 } }
    ],
    kingdoms: [
      { id: 'holy_order', name: 'Holy Order', description: 'Morale recovers 15% faster; army upkeep -10%.', effects: { moraleRecovery: 0.15 }, rules: { unitUpkeepMult: -0.1 } },
      { id: 'monastic_state', name: 'Monastic State', description: '+20% pop growth; +10% tech point income.', effects: { popGrowthBonus: 0.004, techPointsMult: 0.1 } }
    ],
    gunpowder: [
      { id: 'ecclesiastical_absolutism', name: 'Ecclesiastical Absolutism', description: 'Decrees come faster; -10% stability cost.', effects: { decreePace: 1, stabilityCost: -0.1 } }
    ],
    modern: [
      { id: 'theocratic_republic', name: 'Theocratic Republic', description: 'Faith steadies the realm; secular nations think less of you (-15 opinion).', effects: {} }
    ],
    information: [
      { id: 'broadcast_ministry', name: 'Broadcast Ministry', description: 'Sermons reach every screen: -1 unrest; +2 opinion with every nation.', effects: { stabilityBonus: 1, opinion: 2 } }
    ],
    future: [
      { id: 'orbital_sanctuaries', name: 'Orbital Sanctuaries', description: 'Shrines above the sky: -2 unrest.', effects: { stabilityBonus: 2 } }
    ]
  },
  republic: {
    classical: [
      { id: 'oligarchic_republic', name: 'Oligarchic Republic', description: 'Elections every 8 turns; +2 opinion with every nation.', effects: { opinion: 2 } },
      { id: 'merchant_republic', name: 'Merchant Republic', description: '+25% income; +2 gold per trade pact.', effects: { goldMult: 0.25 }, rules: { tradeGoldPerRoute: 2 } }
    ],
    kingdoms: [
      { id: 'signoria', name: 'Signoria', description: 'The ruler may be re-elected twice; +0.5 tradition/turn.', effects: {} },
      { id: 'maritime_republic', name: 'Maritime Republic', description: '+20% naval morale; -25% ship cost.', effects: {} }
    ],
    gunpowder: [
      { id: 'federal_republic', name: 'Dutch-style Federal Republic', description: '+20 governing capacity; vassals -50% liberty desire.', effects: { governingCapacity: 20 } },
      { id: 'revolutionary_republic', name: 'Revolutionary Republic', description: '+25% manpower; -10 opinion with monarchies.', effects: { hrMult: 0.25 } }
    ],
    modern: [
      { id: 'parliamentary_democracy', name: 'Parliamentary Democracy', description: '+4 opinion with every nation; decrees come faster; a stable, orderly state.', effects: { opinion: 4, decreePace: 1 } },
      { id: 'presidential_republic', name: 'Presidential Republic', description: 'Decrees come faster, +2 opinion with every nation, +5% manpower; a strong elected head of state.', effects: { decreePace: 1, opinion: 2, hrMult: 0.05 } }
    ],
    information: [
      { id: 'digital_democracy', name: 'Digital Democracy', description: 'Citizens vote and petition online: +4 opinion with every nation; -1 unrest.', effects: { opinion: 4, stabilityBonus: 1 } }
    ],
    future: [
      { id: 'direct_democracy', name: 'Direct Democracy', description: 'Every citizen votes on every law: -2 unrest; +2 opinion with every nation.', effects: { stabilityBonus: 2, opinion: 2 } }
    ]
  },
  dictatorship: {
    modern: [
      { id: 'military_junta', name: 'Military Junta', description: '+10% manpower; morale recovers 20% faster; war exhaustion rises 20% slower.', effects: { hrMult: 0.1, moraleRecovery: 0.2 }, rules: { warExhaustionMult: -0.2 } },
      { id: 'one_party_state', name: 'One-Party State', description: 'Decrees come much faster; +3 unrest; secret police (+50% espionage defense).', effects: { decreePace: 2, stabilityBonus: -3 } }
    ],
    information: [
      { id: 'surveillance_state', name: 'Surveillance State', description: 'Cameras on every street: +3 loyalty in every city; +2 unrest.', effects: { stabilityBonus: -2 }, rules: { loyaltyBonus: 3 } }
    ],
    future: [
      { id: 'predictive_policing', name: 'Predictive Policing', description: 'Machines flag dissent before it starts: +4 loyalty in every city; +1 unrest.', effects: { stabilityBonus: -1 }, rules: { loyaltyBonus: 4 } }
    ]
  },
  technocracy: {
    information: [
      { id: 'expert_ministries', name: 'Expert Ministries', description: 'Scientists run the ministries: +15% tech point income; decrees come faster.', effects: { techPointsMult: 0.15, decreePace: 1 } }
    ],
    future: [
      { id: 'ai_stewardship', name: 'AI Stewardship', description: 'Machine minds plan the economy: +20% tech point income; +10% income.', effects: { techPointsMult: 0.2, goldMult: 0.1 } }
    ]
  },
  corporate: {
    future: [
      { id: 'charter_cities', name: 'Charter Cities', description: 'Firms run their own cities: +25% income; +1 unrest.', effects: { goldMult: 0.25, stabilityBonus: -1 } },
      { id: 'shareholder_council', name: 'Shareholder Council', description: 'The board sits as the cabinet: +15% income; decrees come faster.', effects: { goldMult: 0.15, decreePace: 1 } }
    ]
  }
};

export const getGovernmentType = (id) => GOVERNMENT_TYPES[id] || null;

// Theocracy additionally needs the nation to have leaned Religious (plan §M8.3: "Religiosity > 40
// allows Theocracy") — every other type gates on age alone.
const meetsIdentityGate = (typeId, identity) => typeId !== 'theocracy' || leansPositive(identity, 'secularism');

// `phase`: the nation's Stone Age phase (stonePhase.js stonePhaseOf); a village has no use for a crown.
const meetsPhase = (type, phase) => !(type.minPhase && phase === 'village');
// `researched`: the nation's researched tech ids (getResearched), for a type with `requiresTech`.
const meetsTech = (type, researched) => !type.requiresTech || (researched || []).includes(type.requiresTech);
export const getAvailableGovernmentTypes = (ageId, identity, phase = null, researched = []) =>
  Object.values(GOVERNMENT_TYPES).filter((t) => getAgeIndex(t.minAgeId) <= getAgeIndex(ageId) && meetsIdentityGate(t.id, identity) && meetsPhase(t, phase) && meetsTech(t, researched));

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


export const canChangeGovernmentType = (nation, newTypeId, nationAgeId, phase = null, researched = []) => {
  const type = GOVERNMENT_TYPES[newTypeId];
  if (!type || nation?.government?.type === newTypeId) return false;
  if (getAgeIndex(type.minAgeId) > getAgeIndex(nationAgeId) || !meetsPhase(type, phase) || !meetsTech(type, researched)) return false;
  return meetsIdentityGate(newTypeId, nation?.identity);
};

export const canEnactReform = (nation, ageId, reformId, nationAgeId) => {
  const type = nation?.government?.type;
  if (!type) return false;
  if (getAgeIndex(ageId) > getAgeIndex(nationAgeId)) return false;
  if (nation.government.reforms?.[ageId]) return false; // once per tier — it locks in
  return getReformChoices(type, ageId).some((r) => r.id === reformId);
};

// On a type change, every age tier up to (and including) the nation's own age that the NEW type
// actually offers reforms for is filled with that type's first choice (plan: "Earlier-tier slots
// are filled with the first choice") — ages beyond the nation's age stay unset, to be picked later via
// ENACT_GOVERNMENT_REFORM as the nation actually reaches them.
// `picks` ({ [ageId]: reformId }, optional, I140): the player's own choice for a tier, used when it
// names a real reform of that tier; anything else falls back to the first choice.
export const resetReformsForType = (newTypeId, nationAgeId, picks = null) => {
  const reforms = {};
  Object.entries(GOVERNMENT_REFORMS[newTypeId] || {}).forEach(([ageId, choices]) => {
    if (getAgeIndex(ageId) <= getAgeIndex(nationAgeId) && choices.length) {
      reforms[ageId] = choices.some((c) => c.id === picks?.[ageId]) ? picks[ageId] : choices[0].id;
    }
  });
  return reforms;
};

/** The reform tiers a switch to `newTypeId` fills now: [{ ageId, options }] (I140: the player picks). */
export const reformSlotsForType = (newTypeId, nationAgeId) => Object.entries(GOVERNMENT_REFORMS[newTypeId] || {})
  .filter(([ageId, choices]) => getAgeIndex(ageId) <= getAgeIndex(nationAgeId) && choices.length)
  .map(([ageId, options]) => ({ ageId, options }));
