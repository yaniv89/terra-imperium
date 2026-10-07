// src/battle/worker/battleClient.js
// One API for the UI whether the sim runs in a Web Worker (normal) or on the main thread (a very
// old WebView where module workers fail). Both run the exact same battleLoop, so results agree.
// Failures never pass silently: a worker that dies before its first frame (it could not load, or
// the browser killed it) is retried once on the main thread; any other error reaches the UI as
// { type: 'error', message } so the battle screen can say so and offer the way back.
import { createBattleLoop } from './battleLoop';
import { createViewDecoder } from '../render/packedView';

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
      if (loop) raf = requestAnimationFrame(pump);
    },
    orders: (orders) => guard('orders', () => loop?.pushOrders(orders)),
    pause: () => loop?.setPaused(true),
    resume: () => loop?.setPaused(false),
    speed: (s) => loop?.setSpeed(s),
    stop: () => { cancelAnimationFrame(raf); loop = null; }
  };
};

const createWorkerBackend = (onMessage) => {
  const worker = new Worker(new URL('./battle.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => onMessage(data);
  // A module that fails to load, an uncaught exception, a message that cannot be read.
  worker.onerror = (e) => { e.preventDefault?.(); onMessage({ type: 'error', stage: 'worker', message: e.message || 'The battle worker stopped.' }); };
  worker.onmessageerror = () => onMessage({ type: 'error', stage: 'worker', message: 'A battle frame could not be read.' });
  return {
    inline: false,
    start: (payload) => worker.postMessage({ type: 'start', ...payload }),
    orders: (orders) => worker.postMessage({ type: 'orders', orders }),
    pause: () => worker.postMessage({ type: 'pause' }),
    resume: () => worker.postMessage({ type: 'resume' }),
    speed: (speed) => worker.postMessage({ type: 'speed', speed }),
    stop: () => { worker.postMessage({ type: 'stop' }); worker.terminate(); }
  };
};

export const createBattleClient = ({ setup, resume = null, paused = false, onMessage: deliver, preferWorker = true, hasWorker = typeof Worker !== 'undefined', createWorkerBackend: makeWorker = createWorkerBackend, createInlineBackend: makeInline = createInlineBackend }) => {
  // Frames arrive packed (packedView.js); the UI gets them as plain-shaped views (`m.view`).
  const decode = createViewDecoder();
  let framed = false; // a frame has arrived: the battle runs
  let backend = null;
  let retried = false;
  const payload = { setup, resume, paused };
  const onMessage = (m) => {
    if (m.type === 'error') {
      // The worker failed before it showed anything: run the same loop here instead, once.
      if (!framed && !retried && backend && !backend.inline) {
        retried = true;
        try { backend.stop(); } catch { /* already gone */ }
        backend = makeInline(onMessage);
        backend.start(payload);
        return;
      }
      deliver(m);
      return;
    }
    if (m.type === 'frame') { framed = true; if (m.packed) { m.view = decode(m.packed); m.packed = null; } }
    deliver(m);
  };
  try {
    backend = preferWorker && hasWorker ? makeWorker(onMessage) : makeInline(onMessage);
  } catch {
    backend = makeInline(onMessage);
  }
  backend.start(payload);
  return {
    sendOrders: (orders) => backend.orders(orders),
    pause: () => backend.pause(),
    resume: () => backend.resume(),
    setSpeed: (s) => backend.speed(s),
    destroy: () => backend.stop()
  };
};
