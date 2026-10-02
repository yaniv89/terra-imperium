// src/data/nations.js
// Behavioral archetypes for AI nations (aiLogic.js branches on these). Every field here is
// actually read somewhere — no "declared but never consumed" tuning knobs. warRollMult and
// bandwagonMult were previously declared but unread (a stale claim in this same comment) until
// Task 23's war-declaration AI (aiLogic.js's shouldDeclareWar) gave them a real consumer.
//
//   attrition   - baseline: no multipliers beyond the defaults below
//   blitz       - attacks quickly and often once at war
//   opportunist - more likely to pile on when a rival is already fighting
//   cautious    - grows its economy faster, rarely initiates war on its own
//
// The remaining five complete plan §8.5's six named archetypes (Opportunist above is the sixth):
//   conqueror    - aggressive expansionist, hunts weak neighbors
//   zealot       - even more aggressive, ideologically driven, fights regardless of odds
//   isolationist - almost never initiates or joins a war
//   defender     - only fights when directly threatened; otherwise builds up at home
//   merchant     - prioritizes trade over conquest, rarely initiates
export const DOCTRINES = {
  attrition: { warRollMult: 1.0, economyGrowthMult: 1.0, bandwagonMult: 1.0 },
  blitz: { warRollMult: 1.5, economyGrowthMult: 1.0, bandwagonMult: 1.0 },
  opportunist: { warRollMult: 0.8, economyGrowthMult: 1.0, bandwagonMult: 1.8 },
  cautious: { warRollMult: 0.3, economyGrowthMult: 1.25, bandwagonMult: 1.0 },
  conqueror: { warRollMult: 2.0, economyGrowthMult: 0.9, bandwagonMult: 1.0 },
  zealot: { warRollMult: 2.5, economyGrowthMult: 0.8, bandwagonMult: 1.5 },
  isolationist: { warRollMult: 0.02, economyGrowthMult: 1.3, bandwagonMult: 0.1 },
  defender: { warRollMult: 0.1, economyGrowthMult: 1.15, bandwagonMult: 0.3 },
  merchant: { warRollMult: 0.15, economyGrowthMult: 1.3, bandwagonMult: 0.5 }
};

export const DOCTRINE_IDS = Object.keys(DOCTRINES);

// The archetypes that pursue territory rather than grinding down an army when they go to war —
// read by src/engine/diplomacy.js's assignDefaultWarGoal.
export const CAPTURE_PREFERRING_DOCTRINES = ['blitz', 'opportunist', 'conqueror', 'zealot'];

// Plan §M16: "doctrine drives building priorities... law preferences... tech bias." Building
// category and tech category are consumed by the AI decision loop; laws, governments and reforms
// by doctrine are DOCTRINE_LAWS / DOCTRINE_GOVERNMENT / DOCTRINE_REFORMS below (plan C4.5). Each list is a full priority ordering — the AI decision loop (src/engine/aiEconomy.js)
// walks it and takes the first affordable, unlocked option, so an entry late in the list still gets
// built/researched eventually, just after the doctrine's preferred ones.
export const DOCTRINE_BUILDING_PRIORITY = {
  attrition: ['military', 'defense', 'food', 'economy', 'science', 'industry', 'culture', 'naval', 'logistics'],
  blitz: ['military', 'logistics', 'defense', 'economy', 'food', 'science', 'industry', 'culture', 'naval'],
  opportunist: ['economy', 'military', 'naval', 'defense', 'food', 'science', 'industry', 'culture', 'logistics'],
  cautious: ['defense', 'food', 'economy', 'science', 'military', 'industry', 'culture', 'naval', 'logistics'],
  conqueror: ['military', 'defense', 'logistics', 'economy', 'food', 'science', 'industry', 'culture', 'naval'],
  zealot: ['culture', 'military', 'defense', 'food', 'economy', 'science', 'industry', 'naval', 'logistics'],
  isolationist: ['food', 'science', 'defense', 'economy', 'culture', 'military', 'industry', 'naval', 'logistics'],
  defender: ['defense', 'food', 'military', 'economy', 'science', 'industry', 'culture', 'naval', 'logistics'],
  merchant: ['economy', 'naval', 'food', 'science', 'defense', 'military', 'industry', 'culture', 'logistics']
};

