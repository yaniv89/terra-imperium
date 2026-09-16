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

// The five research lines (plan: "Research tab"). Tech content per age is authored in a later
// phase — this enum exists now so the (currently empty) tech tree has somewhere to file into.
export const TechCategories = {
  MILITARY: 'military',
  ECONOMY: 'economy',
  INFRASTRUCTURE: 'infrastructure',
  GOVERNANCE: 'governance',
  SCIENCE: 'science'
};
