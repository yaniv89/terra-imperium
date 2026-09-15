// src/data/actionCosts.js
// Single source of truth for player-action costs, shared by the reducer (enforcement)
// and the panels (display). Keeping one copy prevents the UI and the rules from drifting.

export const ACTION_COSTS = {
  buyLand: { money: 3000, actionPoints: 1 },
  immigrationPreState: { money: 5000, diplomacyPoints: 5, actionPoints: 1 },
  immigrationPostState: { money: 10000, diplomacyPoints: 10, actionPoints: 1 },
  buildInfrastructure: { money: 5000, actionPoints: 1 },
  lobbyPowers: { money: 3000, actionPoints: 1 },

  trainUnderground: { money: 3000, manpower: 500, actionPoints: 1 },
  trainInfantry: { money: 8000, manpower: 1000, actionPoints: 1 },
  buildTanks: { money: 20000, actionPoints: 1 },
  buildJets: { money: 30000, techPoints: 10, actionPoints: 1 },
  launchInvasion: { money: 50000, manpower: 5000, actionPoints: 3 },
  counterattack: { money: 10000, actionPoints: 2 },
  airStrike: { money: 20000, actionPoints: 2 },
  fortify: { money: 8000, actionPoints: 1 },

  declareWar: { diplomacyPoints: 20 },
  seekPeace: { money: 20000, diplomacyPoints: 30, actionPoints: 2 },
  signTrade: { diplomacyPoints: 15, actionPoints: 1 },
  militaryPact: { diplomacyPoints: 40, money: 50000, actionPoints: 2 },

  // Covert operations (require the corresponding intel tech researched — see TechPanel).
  sabotageInvasion: { diplomacyPoints: 15, actionPoints: 1 },
  destabilizeNation: { diplomacyPoints: 30, money: 20000, actionPoints: 2 },
  covertTechTheft: { diplomacyPoints: 40, actionPoints: 2 },

  // Tactical battle systems (Phase 8)
  commissionCommander: { money: 30000, diplomacyPoints: 15, actionPoints: 1 },
  hireMercenaries: { money: 25000, actionPoints: 1 },

  researchTechActionPoints: 2
};
