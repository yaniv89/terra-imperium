// src/data/types.js
// Game phase and status enums

export const GamePhases = {
  PRE_STATE: 'PRE_STATE',
  POST_STATE: 'POST_STATE'
};

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
  DECLARE_INDEPENDENCE: 'DECLARE_INDEPENDENCE',
  RESET_GAME: 'RESET_GAME',
  UPDATE_SLIDER: 'UPDATE_SLIDER',
  ADD_LOG: 'ADD_LOG',
  RESOLVE_EVENT: 'RESOLVE_EVENT',

  // Atomic, cost-validated player actions (validated + applied inside the reducer,
  // so double-dispatch / stale-snapshot double-spend is impossible)
  BUY_LAND: 'BUY_LAND',
  ORGANIZE_IMMIGRATION: 'ORGANIZE_IMMIGRATION',
  BUILD_INFRASTRUCTURE: 'BUILD_INFRASTRUCTURE',
  LOBBY_POWERS: 'LOBBY_POWERS',
  TRAIN_UNDERGROUND: 'TRAIN_UNDERGROUND',
  TRAIN_INFANTRY: 'TRAIN_INFANTRY',
  BUILD_TANKS: 'BUILD_TANKS',
  BUILD_JETS: 'BUILD_JETS',
  LAUNCH_PLAYER_INVASION: 'LAUNCH_PLAYER_INVASION',
  COUNTERATTACK: 'COUNTERATTACK',
  AIR_STRIKE: 'AIR_STRIKE',
  FORTIFY: 'FORTIFY',
  DECLARE_WAR_COSTED: 'DECLARE_WAR_COSTED',
  SEEK_PEACE: 'SEEK_PEACE',
  SIGN_TRADE_COSTED: 'SIGN_TRADE_COSTED',
  SIGN_MILITARY_PACT_COSTED: 'SIGN_MILITARY_PACT_COSTED',
  RESEARCH_TECH_COSTED: 'RESEARCH_TECH_COSTED',

  // Covert operations (Phase 5) — gated on tech flags from getTechBonuses
  SABOTAGE_INVASION: 'SABOTAGE_INVASION',
  DESTABILIZE_NATION: 'DESTABILIZE_NATION',
  COVERT_TECH_THEFT: 'COVERT_TECH_THEFT',

  // Tactical battle systems (Phase 8)
  SET_INVASION_APPROACH: 'SET_INVASION_APPROACH',
  SET_INVASION_ORDER: 'SET_INVASION_ORDER',
  COMMISSION_COMMANDER: 'COMMISSION_COMMANDER',
  ASSIGN_COMMANDER: 'ASSIGN_COMMANDER',
  HIRE_MERCENARIES: 'HIRE_MERCENARIES',

  // Comeback mechanics (Phase 10)
  EMERGENCY_INTERVENTION: 'EMERGENCY_INTERVENTION',
  SCORCHED_EARTH_DEFENSE: 'SCORCHED_EARTH_DEFENSE',

  LOAD_GAME: 'LOAD_GAME'
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

export const RegionTypes = {
  CORE: 'core',           // Israeli core territories
  CONTESTED: 'contested', // Gaza, West Bank, Golan
  CAPTURABLE: 'capturable', // Can be captured (Sinai, S.Lebanon)
  FOREIGN: 'foreign'      // Foreign nation territories
};

export const TechCategories = {
  AGRI_ECON: 'agri_econ',
  DEFENSE: 'defense',
  INTEL: 'intel'
};
