// src/engine/eraGoals.js
// Era goals and the legacy they earn (plans/civ-map-rework.md, C9.3; workstream 11; follow-up 24).
// The goals of a nation's current age (src/data/eraGoals.js, 3 to 5 an age) are read from the
// state each time the sheet asks. A goal pays the turn it is met (payEraGoals, the rulers phase of
// resolveTurn): its reward (a timed national modifier sized by the age, ERA_LEGACY_TURNS long),
// one decree and renown, once; the ids paid are kept on `nation.eraGoals[age].met`. When a
// nation's OWN research age advances (research.js, eight-ages plan KTD7), the age it leaves is
// scored: goals met on that last turn are paid too, and at least ERA_GOALS_FOR_LEGACY met gives
// the era legacy (renown and a virtue point, renown.js); the record gains `legacy` (true or false),
// which marks the age as scored. The turn a nation entered its age is `nation.ageSince`. The final
// age is scored once when the ending signal fires (resolveTurn). Pure.
import { AGES } from '../data/ages';
import { ERA_GOALS_FOR_LEGACY, ERA_LEGACY_TURNS, PLAYSTYLES, goalsForAge } from '../data/eraGoals';
import { getTechsForAge } from '../data/techTree';
import { addNationModifier } from './modifiers/timed';
import { msg, sub, thing } from './messages';
import { ageOf } from './nationState';
import { grantDecree } from './decrees';
import { grantRenown, grantEraLegacy } from './renown';
import { RENOWN } from '../data/rulers';
import { getTiles } from '../data/geo/tiles';

/** The turn `nationId` entered its current age (0 for the first age). */
export const ageStartTurn = (state, nationId = state.playerNationId) => state.nations?.[nationId]?.ageSince || 0;

/** Cities the nation holds that it took by force in its current age (captureLog, so a kept conquest keeps counting). */
export const citiesTakenThisAge = (state, me = state.playerNationId) => {
  const from = ageStartTurn(state, me);
  return Object.values(state.regions || {}).filter((c) => c.owner === me && (c.captureLog || []).some((e) => e.by === me && e.turn >= from)).length;
};

const battlesWon = (nation) => nation?.battleStats?.won || 0;

/**
 * A nation's numbers for every playstyle in `ageId` today (default: the player in its own age):
 * cities, kinds of resource on its land, battles won since the age's record began (wonFrom, set
 * the first turn of the age), building levels in its best-built city (each tier of each building), research boosts
 * earned on the age's techs.
 */
export const playstyleValues = (state, me = state.playerNationId, ageId = ageOf(state, me)) => {
  const nation = state.nations?.[me];
  const mine = Object.values(state.regions || {}).filter((c) => c.owner === me);
  const tiles = getTiles();
  const kinds = new Set();
  let best = 0;
  mine.forEach((c) => {
    (c.tiles || [c.tile]).forEach((t) => { const r = tiles.resourceOf?.(t); if (r) kinds.add(r); });
    best = Math.max(best, Object.values(c.buildings?.categories || {}).reduce((n, tier) => n + (tier >= 0 ? tier + 1 : 0), 0));
  });
  const boosted = (me === state.playerNationId ? state.research : nation?.research)?.boosted || {};
  return {
    expand: mine.length,
    wealth: kinds.size,
    war: battlesWon(nation) - (nation?.eraGoals?.[ageId]?.wonFrom ?? battlesWon(nation)),
    culture: best,
    science: getTechsForAge(ageId).filter((t) => boosted[t.id]).length
  };
};

/** The goals of `ageId` (default: the nation's own age) with the nation's progress (default: the player). */
export const eraGoalProgress = (state, ageId = ageOf(state, state.playerNationId), nationId = state.playerNationId) => {
  const values = playstyleValues(state, nationId, ageId);
  const paid = state.nations?.[nationId]?.eraGoals?.[ageId]?.met || [];
  // A goal once paid stays met (a city lost later does not take the reward back).
  const goals = goalsForAge(ageId).map((g) => ({ ...g, value: values[g.id], done: values[g.id] >= g.target || paid.includes(g.id) }));
  return { ageId, goals, met: goals.filter((g) => g.done).length, needed: ERA_GOALS_FOR_LEGACY };
};

