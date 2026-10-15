// src/battle/worker/warmWorker.js
// Kept apart from battleClient.js so the pre-battle sheets can warm the worker without pulling the
// sim into the main bundle.
import { worldMessage } from '../../worldgen/worldLoader';

// A battle worker started ahead of the battle (prewarmBattleWorker): the sim's module graph and the
// world grid load while the player is still on the pre-battle sheet or the "Mustering the troops"
// screen, instead of after the battlefield is drawn (scripts/perf/battle-load.mjs: the worker took 3
// to 5 s from its creation to its first frame, most of it loading). The next battle takes it if it is
// still for the same world and still alive, else it is dropped and a fresh one is started.
//
// Each worker comes wrapped in a handle. The handle holds what the page sends until the worker says
// its script has run (the 'script' stage, battle.worker.js), so nothing is posted into a module that
// is still loading, and it keeps what the worker says (its stages, an error) until a battle takes
// it. A worker that reports an error, or whose script never loads, is never handed to a battle.
const WARM_TTL_MS = 120000;
const INBOX_MAX = 20;
let warm = null;

/** A battle worker in a handle: post(), attach(sink), terminate(), and `dead` once it failed. */
export const spawnWorker = (make = () => new Worker(new URL('./battle.worker.js', import.meta.url), { type: 'module' })) => {
  const worker = make();
  const msg = worldMessage();
  const h = { worker, world: JSON.stringify(msg.spec), booted: false, dead: null, outbox: [[msg]], inbox: [], sink: null };
  const deliver = (data) => {
    if (h.sink) h.sink(data);
    else if (h.inbox.length < INBOX_MAX) h.inbox.push(data);
  };
  worker.onmessage = ({ data }) => {
    if (data?.type === 'stage' && data.stage === 'script' && !h.booted) {
      h.booted = true;
      h.outbox.splice(0).forEach(([m, transfer]) => worker.postMessage(m, transfer || []));
    }
    if (data?.type === 'error') h.dead = data.message || 'error';
    deliver(data);
  };
  // A module that fails to load, an uncaught exception, a message that cannot be read.
  worker.onerror = (e) => {
    e?.preventDefault?.();
    h.dead = e?.message || 'The battle worker stopped.';
    deliver({ type: 'error', stage: 'worker', message: h.dead });
  };
  worker.onmessageerror = () => deliver({ type: 'error', stage: 'worker', message: 'A battle frame could not be read.' });
  h.post = (m, transfer) => { if (h.booted) worker.postMessage(m, transfer || []); else h.outbox.push([m, transfer]); };
  h.attach = (sink) => { h.sink = sink; h.inbox.splice(0).forEach(sink); };
  h.terminate = () => { h.sink = null; try { worker.terminate(); } catch { /* gone */ } };
  return h;
};

const dropWarm = () => { if (warm) { clearTimeout(warm.timer); warm.terminate(); warm = null; } };
export const prewarmBattleWorker = () => {
  if (warm && !warm.dead) return;
  dropWarm();
  if (typeof Worker === 'undefined') return;
  try {
    const h = spawnWorker();
    h.timer = setTimeout(dropWarm, WARM_TTL_MS);
    warm = h;
  } catch { warm = null; }
};

/** Whether a warm handle may be adopted: alive and for the page's world. */
export const warmUsable = (h, worldKey) => !!h && !h.dead && h.world === worldKey;

/**
 * The worker for a battle, as a handle: the warm one when it is usable, else a fresh one. `fresh`
 * skips the warm one (a retry after the first worker failed or stalled). The handle says which it
 * was (`warm`).
 */
export const takeWorker = ({ fresh = false } = {}) => {
  if (warm) {
    const h = warm; warm = null; clearTimeout(h.timer);
    let key = null;
    try { key = JSON.stringify(worldMessage().spec); } catch { /* fall through */ }
    if (!fresh && warmUsable(h, key)) { h.warm = true; return h; }
    h.terminate();
  }
  const h = spawnWorker();
  h.warm = false;
  return h;
};
