// src/engine/worker/turn.worker.js
// The turn off the main thread (plans/rts-world-review.md 6.4): the engine is pure and seeded, so
// running ADVANCE_TURN / FAST_FORWARD here is only a transport change. The state arrives as a
// structured clone (the fog's packed arrays as plain { bytes } / { ints } objects, revived first)
// and goes back the same way; turnClient.js revives it again on the main thread.
import { gameReducer } from '../gameReducer';
import { reviveFog } from '../fog';

self.onmessage = (e) => {
  const { id, state, action } = e.data || {};
  try {
    const input = state?.fog ? { ...state, fog: reviveFog(state.fog) } : state;
    const next = gameReducer(input, action);
    self.postMessage({ id, state: next });
  } catch (err) {
    self.postMessage({ id, error: String(err?.stack || err) });
  }
};
