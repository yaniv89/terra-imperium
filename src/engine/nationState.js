// src/engine/nationState.js
// The one place that knows WHERE a nation's economy/tech data actually lives. Every reducer case
// and AI decision reads through this instead of hard-coding `state.resources`/`state.techTree` —
// that hard-coding is exactly why today's ~50 reducer cases only ever work for
// `state.playerNationId` and could never run for an AI nation.
//
// The player keeps living on the original top-level fields (`state.resources`, `state.techTree`,
// `state.techAgeId`) rather than moving to `state.nations[playerId].economy` — that would touch
// every existing test and every UI component that reads `state.resources` directly, for zero
// present benefit. AI nations get an `economy`/`tech` sub-object on their own nation record,
// introduced turn-by-turn as each milestone actually needs it (M16 is where this first becomes
// populated for real; until then these accessors are exercised only via the player branch, and
// via tests that construct an AI nation's economy by hand).
import { AGES, FIRST_AGE_ID, getAgeIndex } from '../data/ages';

export const getPool = (state, nationId) =>
  (nationId === state.playerNationId ? state.resources : state.nations[nationId]?.economy) || {};

// The player's list is memoised on the tech tree's identity, so callers that key caches on the
// array (the cities phase's tile yields) hit across turns until a tech completes.
const researchedMemo = new WeakMap();
/** How many times a nation has finished the repeatable Future Tech (research.js, U65). */
export const futureTechsOf = (state, nationId) => ((nationId === state.playerNationId ? state.research : state.nations?.[nationId]?.research)?.futureTechs || 0);

// A view of the state as an AI nation acts in it (`viewAs`) moves `playerNationId` to that nation and
// keeps the human in `humanView`; the human's research still lives on the top-level fields.
const isHuman = (state, nationId) => nationId != null && nationId === (state.humanView?.id ?? state.playerNationId);

export const getResearched = (state, nationId) => {
  if (isHuman(state, nationId)) {
    const tree = state.techTree;
    if (!tree) return [];
    const hit = researchedMemo.get(tree);
    if (hit) return hit;
    const list = Object.keys(tree).filter((id) => tree[id]?.researched);
    researchedMemo.set(tree, list);
    return list;
  }
  return state.nations[nationId]?.tech?.researched || [];
};

/**
 * A nation's age (plans/2026-10-20-001-feat-eight-ages-plan.md KTD1): the age its research has
 * reached and nothing else. No calendar floor and no cap; research is never lost, so it only rises.
 * The player's lives on state.techAgeId, an AI nation's on nation.tech.ageId; a nation with none
 * (an unknown id, rebels, an unowned city) is in the first age.
 */
export const ageOf = (state, nationId) => {
  const id = nationId == null ? null
    : nationId === state.playerNationId ? state.techAgeId
    : isHuman(state, nationId) ? state.humanView.ageId
    : state.nations?.[nationId]?.tech?.ageId;
  return AGES[id] ? id : FIRST_AGE_ID;
};

/**
 * `state` as `nationId` acts in it: the gates written for "the player" (validateInvasion, the battle
 * contexts) read its pool and age, and the human's age and research stay readable (a view that
 * forgot them fought the player's armies at the first age: battle-odds lane).
 */
export const viewAs = (state, nationId, resources = getPool(state, nationId)) => {
  if (nationId === state.playerNationId) return state;
  const humanView = state.humanView && state.humanView.id !== state.playerNationId ? state.humanView : { id: state.playerNationId, ageId: state.techAgeId };
  return { ...state, playerNationId: nationId, resources, techAgeId: ageOf(state, nationId), humanView };
};
/** The rank of ageOf in AGE_ORDER. */
export const ageIndexOf = (state, nationId) => getAgeIndex(ageOf(state, nationId));
/** The older name of ageOf, kept for its many readers. */
export const getTechAgeId = ageOf;
