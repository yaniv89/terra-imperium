// src/services/turnClient.js
// Runs a turn action (ADVANCE_TURN, FAST_FORWARD) in src/engine/worker/turn.worker.js and resolves with the next
// state, or null when workers are unavailable or the worker failed (the caller then runs the turn
// on the main thread, exactly as before). One worker for the session, created on first use.
import { reviveFog } from '../engine/fog';
import { worldMessage } from '../worldgen/worldLoader';

let worker = null;
let failed = false;
let seq = 0;
const pending = new Map(); // id -> resolve
// A worker that never answers (iOS Safari can kill a worker for memory without any error event)
// must not freeze End Turn: past this the turn runs on the main thread and the worker is dropped.
// The first turn also loads the world in the worker, so it gets longer.
export const TURN_WORKER_TIMEOUT_MS = 30000;
const FIRST_TURN_TIMEOUT_MS = 60000;
let answered = false;

const giveUp = (why) => {
  console.warn(`The turn worker ${why}; turns run on the main thread.`);
  failed = true;
  try { worker?.terminate(); } catch { /* already gone */ }
  worker = null;
  pending.forEach((resolve) => resolve(null));
  pending.clear();
};

export const turnWorkerAvailable = () => !failed && typeof Worker !== 'undefined' && typeof window !== 'undefined';

const getWorker = () => {
  if (worker || !turnWorkerAvailable()) return worker;
  try {
    worker = new Worker(new URL('../engine/worker/turn.worker.js', import.meta.url), { type: 'module' });
    worker.postMessage(worldMessage()); // the world to load first (one world per page)
  } catch {
    failed = true;
    return null;
  }
  worker.onmessage = (e) => {
    const { id, state, error } = e.data || {};
    const resolve = pending.get(id);
    pending.delete(id);
    answered = true;
    if (!resolve) return;
    if (error) { console.warn('The turn worker failed; the turn runs on the main thread:', error); resolve(null); return; }
    resolve(state?.fog ? { ...state, fog: reviveFog(state.fog) } : state);
  };
  worker.onerror = (e) => giveUp(`could not start (${e.message})`);
  worker.onmessageerror = () => giveUp('sent a message that could not be read');
  return worker;
};

/** The state after `action` as the worker resolves it, or null (run it here instead). */
export const runTurnInWorker = (state, action) => {
  const w = getWorker();
  if (!w) return Promise.resolve(null);
  const id = ++seq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => { if (pending.has(id)) giveUp('did not answer in time'); }, answered ? TURN_WORKER_TIMEOUT_MS : FIRST_TURN_TIMEOUT_MS);
    pending.set(id, (next) => { clearTimeout(timer); resolve(next); });
    try { w.postMessage({ id, state, action }); } catch (err) { pending.delete(id); console.warn('Could not send the turn to the worker:', err); resolve(null); }
  });
};
