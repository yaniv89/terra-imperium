// src/data/types.js
// Core enums shared across engine, reducer and UI.

export const GameStatus = {
  ACTIVE: 'ACTIVE',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT'
};

export const RelationStatus = {
  WAR: 'War',
  HOSTILE: 'Hostile',
  COLD_PEACE: 'Cold Peace',
  NEUTRAL: 'Neutral',
  FRIENDLY: 'Friendly',
  ALLIED: 'Allied'
};

export const ActionTypes = {
  ADVANCE_TURN: 'ADVANCE_TURN',
  FAST_FORWARD: 'FAST_FORWARD',
  RESET_GAME: 'RESET_GAME',
  ADD_LOG: 'ADD_LOG',
  RESOLVE_EVENT: 'RESOLVE_EVENT',
  LOAD_GAME: 'LOAD_GAME',

  // Domestic tab (plan §5) — atomic, cost-validated player actions.
  GAIN_CONTROL: 'GAIN_CONTROL',
  BUILD_INFRASTRUCTURE: 'BUILD_INFRASTRUCTURE',
  BUILD_DEFENSES: 'BUILD_DEFENSES',
  CONSTRUCT_BUILDING: 'CONSTRUCT_BUILDING',
  DEVELOP_RESOURCE_SITE: 'DEVELOP_RESOURCE_SITE',
  // Province development (plan §M5) — see src/engine/development.js. Distinct from
  // DEVELOP_RESOURCE_SITE above, which is about extraction deposits, not tax/production/manpower.
  DEVELOP_PROVINCE: 'DEVELOP_PROVINCE',
  QUELL_UNREST: 'QUELL_UNREST',
  SETTLE_COLONIZE: 'SETTLE_COLONIZE',
  POPULATION_POLICY: 'POPULATION_POLICY',
  SET_TAX_RATE: 'SET_TAX_RATE',
  // Great Projects (plan §M10) replace the old flat, empire-wide CONSTRUCT_WONDER.
  START_GREAT_PROJECT: 'START_GREAT_PROJECT',
  UPGRADE_GREAT_PROJECT: 'UPGRADE_GREAT_PROJECT',

  // Military tab (plan §7) — per-region armies.
  RECRUIT_UNIT: 'RECRUIT_UNIT',
  DISBAND_UNIT: 'DISBAND_UNIT',
  MOVE_ARMY: 'MOVE_ARMY',
  LAUNCH_INVASION: 'LAUNCH_INVASION',
  PROMOTE_UNIT: 'PROMOTE_UNIT',
  HIRE_GENERAL: 'HIRE_GENERAL',
  APPOINT_GENERAL: 'APPOINT_GENERAL',

  // Navies and amphibious invasion (plan §7.5).
  EMBARK_UNIT: 'EMBARK_UNIT',
  DISEMBARK_UNIT: 'DISEMBARK_UNIT',
  AMPHIBIOUS_ASSAULT: 'AMPHIBIOUS_ASSAULT',
  NAVAL_ENGAGEMENT: 'NAVAL_ENGAGEMENT',

  // Rebellion (plan §9) — fighting off a spawned rebel army in one of the player's own regions.
  SUPPRESS_REBELLION: 'SUPPRESS_REBELLION',

  // Research tab (plan) — Set Focus/Fund Scholars feed techPoints, Research Tech spends them.
  RESEARCH_TECH: 'RESEARCH_TECH',
  SET_RESEARCH_FOCUS: 'SET_RESEARCH_FOCUS',
  FUND_SCHOLARS: 'FUND_SCHOLARS',

  // Government reforms & laws (plan §M8; replaces the old flat ADOPT_GOVERNMENT/ADOPT_POLICY/
  // REMOVE_POLICY trio).
  CHANGE_GOVERNMENT_TYPE: 'CHANGE_GOVERNMENT_TYPE',
  ENACT_GOVERNMENT_REFORM: 'ENACT_GOVERNMENT_REFORM',
  CHANGE_LAW: 'CHANGE_LAW',

  // Estates (plan §M9) — crown land interactions and privilege grant/revoke. Clergy Tithe/Nobility
  // Raise Levies are 2 of the plan's 3 "estate asks"; Burghers' Guild Loan needs 0%-interest loans
  // (M11), so it's deferred rather than faked as an identical gold grant.
  SEIZE_LAND: 'SEIZE_LAND',
  SELL_LAND: 'SELL_LAND',
  GRANT_ESTATE_PRIVILEGE: 'GRANT_ESTATE_PRIVILEGE',
  REVOKE_ESTATE_PRIVILEGE: 'REVOKE_ESTATE_PRIVILEGE',
  CLERGY_TITHE: 'CLERGY_TITHE',
  NOBILITY_LEVIES: 'NOBILITY_LEVIES',

  // Diplomacy tab (plan §8) — casus belli, war/peace lifecycle, and the first tier of agreements.
  DECLARE_WAR: 'DECLARE_WAR',
  FABRICATE_CLAIM: 'FABRICATE_CLAIM',
  SUE_FOR_PEACE: 'SUE_FOR_PEACE',
  // Plan §M13: negotiated peace with real terms, replacing SUE_FOR_PEACE's implicit white peace
  // for any war the player is winning enough to actually demand something in. SUE_FOR_PEACE itself
  // is kept as a white-peace alias (see gameReducer.js's own case) rather than removed outright.
  OFFER_PEACE: 'OFFER_PEACE',
  ACCEPT_PENDING_PEACE: 'ACCEPT_PENDING_PEACE',
  REJECT_PENDING_PEACE: 'REJECT_PENDING_PEACE',
  TRADE_AGREEMENT: 'TRADE_AGREEMENT',
  MILITARY_ALLIANCE: 'MILITARY_ALLIANCE',
  GIFT_BRIBE: 'GIFT_BRIBE',
  // Espionage/Counter-Intelligence: the plan's statecraft section always named these as a pair
  // ("Espionage as something you do to others; Counter-Intelligence as catching it done to you"),
  // but neither had ever actually been implemented — this ships both together rather than adding a
  // counter-espionage button with no espionage for it to counter.
  ESPIONAGE: 'ESPIONAGE',
  COUNTER_INTELLIGENCE: 'COUNTER_INTELLIGENCE',

  // Diplomacy overhaul (plan §M12) — rivals, royal marriages, alliance lifecycle, diplomats, AE-
  // driven coalitions (aiLogic.js/expansion.js), and the vassal lifecycle (nation.vassals finally
  // gets a real writer). Truces are enforced inside declareWar itself (diplomacy.js), not a
  // separate action. Casus belli TYPES (Claim/Reconquest/Conquest/Humiliate/...) and their peace-
  // cost effects are M13 work (peace deals don't exist yet) — only the existing claim/hostility CB
  // gate is in scope here.
  RIVAL_NATION: 'RIVAL_NATION',
  UNRIVAL_NATION: 'UNRIVAL_NATION',
  PROPOSE_MARRIAGE: 'PROPOSE_MARRIAGE',
  BREAK_ALLIANCE: 'BREAK_ALLIANCE',
  INSULT: 'INSULT',
  ASSIGN_DIPLOMAT: 'ASSIGN_DIPLOMAT',
  RECALL_DIPLOMAT: 'RECALL_DIPLOMAT',
  VASSALIZE: 'VASSALIZE',
  ANNEX_VASSAL: 'ANNEX_VASSAL',
  RELEASE_VASSAL: 'RELEASE_VASSAL',
  // National Identity (src/data/identity.js) — a separate axis from Government/Laws.
  SHIFT_IDENTITY: 'SHIFT_IDENTITY',
  // Climate/disaster mitigation (Modern age) — see region.climateResilience's comment.
  BUILD_CLIMATE_RESILIENCE: 'BUILD_CLIMATE_RESILIENCE',
  // Cultural Export / soft power (Modern age) — see nation.culturalInfluence's comment.
  CULTURAL_EXPORT: 'CULTURAL_EXPORT',
  // Rulers, heirs, advisors (plan §M3) — see src/engine/succession.js.
  HIRE_ADVISOR: 'HIRE_ADVISOR',
  // Stability, legitimacy, prestige, overextension (plan §M4) — see src/engine/nationalPower.js.
  INCREASE_STABILITY: 'INCREASE_STABILITY',

  // Space Race, orbital layer (plan §10.4 Layer 1).
  LAUNCH_SATELLITE: 'LAUNCH_SATELLITE',
  ASAT_STRIKE: 'ASAT_STRIKE',

  // Space Race, missiles and mission ladder (plan §10.4 Layers 2-3).
  BUILD_MISSILE: 'BUILD_MISSILE',
  MISSILE_STRIKE: 'MISSILE_STRIKE',
  BUILD_ABM_DEFENSE: 'BUILD_ABM_DEFENSE',
  LAUNCH_MISSION: 'LAUNCH_MISSION',

  // Economy overhaul (plan §M11) — the maintenance slider is adjustable any time, no cooldown
  // (unlike Set Tax Rate); loans require the Banking Houses tech (src/engine/economy.js).
  SET_ARMY_MAINTENANCE: 'SET_ARMY_MAINTENANCE',
  SET_NAVY_MAINTENANCE: 'SET_NAVY_MAINTENANCE',
  REQUEST_LOAN: 'REQUEST_LOAN',
  REPAY_LOAN: 'REPAY_LOAN',
  // Fusion Grid national decision (plan §M11 resource sinks): the plan's own literal Megafactory/
  // Fusion Research Complex building tiers were never built in M6 (no Future-age building line
  // exists), so this ships as a standalone action against a helium3 stockpile instead of a building
  // upkeep — see actionCosts.js's FUSION_GRID_* constants for the honest-adaptation note.
  ACTIVATE_FUSION_GRID: 'ACTIVATE_FUSION_GRID',

  // Crises & defeat (plan §M15) — dynamic capital and a vassal's own path out of subjection. Civil
  // war, disasters, and defeat itself have no player-initiated action of their own: they're
  // engine-driven consequences resolved in resolveTurn.js (src/engine/civilWar.js, disasters.js).
  MOVE_CAPITAL: 'MOVE_CAPITAL',
  DECLARE_INDEPENDENCE: 'DECLARE_INDEPENDENCE'
};

export const LogTypes = {
  ACTION: 'action',
  EVENT: 'event',
  COMBAT: 'combat',
  MILESTONE: 'milestone',
  CRISIS: 'crisis',
  TECH: 'tech',
  DIPLOMACY: 'diplomacy',
  AI: 'ai'
};

// The five research lines (plan: "Research tab"). Tech content per age is authored in a later
// phase — this enum exists now so the (currently empty) tech tree has somewhere to file into.
export const TechCategories = {
  MILITARY: 'military',
  ECONOMY: 'economy',
  INFRASTRUCTURE: 'infrastructure',
  GOVERNANCE: 'governance',
  SCIENCE: 'science'
};
