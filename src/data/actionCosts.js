// src/data/actionCosts.js
// Single source of truth for player-action costs, shared by the reducer (enforcement) and the
// panels (display). Keeping one copy prevents the UI and the rules from drifting.
//
// Calibrated against the new economy: a fresh nation starts with 500 gold and 100 HR, and a
// mid-size nation earns roughly 100-600 gold/turn (see build-world-regions.mjs's log-scaled
// gdp/population -> gold/hr formulas) — costs in the tens-to-low-hundreds keep every action
// affordable within a few turns without being free.

export const ACTION_COSTS = {
  gainControl: { gold: 40, actionPoints: 1 },
  buildInfrastructure: { gold: 80, actionPoints: 1 },
  buildDefenses: { gold: 60, actionPoints: 1 },
  constructBuilding: { gold: 100, actionPoints: 1 },
  developResourceSite: { gold: 120, actionPoints: 1 },
  quellUnrest: { gold: 50, actionPoints: 1 },

  recruitUnit: { gold: 60, hr: 100, actionPoints: 1 },
  moveArmy: { actionPoints: 1 },
  launchInvasion: { actionPoints: 2 },

  researchTechActionPoints: 2
};

// Fraction of a disbanded unit's HR cost recovered — never the full amount, or disband/recruit
// would be a free way to reshuffle composition every turn.
export const DISBAND_HR_REFUND_RATIO = 0.5;
