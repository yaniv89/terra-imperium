// src/engine/worker/turn.worker.js
// The turn off the main thread (plans/rts-world-review.md 6.4): the engine is pure and seeded, so
// running ADVANCE_TURN / FAST_FORWARD here is only a transport change. The state arrives as a
// structured clone (the fog's packed arrays as plain { bytes } / { ints } objects, revived first)
// and goes back the same way; turnClient.js revives it again on the main thread.
// The grid is fetched first (tiles.js) and the engine imported after it: its modules read the grid
// as they load. Messages that arrive meanwhile wait for it.
import { loadTiles } from '../../data/geo/tiles';

const engine = loadTiles().then(async () => {
  // gameReducer first, as the app loads it: the engine has import cycles whose order matters.
  const { gameReducer } = await import('../gameReducer');
  const { reviveFog } = await import('../fog');
  return { gameReducer, reviveFog };
});

self.onmessage = async (e) => {
  const { id, state, action } = e.data || {};
  try {
    const { gameReducer, reviveFog } = await engine;
    const input = state?.fog ? { ...state, fog: reviveFog(state.fog) } : state;
    const next = gameReducer(input, action);
    self.postMessage({ id, state: next });
  } catch (err) {
    self.postMessage({ id, error: String(err?.stack || err) });
  }
};
