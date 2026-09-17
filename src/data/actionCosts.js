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
  promoteUnit: { actionPoints: 1 },
  hireGeneral: { gold: 150, actionPoints: 1 },
  appointGeneral: { actionPoints: 1 },

  embarkUnit: { actionPoints: 1 },
  disembarkUnit: { actionPoints: 1 },
  amphibiousAssault: { actionPoints: 3 },
  navalEngagement: { actionPoints: 2 },
  suppressRebellion: { actionPoints: 2 },

  // A tech's own gold/techPoints cost (src/data/techTree.js) varies per tech; this is just the
  // flat action-point cost every research action shares, matching canResearchTech's own check.
  researchTech: { actionPoints: 2 },
  setResearchFocus: { actionPoints: 1 },
  fundScholars: { gold: 100, actionPoints: 1 },

  // A government reform is deliberately pricier than a policy swap — it's the bigger decision.
  adoptGovernment: { gold: 200, actionPoints: 2 },
  adoptPolicy: { gold: 80, actionPoints: 1 },
  removePolicy: { actionPoints: 1 },

  // Declaring war with a real casus belli (a fabricated claim or organic hostility) costs only
  // action points; without one it costs a real gold premium on top — see GameContext.jsx's
  // DECLARE_WAR for the rest of an unjustified war's cost (global relations, home unrest).
  declareWarJustified: { actionPoints: 2 },
  declareWarUnjustified: { gold: 300, actionPoints: 2 },
  fabricateClaim: { gold: 150, diplomacyPoints: 10, actionPoints: 1 },
  tradeAgreement: { gold: 100, actionPoints: 1 },
  militaryAlliance: { gold: 150, diplomacyPoints: 15, actionPoints: 1 },
  giftBribe: { gold: 100, actionPoints: 1 }
};

// Sue for Peace's gold cost floors here regardless of how war-weary the target is — ending a war
// is never entirely free.
export const SUE_FOR_PEACE_MIN_GOLD = 20;
export const SUE_FOR_PEACE_BASE_GOLD = 200;
// A gift/bribe's flat hostility reduction.
export const GIFT_HOSTILITY_REDUCTION = 15;
// An unjustified war's flat hostility bump applied to every OTHER nation's view of the player —
// the plan's "unjustified wars cost... global relations".
export const UNJUSTIFIED_WAR_GLOBAL_HOSTILITY = 5;
// An unjustified war's flat unrest bump to the aggressor's home region — the plan's "unjustified
// wars cost stability".
export const UNJUSTIFIED_WAR_HOME_UNREST = 20;
// Above this hostility (or an existing trade agreement), a nation is calm enough to ally with.
export const ALLIANCE_HOSTILITY_CEILING = 30;

// Fund Scholars' fixed gold -> techPoints exchange rate.
export const FUND_SCHOLARS_TECHPOINTS = 20;

// Fraction of a disbanded unit's HR cost recovered — never the full amount, or disband/recruit
// would be a free way to reshuffle composition every turn.
export const DISBAND_HR_REFUND_RATIO = 0.5;
