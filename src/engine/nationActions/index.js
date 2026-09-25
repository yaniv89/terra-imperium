// src/engine/nationActions/index.js
// A registry of action handlers keyed by ActionTypes, each written once against the ctx contract
// (src/engine/nationActions/ctx.js) instead of against `state.playerNationId` directly — the same
// handler runs for the player (via the reducer, immutableCtx) and, from M16 on, for an AI nation
// (via the AI decision phase, draftCtx). Handlers are added domain-by-domain as each later
// milestone actually needs the AI to take that action (per the plan's own "migrated only where
// the AI needs them, one case per commit" — there is no value in converting a reducer case ahead
// of the milestone that's about to rewrite its rules anyway, e.g. Build Infrastructure's cost and
// effects both change in M2/M5/M6).
//
// Handler signature: (ctx, actorId, payload) => boolean — true if the action was applied, false if
// a guard rejected it (the caller decides what "rejected" means for its own context: the reducer
// returns the original `state` reference, the AI phase just moves on to its next candidate action).
const HANDLERS = {};

export const registerNationAction = (type, handler) => { HANDLERS[type] = handler; };

export const applyNationAction = (ctx, actorId, action) => {
  const handler = HANDLERS[action.type];
  return handler ? handler(ctx, actorId, action.payload) : false;
};

// Test-only: lets a test suite register a throwaway handler without polluting the real registry
// other tests (and the app) read from.
export const _resetForTests = () => { Object.keys(HANDLERS).forEach((k) => delete HANDLERS[k]); };