// Plan C4.5 (plans/civ-map-rework.md): the doctrine picks the government, the laws and the
// reforms (src/engine/aiEconomy.js). Each list is a preference order; the first entry the nation
// may take wins, and a category or age with no preference falls back to the highest tier the
// nation can enact (laws) or the first choice (reforms).
export const DOCTRINE_GOVERNMENT = {
  attrition: ['monarchy', 'republic'],
  blitz: ['monarchy', 'dictatorship'],
  opportunist: ['republic', 'monarchy'],
  cautious: ['republic', 'monarchy'],
  conqueror: ['monarchy', 'dictatorship'],
  zealot: ['theocracy', 'monarchy'],
  isolationist: ['monarchy', 'theocracy'],
  defender: ['republic', 'monarchy'],
  merchant: ['republic', 'monarchy']
};
export const DOCTRINE_LAWS = {
  attrition: { conscription: ['feudal_levy', 'mass_conscription'], justice: ['rule_of_law', 'codified_law'] },
  blitz: { conscription: ['professional_army', 'mass_conscription', 'feudal_levy'], justice: ['martial_law', 'codified_law'] },
  opportunist: { trade: ['free_trade', 'mercantilism'], conscription: ['professional_army', 'feudal_levy'] },
  cautious: { justice: ['rule_of_law', 'codified_law'], religion: ['tolerance', 'established_church'], conscription: ['feudal_levy'] },
  conqueror: { conscription: ['mass_conscription', 'professional_army', 'feudal_levy'], justice: ['martial_law', 'codified_law'], taxation: ['head_tax', 'income_tax', 'progressive_tax', 'land_tax'] },
  zealot: { religion: ['established_church'], conscription: ['mass_conscription', 'feudal_levy'], justice: ['martial_law', 'codified_law'] },
  isolationist: { trade: ['autarky', 'barter'], justice: ['rule_of_law', 'codified_law'], religion: ['tolerance', 'established_church'] },
  defender: { justice: ['rule_of_law', 'codified_law'], conscription: ['feudal_levy', 'mass_conscription'], religion: ['tolerance'] },
  merchant: { trade: ['free_trade', 'mercantilism'], taxation: ['progressive_tax', 'income_tax', 'land_tax'], land: ['private_property'] }
};
export const DOCTRINE_REFORMS = {
  attrition: ['feudal_nobility', 'imperial_bureaucracy', 'hereditary_primogeniture', 'parliamentary_monarchy', 'constitutional_monarchy'],
  blitz: ['warrior_council', 'despotic_rule', 'feudal_nobility', 'absolutism', 'autocratic_monarchy', 'military_junta'],
  opportunist: ['merchant_republic', 'oligarchic_republic', 'imperial_bureaucracy', 'parliamentary_monarchy'],
  cautious: ['imperial_bureaucracy', 'hereditary_primogeniture', 'parliamentary_monarchy', 'constitutional_monarchy', 'parliamentary_democracy'],
  conqueror: ['warrior_council', 'despotic_rule', 'feudal_nobility', 'absolutism', 'autocratic_monarchy', 'military_junta', 'revolutionary_republic'],
  zealot: ['divine_kingship', 'temple_state', 'priest_kings', 'holy_order', 'ecclesiastical_absolutism', 'theocratic_republic'],
  isolationist: ['chieftaincy', 'imperial_bureaucracy', 'hereditary_primogeniture', 'absolutism', 'constitutional_monarchy'],
  defender: ['imperial_bureaucracy', 'hereditary_primogeniture', 'parliamentary_monarchy', 'constitutional_monarchy', 'federal_republic'],
  merchant: ['merchant_republic', 'signoria', 'maritime_republic', 'federal_republic', 'parliamentary_monarchy']
};

// Plan C9: the wonders a doctrine reaches for first (src/engine/aiProduction.js); any other
// wonder a city may start comes after, in data order.
export const DOCTRINE_WONDERS = {
  attrition: ['great_wall', 'arsenal', 'great_pyramids', 'forbidden_city'],
  blitz: ['great_wall', 'arsenal', 'colosseum', 'atomic_research_center'],
  opportunist: ['lighthouse', 'grand_bazaar', 'international_exchange', 'colosseum'],
  cautious: ['great_pyramids', 'great_library', 'royal_observatory', 'palace_of_versailles'],
  conqueror: ['colosseum', 'arsenal', 'great_wall', 'forbidden_city', 'atomic_research_center'],
  zealot: ['great_cathedral', 'great_pyramids', 'colosseum', 'forbidden_city'],
  isolationist: ['great_wall', 'hanging_gardens', 'royal_observatory', 'space_program'],
  defender: ['great_wall', 'great_pyramids', 'arsenal', 'palace_of_versailles'],
  merchant: ['lighthouse', 'grand_bazaar', 'international_exchange', 'great_library']
};

export const DOCTRINE_TECH_CATEGORY_PRIORITY = {
  attrition: ['military', 'infrastructure', 'economy', 'governance', 'science'],
  blitz: ['military', 'infrastructure', 'governance', 'economy', 'science'],
  opportunist: ['economy', 'military', 'infrastructure', 'governance', 'science'],
  cautious: ['governance', 'economy', 'infrastructure', 'science', 'military'],
  conqueror: ['military', 'governance', 'infrastructure', 'economy', 'science'],
  zealot: ['governance', 'military', 'science', 'economy', 'infrastructure'],
  isolationist: ['science', 'economy', 'infrastructure', 'governance', 'military'],
  defender: ['military', 'infrastructure', 'governance', 'economy', 'science'],
  merchant: ['economy', 'infrastructure', 'science', 'governance', 'military']
};

// Plan §M16: "doctrine is assigned by culture group + starting size, replacing hash % 9." Each
// culture group (src/data/names.js's own already-scope-trimmed 8-pool-plus-generic set — reused
// directly rather than inventing a second, parallel taxonomy) gets a short, flavor-appropriate pool
// instead of the full 9; 'generic' keeps the full spread, since that's the catch-all for every
// nation outside the curated pools. Starting size folds in as a coarse bucket mixed into the hash
// input (worldNations.js's doctrineForCountry), so two nations in the same culture group but very
// different sizes don't always land on the same doctrine.
export const DOCTRINE_BY_CULTURE_GROUP = {
  western_european: ['merchant', 'cautious', 'defender'],
  southern_european: ['merchant', 'opportunist', 'zealot'],
  slavic_eastern_european: ['conqueror', 'attrition', 'defender'],
  mena: ['zealot', 'conqueror', 'merchant'],
  east_asian: ['cautious', 'isolationist', 'attrition'],
  south_asian: ['defender', 'cautious', 'merchant'],
  sub_saharan_african: ['opportunist', 'attrition', 'blitz'],
  latin_american: ['opportunist', 'merchant', 'cautious'],
  generic: DOCTRINE_IDS
};