const ageThing = (ageId) => thing('age', ageId, AGES[ageId]?.name || ageId);

/**
 * Pays every goal of `ageId` that `nation` meets now and was not paid yet: its reward modifier,
 * a decree and renown. Returns { nation, paid } (the goals paid; nation unchanged when none, or
 * when the age was already scored).
 */
export const payEraGoals = (state, nation, ageId, turnNumber) => {
  const rec = nation?.eraGoals?.[ageId];
  if (!nation || nation.kind === 'independent' || (rec && 'legacy' in rec)) return { nation, paid: [] };
  const had = rec?.met || [];
  // The age's record begins its first turn, with the battle count the War goal counts from.
  const start = rec ? nation : { ...nation, eraGoals: { ...(nation.eraGoals || {}), [ageId]: { met: [], wonFrom: battlesWon(nation) } } };
  const view = rec ? state : { ...state, nations: { ...state.nations, [nation.id]: start } };
  const paid = eraGoalProgress(view, ageId, nation.id).goals.filter((g) => g.done && !had.includes(g.id));
  if (!paid.length) return { nation: start, paid };
  let n = start;
  paid.forEach((g) => {
    // A playstyle's new reward replaces its last one: a fast run through the ages never stacks them (research cost would compound).
    n = { ...n, modifiers: (n.modifiers || []).filter((m) => !(m.sourceType === 'eraGoal' && String(m.sourceId).endsWith(`.${g.id}`))) };
    n = grantRenown(grantDecree(n, 'eraGoal', turnNumber, g.id), 'eraGoal', RENOWN.eraGoal, turnNumber, g.id);
    n = addNationModifier(n, { sourceType: 'eraGoal', sourceId: `${ageId}.${g.id}`, label: `${PLAYSTYLES[g.id].label} goal: ${g.bonus}`, mods: g.mods, duration: ERA_LEGACY_TURNS, turnNumber });
  });
  return { nation: { ...n, eraGoals: { ...(n.eraGoals || {}), [ageId]: { ...start.eraGoals[ageId], met: [...had, ...paid.map((g) => g.id)] } } }, paid };
};

/** The log line of a goal paid to the player. */
export const eraGoalLog = (g) => msg('m.world.eraGoalMet', { goal: thing('playstyle', g.id, g.label), bonus: sub(`m.world.goalBonus.${g.id}`, { n: g.n }), turns: ERA_LEGACY_TURNS });

/**
 * Scores the ending age for `nation`: pays the goals met on its last turn, then gives the era
 * legacy for ERA_GOALS_FOR_LEGACY met. Returns the nation with the record and a log line; the
 * nation unchanged when the age was already scored.
 */
export const awardEraLegacy = (state, nation, endingAgeId, turnNumber) => {
  const rec0 = nation.eraGoals?.[endingAgeId];
  if (rec0 && 'legacy' in rec0) return { nation, log: null };
  nation = payEraGoals(state, nation, endingAgeId, turnNumber).nation;
  const met = nation.eraGoals?.[endingAgeId]?.met || [];
  const earned = met.length >= ERA_GOALS_FOR_LEGACY;
  if (earned) nation = grantEraLegacy(nation, turnNumber, endingAgeId);
  const next = { ...nation, eraGoals: { ...(nation.eraGoals || {}), [endingAgeId]: { ...nation.eraGoals[endingAgeId], met, legacy: earned } } };
  return { nation: next, log: msg(earned ? 'm.world.legacy' : 'm.world.noLegacy', { age: ageThing(endingAgeId), n: met.length }) };
};
