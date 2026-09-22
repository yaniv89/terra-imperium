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
  QUELL_UNREST: 'QUELL_UNREST',
  SETTLE_COLONIZE: 'SETTLE_COLONIZE',
  POPULATION_POLICY: 'POPULATION_POLICY',
  SET_TAX_RATE: 'SET_TAX_RATE',
  CONSTRUCT_WONDER: 'CONSTRUCT_WONDER',

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

  // Government & policies (plan §9).
  ADOPT_GOVERNMENT: 'ADOPT_GOVERNMENT',
  ADOPT_POLICY: 'ADOPT_POLICY',
  REMOVE_POLICY: 'REMOVE_POLICY',

  // Diplomacy tab (plan §8) — casus belli, war/peace lifecycle, and the first tier of agreements.
  DECLARE_WAR: 'DECLARE_WAR',
  FABRICATE_CLAIM: 'FABRICATE_CLAIM',
  SUE_FOR_PEACE: 'SUE_FOR_PEACE',
  TRADE_AGREEMENT: 'TRADE_AGREEMENT',
  MILITARY_ALLIANCE: 'MILITARY_ALLIANCE',
  GIFT_BRIBE: 'GIFT_BRIBE',
  // Espionage/Counter-Intelligence: the plan's statecraft section always named these as a pair
  // ("Espionage as something you do to others; Counter-Intelligence as catching it done to you"),
  // but neither had ever actually been implemented — this ships both together rather than adding a
  // counter-espionage button with no espionage for it to counter.
  ESPIONAGE: 'ESPIONAGE',
  COUNTER_INTELLIGENCE: 'COUNTER_INTELLIGENCE',
  // National Identity (src/data/identity.js) — a separate axis from Government/Policies.
  SHIFT_IDENTITY: 'SHIFT_IDENTITY',
  // Climate/disaster mitigation (Modern age) — see region.climateResilience's comment.
  BUILD_CLIMATE_RESILIENCE: 'BUILD_CLIMATE_RESILIENCE',
  // Cultural Export / soft power (Modern age) — see nation.culturalInfluence's comment.
  CULTURAL_EXPORT: 'CULTURAL_EXPORT',

  // Space Race, orbital layer (plan §10.4 Layer 1).
  LAUNCH_SATELLITE: 'LAUNCH_SATELLITE',
  ASAT_STRIKE: 'ASAT_STRIKE',

  // Space Race, missiles and mission ladder (plan §10.4 Layers 2-3).
  BUILD_MISSILE: 'BUILD_MISSILE',
  MISSILE_STRIKE: 'MISSILE_STRIKE',
  BUILD_ABM_DEFENSE: 'BUILD_ABM_DEFENSE',
  LAUNCH_MISSION: 'LAUNCH_MISSION'
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
