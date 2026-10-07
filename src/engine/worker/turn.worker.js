// src/engine/worker/turn.worker.js
// The turn off the main thread (plans/rts-world-review.md 6.4): the engine is pure and seeded, so
// running ADVANCE_TURN / FAST_FORWARD here is only a transport change. The state arrives as a
// structured clone (the fog's packed arrays as plain { bytes } / { ints } objects, revived first)
// and goes back the same way; turnClient.js revives it again on the main thread.
// The grid comes first (the page's own columns in the world message, worldLoader.js) and the
// engine is imported after it: its modules read the grid as they load. Messages that arrive
// meanwhile wait for it.
//
// Protocol (turnClient.js):
//   { type: '__world', spec, grid }  -> nothing (the world to install, always the first message)
//   { type: 'ping', id }             -> { type: 'pong', id } at once, even while the world loads:
//                                       the page checks the worker is alive before a turn
//   { id, state, action }            -> { id, state } or { id, error }
//   the world or the engine fails    -> { type: 'fatal', error }: the page stops using this worker
//   an uncaught error                -> { type: 'fatal', error }
import { loadWorldFromMessage, WORLD_MESSAGE } from '../../worldgen/worldLoader';

const errorText = (err) => String(err?.stack || err?.message || err);

// The world this worker runs comes in the first message (worldLoader.js worldMessage): the page's.
let setWorld;
const world = new Promise((resolve) => { setWorld = resolve; });
const engine = world.then(loadWorldFromMessage).then(async () => {
  // gameReducer first, as the app loads it: the engine has import cycles whose order matters.
  const { gameReducer } = await import('../gameReducer');
  const { reviveFog } = await import('../fog');
  return { gameReducer, reviveFog };
});
engine.catch((err) => self.postMessage({ type: 'fatal', error: `The turn engine could not load: ${errorText(err)}` }));

self.addEventListener('error', (e) => { self.postMessage({ type: 'fatal', error: errorText(e?.error || e?.message) }); });
self.addEventListener('unhandledrejection', (e) => { self.postMessage({ type: 'fatal', error: errorText(e?.reason) }); });

self.onmessage = async (e) => {
  const data = e.data || {};
  if (data.type === WORLD_MESSAGE) { setWorld(data); return; }
  if (data.type === 'ping') { self.postMessage({ type: 'pong', id: data.id }); return; }
  const { id, state, action } = data;
  let next;
  try {
    const { gameReducer, reviveFog } = await engine;
    const input = state?.fog ? { ...state, fog: reviveFog(state.fog) } : state;
    next = gameReducer(input, action);
  } catch (err) {
    self.postMessage({ id, error: errorText(err) });
    return;
  }
  try {
    self.postMessage({ id, state: next });
  } catch (err) {
    // A state that cannot be cloned back: say so, so the page runs the turn itself at once.
    self.postMessage({ id, error: `The turn could not be sent back: ${errorText(err)}` });
  }
};
