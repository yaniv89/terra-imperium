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
