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

// Plan §M16: "doctrine drives building priorities... law preferences... tech bias." Laws/reforms are
// left as a documented scope trim (no AI reform/law-change decision exists yet — see aiEconomy.js's
// own header); building category and tech category are the two the AI decision loop actually
// consumes. Each list is a full priority ordering — the AI decision loop (src/engine/aiEconomy.js)
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
