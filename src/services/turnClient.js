// src/services/turnClient.js
// Runs a turn action (ADVANCE_TURN, FAST_FORWARD) in src/engine/worker/turn.worker.js and resolves with the next
// state, or null when workers are unavailable or the worker failed (the caller then runs the turn
// on the main thread, exactly as before). One worker for the session, created on first use.
import { reviveFog } from '../engine/fog';

let worker = null;
let failed = false;
let seq = 0;
const pending = new Map(); // id -> resolve

export const turnWorkerAvailable = () => !failed && typeof Worker !== 'undefined' && typeof window !== 'undefined';

const getWorker = () => {
  if (worker || !turnWorkerAvailable()) return worker;
  try {
    worker = new Worker(new URL('../engine/worker/turn.worker.js', import.meta.url), { type: 'module' });
  } catch {
    failed = true;
    return null;
  }
  worker.onmessage = (e) => {
    const { id, state, error } = e.data || {};
    const resolve = pending.get(id);
    pending.delete(id);
    if (!resolve) return;
    if (error) { console.warn('The turn worker failed; the turn runs on the main thread:', error); resolve(null); return; }
    resolve(state?.fog ? { ...state, fog: reviveFog(state.fog) } : state);
  };
  worker.onerror = (e) => {
    console.warn('The turn worker could not start; turns run on the main thread:', e.message);
    failed = true;
    pending.forEach((resolve) => resolve(null));
    pending.clear();
    worker = null;
  };
  return worker;
};

/** The state after `action` as the worker resolves it, or null (run it here instead). */
export const runTurnInWorker = (state, action) => {
  const w = getWorker();
  if (!w) return Promise.resolve(null);
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    try { w.postMessage({ id, state, action }); } catch (err) { pending.delete(id); console.warn('Could not send the turn to the worker:', err); resolve(null); }
  });
};
