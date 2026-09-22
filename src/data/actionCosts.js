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
  // Peacefully absorbing a bordering nation whose own grip on its territory has collapsed — no
  // military required, unlike Launch Invasion, so it costs more gold and action points than any
  // other single-region domestic action to compensate.
  settleColonize: { gold: 150, actionPoints: 2 },
  populationPolicy: { gold: 100, actionPoints: 1 },
  // A slider flip, not a purchase — costs only the action point every other domestic decision does.
  setTaxRate: { actionPoints: 1 },
  // The biggest single-purchase cost in the game — a world-unique megaproject, not a
  // one-region improvement.
  constructWonder: { gold: 500, actionPoints: 3 },

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

  // Space Race (plan §10.4) — a satellite is a permanent, ongoing asset, priced well above any
  // single-turn action; an ASAT strike is cheaper than launching a satellite outright (destroying
  // is easier than building) but still a real commitment, on top of the shared debris-level cost.
  launchSatellite: { gold: 400, techPoints: 30, actionPoints: 2 },
  asatStrike: { gold: 250, actionPoints: 2 },

  // Missiles (plan §10.4 Layer 2) — cost scales steeply with range/power; a nuclear warhead is
  // priced well above even an ICBM, matching how consequential building one actually is. The gold
  // is paid up front at build time; MISSILE_STRIKE itself only spends the stockpiled missile and
  // an action point, since the ordnance was already bought.
  buildMissile: {
    tactical: { gold: 150, iron: 20, actionPoints: 1 },
    theatre: { gold: 350, iron: 40, actionPoints: 1 },
    icbm: { gold: 700, iron: 60, oil: 30, actionPoints: 2 },
    nuclear: { gold: 2000, iron: 100, oil: 60, actionPoints: 2 }
  },
  missileStrike: { actionPoints: 2 },
  buildAbmDefense: { gold: 500, actionPoints: 2 },
  // A mission's own gold/techPoints cost (src/data/spaceMissions.js) varies per mission; this is
  // just the flat action-point cost every launch shares, matching researchTech's own pattern.
  launchMission: { actionPoints: 2 },

  // Declaring war with a real casus belli (a fabricated claim or organic hostility) costs only
  // action points; without one it costs a real gold premium on top — see GameContext.jsx's
  // DECLARE_WAR for the rest of an unjustified war's cost (global relations, home unrest).
  declareWarJustified: { actionPoints: 2 },
  declareWarUnjustified: { gold: 300, actionPoints: 2 },
  fabricateClaim: { gold: 150, diplomacyPoints: 10, actionPoints: 1 },
  tradeAgreement: { gold: 100, actionPoints: 1 },
  militaryAlliance: { gold: 150, diplomacyPoints: 15, actionPoints: 1 },
  giftBribe: { gold: 100, actionPoints: 1 },
  // Espionage risks the gold on a coin-flip-ish roll (see ESPIONAGE_SUCCESS_CHANCE, gameReducer.js)
  // — priced like a real covert operation, not a guaranteed purchase of techPoints.
  espionage: { gold: 200, actionPoints: 2 },
  // Counter-Intelligence auto-targets whoever is currently most hostile toward you rather than
  // needing a chosen target, so it's priced like Gift/Bribe (a direct relations action) rather than
  // Espionage's riskier, pricier covert-ops tier.
  counterIntelligence: { gold: 120, actionPoints: 1 },
  // A slider nudge, not a purchase — costs only gold and the action point every other domestic
  // decision does, matching Set Tax Rate's own pricing philosophy.
  shiftIdentity: { gold: 50, actionPoints: 1 },
  // Priced like Build Defenses — a persistent, steadily-improving region investment of the same shape.
  buildClimateResilience: { gold: 90, actionPoints: 1 },
  // Priced like Gift/Bribe — a direct relations action, but empire-wide rather than one target.
  culturalExport: { gold: 130, actionPoints: 1 }
};

// Above this climateResilience level, a region is considered adequately prepared — the same
// mechanical role defenseLevel 3 already plays gating frontier_raiders (src/data/proceduralEvents.js).
export const CLIMATE_RESILIENCE_THRESHOLD = 3;
export const CLIMATE_RESILIENCE_MAX = 10;

// Cultural Export (nation.culturalInfluence): a modest flat accumulation per use, and a small
// hostility reduction applied to EVERY other nation at once (broad soft power, unlike Gift/Bribe's
// single chosen target) — smaller per-nation than Gift/Bribe since it touches everyone.
export const CULTURAL_EXPORT_INFLUENCE_GAIN = 50;
export const CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION = 3;

// Army maintenance (added per user request, "keep things balanced and sane") — recruiting a unit
// (recruitUnit above) was a one-time cost with no ongoing one, so a large standing army cost nothing
// to simply hold once paid for. A flat per-turn gold upkeep per player-owned unit (resolveTurn.js)
// makes army size a real, continuous tradeoff against everything else gold buys, the way a real
// standing army has to be paid to stay fielded, not just raised. ~12 turns of upkeep equals one
// unit's own recruit cost, so a long-lived army is a real ongoing expense, not a rounding error.
export const UNIT_UPKEEP_GOLD_PER_TURN = 5;

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

// Espionage/Counter-Intelligence (see types.js's header comment on the pair). A coin-flip-ish
// success rate keeps espionage a real gamble rather than a guaranteed techPoints purchase; failure
// costs real relations, matching how a botched covert op should sting.
export const ESPIONAGE_SUCCESS_CHANCE = 0.6;
export const ESPIONAGE_TECH_POINTS_STOLEN = 15;
export const ESPIONAGE_FAILURE_HOSTILITY_INCREASE = 15;
// Counter-Intelligence auto-targets whoever is currently most hostile toward the player (no chosen
// target) and both calms them down and rewards the player for catching the plot.
export const COUNTER_INTEL_HOSTILITY_REDUCTION = 20;
export const COUNTER_INTEL_DIPLOMACY_POINTS_REWARD = 10;

// Fraction of a disbanded unit's HR cost recovered — never the full amount, or disband/recruit
// would be a free way to reshuffle composition every turn.
export const DISBAND_HR_REFUND_RATIO = 0.5;

// Settle/Colonize only targets a bordering region whose own control has collapsed below this —
// the "minimally-held adjacent land" the plan describes, in a one-region-per-nation world with no
// literal unowned territory. Above this threshold the nation still has a real grip on its own
// homeland and can only be taken by Launch Invasion.
export const SETTLE_COLONIZE_CONTROL_THRESHOLD = 20;
// Control/unrest a settled region starts at under its new owner — deliberately identical to a won
// Launch Invasion's own numbers (GameContext.jsx), since both are "you now hold contested land".
export const SETTLE_COLONIZE_START_CONTROL = 25;
export const SETTLE_COLONIZE_START_UNREST = 50;

// Population Policy's flat per-use growth rate — compounds each time it's used, so early
// investment pays off more over a long game (guns vs. butter, per the plan).
export const POPULATION_POLICY_GROWTH_RATE = 0.1;

// Every ASAT strike raises the shared world orbital debris level by this much; it decays this
// much per turn at rest (resolveTurn.js) — roughly 8 peaceful turns to fully clear one strike's
// worth of debris, so repeated ASAT use compounds if not given time to settle.
export const ASAT_DEBRIS_RISE = 15;
export const ORBITAL_DEBRIS_DECAY_PER_TURN = 2;
