// src/engine/eraGoals.js
// Era goals and the legacy they earn (plans/civ-map-rework.md, C9.3; workstream 11). The goals of
// the current age (src/data/eraGoals.js) are read from the player's state each time the sheet
// asks; when the calendar age changes (resolveTurn), the goals of the ending age are scored: at
// least ERA_GOALS_FOR_LEGACY met gives a timed national modifier made of the met playstyles'
// bonuses, ERA_LEGACY_TURNS long, and the result is kept on the player nation (`eraGoals`).
// Pure.
import { AGES, getYearsPerTurn } from '../data/ages';
import { ERA_GOALS_FOR_LEGACY, ERA_LEGACY_TURNS, PLAYSTYLES, goalsForAge } from '../data/eraGoals';
import { addNationModifier } from './modifiers/timed';
import { msg, sub, thing } from './messages';

/** The turn the state's current age began (turns are a fixed number of years inside one age). */
export const ageStartTurn = (state) => {
  const age = AGES[state.age];
  const ypt = getYearsPerTurn(state.age, state.gameSpeed) || 1;
  if (!age || state.year == null) return 0;
  return (state.turnNumber || 0) - Math.max(0, Math.round((state.year - age.startYear) / ypt));
};

/** Cities the player holds that the player took by force in the current age (captureLog, so a kept conquest keeps counting). */
export const citiesTakenThisAge = (state) => {
  const me = state.playerNationId;
  const from = ageStartTurn(state);
  return Object.values(state.regions || {}).filter((c) => c.owner === me && (c.captureLog || []).some((e) => e.by === me && e.turn >= from)).length;
};

/** The player's numbers for every playstyle today. */
export const playstyleValues = (state) => {
  const me = state.playerNationId;
  const mine = Object.values(state.regions || {}).filter((c) => c.owner === me);
  return {
    expand: mine.length,
    wealth: Object.values(state.nations || {}).filter((n) => n.id !== me && n.hasTradeAgreement).length,
    war: citiesTakenThisAge(state),
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
  if (!earned) return { nation: { ...nation, eraGoals: record }, log: msg('m.world.noLegacy', { age: thing('age', endingAgeId, AGES[endingAgeId]?.name || endingAgeId), n: met.length }) };
  const mods = {};
  met.forEach((id) => Object.entries(PLAYSTYLES[id].mods).forEach(([k, v]) => { mods[k] = (mods[k] || 0) + v; }));
  const label = `Legacy of the ${AGES[endingAgeId]?.name || endingAgeId}`;
  const next = addNationModifier({ ...nation, eraGoals: record }, { sourceType: 'eraGoal', sourceId: endingAgeId, label, mods, duration: ERA_LEGACY_TURNS, turnNumber });
  const bonuses = met.map((id) => thing('playstyleBonus', id, PLAYSTYLES[id].bonusLabel)).reduce((acc, b) => (acc === '' ? b : sub('m.world.listMore', { a: acc, b })), '');
  return { nation: next, log: msg('m.world.legacy', { age: thing('age', endingAgeId, AGES[endingAgeId]?.name || endingAgeId), bonuses, turns: ERA_LEGACY_TURNS }) };
};
