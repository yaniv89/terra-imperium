// src/engine/tutorial.js
// The guided Dawn start as Egypt (plans/civ-map-rework.md E9): ten turns of "next" prompts, no
// modal lectures. `state.tutorial` exists only in a guided game: { startTurn, done: { stepId:
// turn }, ended }. Each step has a predicate read from the state; a step the UI must witness
// (opening a nation sheet) is marked by the reducer (MARK_TUTORIAL_STEP). resolveTurn records
// the steps met this turn and ends the guide after TUTORIAL_TURNS or when every step is done.
// Pure.
import { tileFacts } from '../data/tileYields';
import { getTiles } from '../data/geo/tiles';
import { isSettler } from './settlers';

// The guided start plays Kemet (the people of the Nile, phase W0) in a Standard peoples world; the
// guide reads only the player's own state, so it works in a legacy world too (as Egypt).
export const TUTORIAL_NATION = 'kemet';
export const TUTORIAL_WORLD_SIZE = 'standard';
export const TUTORIAL_TURNS = 10;
export const TUTORIAL_TECH = 'infrastructure_irrigation_canals';

const mine = (state) => Object.values(state.regions || {}).filter((c) => c.owner === state.playerNationId);
const capitalOf = (state) => { const id = state.nations?.[state.playerNationId]?.capitalRegionId; return state.regions?.[id] || mine(state)[0] || null; };
const queueOf = (city) => [city?.production?.current, ...(city?.production?.queue || [])].filter(Boolean);
const floodplainFarm = (state) => {
  const tiles = getTiles();
  const cap = capitalOf(state);
  if (!cap) return false;
  const isFlood = (t) => tileFacts(tiles, t, state.world?.tileState?.[t]).feature === 'floodplain';
  if (queueOf(cap).some((i) => i.kind === 'improvement' && i.improvement === 'farm' && isFlood(i.tile))) return true;
  return (cap.tiles || []).some((t) => isFlood(t) && state.world?.tileState?.[t]?.improvement === 'farm');
};

export const TUTORIAL_STEPS = [
  { id: 'settle', label: 'Train settlers and found a second city along the Nile', hint: 'Every people starts with one city: queue Settlers in your capital (City tab), then tap them, pick a river tile a few hexes away, and they walk there and settle.', target: 'settler',
    done: (state) => mine(state).length >= 2 || Object.values(state.units || {}).some((u) => u.ownerId === state.playerNationId && isSettler(u) && u.target != null) },
  { id: 'farm', label: 'Build a farm on a floodplain of your capital', hint: 'Open the capital, Tiles tab: a floodplain farm feeds a growing city.', target: 'capital',
    done: floodplainFarm },
  { id: 'granary', label: 'Queue a Granary in your capital', hint: 'The City tab builds it from production: more food stored, faster growth.', target: 'capital',
    done: (state) => { const cap = capitalOf(state); return !!cap && ((cap.buildings?.categories?.food ?? -1) >= 0 || queueOf(cap).some((i) => i.kind === 'building' && i.category === 'food')); } },
  { id: 'research', label: 'Research Irrigation Canals', hint: 'The Tech tab: canals turn the Nile flood into food for every riverside city.', target: 'tech',
    done: (state) => state.research?.current === TUTORIAL_TECH || !!state.techTree?.[TUTORIAL_TECH]?.researched || (state.research?.queue || []).includes(TUTORIAL_TECH) },
  { id: 'meet', label: 'Meet a neighbour: tap a foreign city and open its nation', hint: 'The nation sheet shows their opinion of you with every reason, and what you can offer them.', target: 'diplomacy',
    done: () => false },
  { id: 'battle', label: 'Fight your first battle', hint: 'March your army next to an enemy and attack from a river edge: the crossing is harder for the attacker, so defend behind the Nile and attack elsewhere.', target: 'army',
    done: (state) => (state.battleReports || []).length > 0 }
];

/** The guide today: { active, turn, steps: [{ id, label, hint, target, done }], current, remaining } or null. */
export const tutorialStatus = (state) => {
  const t = state.tutorial;
  if (!t) return null;
  const turn = (state.turnNumber || 1) - (t.startTurn || 1) + 1;
  const steps = TUTORIAL_STEPS.map((s) => ({ id: s.id, label: s.label, hint: s.hint, target: s.target, done: !!t.done?.[s.id] || s.done(state) }));
  const current = steps.find((s) => !s.done) || null;
  const active = !t.ended && turn <= TUTORIAL_TURNS && !!current;
  return { active, turn, steps, current, remaining: Math.max(0, TUTORIAL_TURNS - turn + 1), met: steps.filter((s) => s.done).length };
};

/** The guide's prompt for the next-prompt pill, or null. */
export const tutorialPrompt = (state) => {
  const s = tutorialStatus(state);
  if (!s?.active) return null;
  const n = s.steps.indexOf(s.current) + 1;
  return { id: `guide:${s.current.id}`, kind: 'guide', label: `Guide ${n}/${s.steps.length}: ${s.current.label}`, hint: s.current.hint, target: s.current.target, step: s.current.id };
};

/** Marks a step the UI witnessed; the same state when there is no guide or the step is known. */
export const markTutorialStep = (state, stepId) => {
  if (!state.tutorial || state.tutorial.done?.[stepId] || !TUTORIAL_STEPS.some((s) => s.id === stepId)) return state;
  return { ...state, tutorial: { ...state.tutorial, done: { ...(state.tutorial.done || {}), [stepId]: state.turnNumber || 1 } } };
};

/** End of turn: records the steps met and ends the guide when its turns run out or all is done. */
export const advanceTutorial = (state) => {
  const t = state.tutorial;
  if (!t || t.ended) return state;
  const done = { ...(t.done || {}) };
  TUTORIAL_STEPS.forEach((s) => { if (!done[s.id] && s.done(state)) done[s.id] = state.turnNumber; });
  const all = TUTORIAL_STEPS.every((s) => done[s.id]);
  const turn = (state.turnNumber || 1) - (t.startTurn || 1) + 1;
  const ended = all || turn > TUTORIAL_TURNS;
  const log = ended ? { year: state.year, message: all ? 'The guide ends: every step done. Egypt is yours.' : `The guide ends after ${TUTORIAL_TURNS} turns with ${Object.keys(done).length} of ${TUTORIAL_STEPS.length} steps done. The next prompt keeps pointing at what wants a decision.`, type: 'info' } : null;
  return { ...state, tutorial: { ...t, done, ended }, logs: log ? [...(state.logs || []), log] : state.logs };
};
