// src/battle/worker/battleClient.js
// One API for the UI whether the sim runs in a Web Worker (normal) or on the main thread (a very
// old WebView where module workers fail). Both run the exact same battleLoop, so results agree.
// Failures never pass silently. Before the first frame the client works down a short list of ways
// to run the battle: the worker it was given (often the warm one, warmWorker.js), then a fresh
// worker, then the main thread. It moves on when the current one reports an error, dies (onerror,
// messageerror) or says nothing for WORKER_STALL_MS (a worker the phone killed never answers at
// all). Each move is told to the screen as { type: 'stage', stage: 'retry' } (the loading screen
// and the crash log); an error with nothing left to try reaches the UI as { type: 'error' }.
import { createBattleLoop } from './battleLoop';
import { createViewDecoder } from '../render/packedView';
import { takeWorker } from './warmWorker';

/** A worker that says nothing for this long before its first frame is replaced. */
export const WORKER_STALL_MS = 15000;

const errorMessage = (stage, err) => ({ type: 'error', stage, message: err?.message || String(err || 'unknown error'), stack: err?.stack || null });

const createInlineBackend = (onMessage) => {
  let loop = null; let raf = null;
  const pump = (now) => {
    if (!loop) return;
    try { loop.frame(now); } catch (err) { loop = null; onMessage(errorMessage('step', err)); return; }
    raf = requestAnimationFrame(pump);
  };
  const guard = (stage, fn) => { try { fn(); } catch (err) { loop = null; onMessage(errorMessage(stage, err)); } };
  return {
    inline: true,
    start(payload) {
      guard('start', () => {
        loop = createBattleLoop({ setup: payload.setup, resume: payload.resume || null, post: onMessage });
        if (payload.paused) loop.setPaused(true);
      });
      if (loop) { onMessage({ type: 'stage', stage: 'setup' }); raf = requestAnimationFrame(pump); }
    },
    orders: (orders) => guard('orders', () => loop?.pushOrders(orders)),
    pause: () => loop?.setPaused(true),
    resume: () => loop?.setPaused(false),
    speed: (s) => loop?.setSpeed(s),
    stop: () => { cancelAnimationFrame(raf); loop = null; }
  };
};

const createWorkerBackend = (onMessage, { fresh = false } = {}) => {
  const h = takeWorker({ fresh });
  h.attach(onMessage); // what the worker said while warm (its stages, an error) comes first
  return {
    inline: false,
    warm: !!h.warm,
    start: (payload) => h.post({ type: 'start', ...payload }),
    orders: (orders) => h.post({ type: 'orders', orders }),
    pause: () => h.post({ type: 'pause' }),
    resume: () => h.post({ type: 'resume' }),
    speed: (speed) => h.post({ type: 'speed', speed }),
    stop: () => { h.post({ type: 'stop' }); h.terminate(); }
  };
};

const pageHidden = () => typeof document !== 'undefined' && !!document.hidden;

export const createBattleClient = ({
  setup, resume = null, paused = false, onMessage: deliver, preferWorker = true, hasWorker = typeof Worker !== 'undefined',
  createWorkerBackend: makeWorker = createWorkerBackend, createInlineBackend: makeInline = createInlineBackend,
  stallMs = WORKER_STALL_MS, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id), isHidden = pageHidden
}) => {
  // Frames arrive packed (packedView.js); the UI gets them as plain-shaped views (`m.view`).
  const decode = createViewDecoder();
  const payload = { setup, resume, paused };
  // The ways to run this battle, in order: 'worker' may be the warm one, 'fresh' never is.
  const plan = preferWorker && hasWorker ? ['worker', 'fresh', 'inline'] : ['inline'];
  let attempt = 0;
  let framed = false; // a frame has arrived: the battle runs
  let backend = null;
  let generation = 0; // messages from a backend that was replaced are dropped
  let timer = null;
  let destroyed = false;

  const disarm = () => { if (timer !== null) { clearTimer(timer); timer = null; } };
  const arm = () => {
    disarm();
    if (framed || destroyed || !backend || backend.inline) return;
    timer = setTimer(onStall, stallMs);
  };
  // Moves to the next way of running the battle; false when there is none left.
  const next = (reason, detail = null) => {
    if (destroyed || attempt + 1 >= plan.length) return false;
    try { backend?.stop(); } catch { /* already gone */ }
    attempt += 1;
    deliver({ type: 'stage', stage: 'retry', attempt, kind: plan[attempt], reason, detail });
    launch();
    return true;
  };
  function onStall() {
    timer = null;
    if (framed || destroyed) return;
    if (isHidden()) { arm(); return; } // a phone suspends workers in the background: wait for the return
    next('stalled');
  }
  const onMessage = (m) => {
    if (destroyed) return;
    if (m.type === 'error') {
      disarm();
      if (!framed && next('error', m.message)) return;
      deliver({ ...m, attempts: attempt + 1 });
      return;
    }
    if (m.type === 'frame') {
      if (!framed) { framed = true; disarm(); }
      if (m.packed) { m.view = decode(m.packed); m.packed = null; }
    } else if (!framed) arm(); // any word from the worker: it is alive
    deliver(m);
  };
  function launch() {
    const gen = ++generation;
    const on = (m) => { if (gen === generation) onMessage(m); };
    const kind = plan[attempt];
    try {
      backend = kind === 'inline' ? makeInline(on) : makeWorker(on, { fresh: kind === 'fresh' });
    } catch (err) {
      backend = null;
      if (!next('error', err?.message || String(err))) deliver({ ...errorMessage('worker', err), attempts: attempt + 1 });
      return;
    }
    arm();
    backend.start(payload);
  }
  launch();
  return {
    /** Which way the battle runs now: 'worker' (maybe warm), 'fresh' or 'inline'. */
    kind: () => plan[attempt],
    warm: () => !!backend?.warm,
    sendOrders: (orders) => backend?.orders(orders),
    pause: () => backend?.pause(),
    resume: () => backend?.resume(),
    setSpeed: (s) => backend?.speed(s),
    destroy: () => { destroyed = true; disarm(); try { backend?.stop(); } catch { /* gone */ } }
  };
};
