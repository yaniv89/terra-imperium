// src/battle/worker/battleClient.js
// One API for the UI whether the sim runs in a Web Worker (normal) or on the main thread (a very
// old WebView where module workers fail). Both run the exact same battleLoop, so results agree.
import { createBattleLoop } from './battleLoop';

const createInlineBackend = (onMessage) => {
  let loop = null; let raf = null;
  const pump = (now) => { if (!loop) return; loop.frame(now); raf = requestAnimationFrame(pump); };
  return {
    start(payload) {
      loop = createBattleLoop({ setup: payload.setup, resume: payload.resume || null, post: onMessage });
      if (payload.paused) loop.setPaused(true);
      raf = requestAnimationFrame(pump);
    },
    orders: (orders) => loop?.pushOrders(orders),
    pause: () => loop?.setPaused(true),
    resume: () => loop?.setPaused(false),
    speed: (s) => loop?.setSpeed(s),
    stop: () => { cancelAnimationFrame(raf); loop = null; }
  };
};

const createWorkerBackend = (onMessage) => {
  const worker = new Worker(new URL('./battle.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => onMessage(data);
  return {
    start: (payload) => worker.postMessage({ type: 'start', ...payload }),
    orders: (orders) => worker.postMessage({ type: 'orders', orders }),
    pause: () => worker.postMessage({ type: 'pause' }),
    resume: () => worker.postMessage({ type: 'resume' }),
    speed: (speed) => worker.postMessage({ type: 'speed', speed }),
    stop: () => { worker.postMessage({ type: 'stop' }); worker.terminate(); }
  };
};

export const createBattleClient = ({ setup, resume = null, paused = false, onMessage, preferWorker = true }) => {
  let backend;
  try {
    backend = preferWorker && typeof Worker !== 'undefined' ? createWorkerBackend(onMessage) : createInlineBackend(onMessage);
  } catch {
    backend = createInlineBackend(onMessage);
  }
  backend.start({ setup, resume, paused });
  return {
    sendOrders: (orders) => backend.orders(orders),
    pause: () => backend.pause(),
    resume: () => backend.resume(),
    setSpeed: (s) => backend.speed(s),
    destroy: () => backend.stop()
  };
};
