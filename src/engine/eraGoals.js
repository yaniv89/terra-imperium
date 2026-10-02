// src/engine/eraGoals.js
// Era goals and the legacy they earn (plans/civ-map-rework.md, C9.3; workstream 11). The goals of
// the current age (src/data/eraGoals.js) are read from the player's state each time the sheet
// asks; when the calendar age changes (resolveTurn), the goals of the ending age are scored: at
// least ERA_GOALS_FOR_LEGACY met gives a timed national modifier made of the met playstyles'
// bonuses, ERA_LEGACY_TURNS long, and the result is kept on the player nation (`eraGoals`).
// Pure.
import { AGES } from '../data/ages';
import { ERA_GOALS_FOR_LEGACY, ERA_LEGACY_TURNS, PLAYSTYLES, goalsForAge } from '../data/eraGoals';
import { addNationModifier } from './modifiers/timed';

/** The player's numbers for every playstyle today. */
export const playstyleValues = (state) => {
  const me = state.playerNationId;
  const mine = Object.values(state.regions || {}).filter((c) => c.owner === me);
  return {
    expand: mine.length,
    wealth: Object.values(state.nations || {}).filter((n) => n.id !== me && n.hasTradeAgreement).length,
    war: mine.filter((c) => c.conquest).length,
    culture: Object.values(state.greatProjects || {}).filter((p) => state.regions?.[p.regionId]?.owner === me).length,
    science: Object.keys(state.techTree || {}).filter((id) => state.techTree[id]?.researched).length
  };
};

/** The goals of `ageId` (default: the calendar age) with the player's progress. */
export const eraGoalProgress = (state, ageId = state.age) => {
  const values = playstyleValues(state);
  const goals = goalsForAge(ageId).map((g) => ({ ...g, value: values[g.id], done: values[g.id] >= g.target }));
  return { ageId, goals, met: goals.filter((g) => g.done).length, needed: ERA_GOALS_FOR_LEGACY };
};

/**
 * Scores the ending age for the player and returns the nation with its legacy (a timed modifier)
 * and the record, plus a log line; the nation unchanged when the age was already scored.
 */
export const awardEraLegacy = (state, nation, endingAgeId, turnNumber) => {
  if (nation.eraGoals?.[endingAgeId]) return { nation, log: null };
  const progress = eraGoalProgress(state, endingAgeId);
  const met = progress.goals.filter((g) => g.done).map((g) => g.id);
  const earned = met.length >= ERA_GOALS_FOR_LEGACY;
  const record = { ...(nation.eraGoals || {}), [endingAgeId]: { met, legacy: earned } };
  if (!earned) return { nation: { ...nation, eraGoals: record }, log: `The ${AGES[endingAgeId]?.name || endingAgeId} ends with ${met.length} of its goals met: no legacy carries over.` };
  const mods = {};
  met.forEach((id) => Object.entries(PLAYSTYLES[id].mods).forEach(([k, v]) => { mods[k] = (mods[k] || 0) + v; }));
  const label = `Legacy of the ${AGES[endingAgeId]?.name || endingAgeId}`;
  const next = addNationModifier({ ...nation, eraGoals: record }, { sourceType: 'eraGoal', sourceId: endingAgeId, label, mods, duration: ERA_LEGACY_TURNS, turnNumber });
  return { nation: next, log: `${label}: ${met.map((id) => PLAYSTYLES[id].bonusLabel).join(', ')} for ${ERA_LEGACY_TURNS} turns.` };
};
