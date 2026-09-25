// src/test/fixtures.js
// Shared test-state builders. `richState`/`modernState`-style helpers are deliberately NOT
// unified here beyond `makeState`: every existing describe block in GameContext.test.js redefines
// its own `richState` with DIFFERENT resource overrides tuned to what that block's actions need
// (some top up gold alone, others gold+hr+AP, others diplomacyPoints) — they're locally-tuned
// fixtures that happen to share a shape, not copy-pasted duplicates of the same values. Forcing
// them into one shared function right now would either lose that per-block tuning or need a
// parameterized signature every call site has to pass anyway, for no real gain — and M2's AP ->
// ADM/DIP/MIL migration is about to touch every one of those overrides regardless, which is a
// more natural point to consolidate them for real. `makeState` below generalizes the actual
// REPEATED PATTERN (create a state, then top up a few resources) so new tests don't hand-roll the
// spread, without forcing existing blocks to change their tuned values.
import { createInitialState } from '../engine/gameReducer';
import { getNationCapital } from '../data/regions';

// The one truly identical duplicate across test files (GameContext.test.js, resolveTurn.test.js):
// a plain alias with no behavior of its own, kept here so both import the same name.
export const cap = getNationCapital;

// createInitialState({ playerNationId }) plus a shallow merge of resource overrides — the pattern
// every `richState`/`spaceState`-style test helper already follows by hand.
export const makeState = ({ playerNationId = 'fr', gameSpeed = 'normal', overrides = {}, resources = {} } = {}) => {
  const state = createInitialState({ playerNationId, gameSpeed });
  return { ...state, ...overrides, resources: { ...state.resources, ...resources } };
};
