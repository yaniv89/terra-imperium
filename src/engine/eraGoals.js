// src/engine/eraGoals.js
// Era goals and the legacy they earn (plans/civ-map-rework.md, C9.3; workstream 11). The goals of
// a nation's current age (src/data/eraGoals.js) are read from the state each time the sheet asks;
// when a nation's OWN research age advances (research.js, eight-ages plan KTD7), the goals of the
// age it leaves are scored for that nation: at least ERA_GOALS_FOR_LEGACY met gives a timed
// national modifier made of the met playstyles' bonuses, ERA_LEGACY_TURNS long, and the result is
// kept on the nation (`eraGoals`). The turn a nation entered its age is `nation.ageSince`. The
// final age is scored once when the ending signal fires (resolveTurn). Pure.
import { AGES } from '../data/ages';
import { ERA_GOALS_FOR_LEGACY, ERA_LEGACY_TURNS, PLAYSTYLES, RAID_GOAL_AGES, goalsForAge } from '../data/eraGoals';
import { addNationModifier } from './modifiers/timed';
import { msg, sub, thing } from './messages';
import { ageOf, getResearched } from './nationState';

/** The turn `nationId` entered its current age (0 for the first age). */
export const ageStartTurn = (state, nationId = state.playerNationId) => state.nations?.[nationId]?.ageSince || 0;

/** Cities the nation holds that it took by force in its current age (captureLog, so a kept conquest keeps counting). */
export const citiesTakenThisAge = (state, me = state.playerNationId) => {
  const from = ageStartTurn(state, me);
  return Object.values(state.regions || {}).filter((c) => c.owner === me && (c.captureLog || []).some((e) => e.by === me && e.turn >= from)).length;
};

/** A nation's numbers for every playstyle today (default: the player). Trade agreements are with
 * the player, so an AI nation counts one when it trades with the player. */
export const playstyleValues = (state, me = state.playerNationId, ageId = ageOf(state, me)) => {
  const mine = Object.values(state.regions || {}).filter((c) => c.owner === me);
  return {
    expand: mine.length,
    wealth: me === state.playerNationId ? Object.values(state.nations || {}).filter((n) => n.id !== me && n.hasTradeAgreement).length : (state.nations?.[me]?.hasTradeAgreement ? 1 : 0),
    war: citiesTakenThisAge(state, me) + (RAID_GOAL_AGES.includes(ageId) ? state.nations?.[me]?.battleStats?.raidsWon || 0 : 0),
    culture: Object.values(state.greatProjects || {}).filter((p) => state.regions?.[p.regionId]?.owner === me).length,
    science: getResearched(state, me).length
  };
};

/** The goals of `ageId` (default: the nation's own age) with the nation's progress (default: the player). */
export const eraGoalProgress = (state, ageId = ageOf(state, state.playerNationId), nationId = state.playerNationId) => {
  const values = playstyleValues(state, nationId, ageId);
  const goals = goalsForAge(ageId).map((g) => ({ ...g, value: values[g.id], done: values[g.id] >= g.target }));
  return { ageId, goals, met: goals.filter((g) => g.done).length, needed: ERA_GOALS_FOR_LEGACY };
};

/**
 * Scores the ending age for `nation` and returns the nation with its legacy (a timed modifier)
 * and the record, plus a log line; the nation unchanged when the age was already scored.
 */
export const awardEraLegacy = (state, nation, endingAgeId, turnNumber) => {
  if (nation.eraGoals?.[endingAgeId]) return { nation, log: null };
  const progress = eraGoalProgress(state, endingAgeId, nation.id);
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
