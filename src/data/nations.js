// src/data/nations.js
// Behavioral archetypes for AI nations (aiLogic.js branches on these). Every field here is
// actually read somewhere — no "declared but never consumed" tuning knobs.
//   attrition  - baseline: no multipliers beyond the defaults below
//   blitz      - attacks quickly and often once at war
//   opportunist- more likely to pile on when a rival is already fighting
//   cautious   - grows its economy faster, rarely initiates war on its own
export const DOCTRINES = {
  attrition: { warRollMult: 1.0, economyGrowthMult: 1.0, bandwagonMult: 1.0 },
  blitz: { warRollMult: 1.5, economyGrowthMult: 1.0, bandwagonMult: 1.0 },
  opportunist: { warRollMult: 0.8, economyGrowthMult: 1.0, bandwagonMult: 1.8 },
  cautious: { warRollMult: 0.3, economyGrowthMult: 1.25, bandwagonMult: 1.0 }
};
