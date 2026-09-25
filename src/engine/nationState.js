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
export const getPool = (state, nationId) =>
  (nationId === state.playerNationId ? state.resources : state.nations[nationId]?.economy) || {};

export const getResearched = (state, nationId) => {
  if (nationId === state.playerNationId) {
    return Object.keys(state.techTree || {}).filter((id) => state.techTree[id]?.researched);
  }
  return state.nations[nationId]?.tech?.researched || [];
};

export const getTechAgeId = (state, nationId) =>
  (nationId === state.playerNationId ? state.techAgeId : state.nations[nationId]?.tech?.ageId) || state.age;
