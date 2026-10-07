// src/services/turnClient.js
// Runs a turn action (ADVANCE_TURN, FAST_FORWARD) in src/engine/worker/turn.worker.js and resolves with the next
// state, or null when workers are unavailable or the worker failed (the caller then runs the turn
// on the main thread, exactly as before). One worker at a time, created on first use.
//
// iOS Safari (the user's iPhones froze on "The world moves" on turn 2) can stop a worker without
// any error event: when the tab goes to the background or the phone locks, under memory pressure.
// So before every turn after the first the page pings the worker (it answers at once when alive and
// idle); a silent one is replaced by a fresh worker (MAX_RESPAWNS times, then turns run on the main
// thread). A turn that still gets no answer in TURN_WORKER_TIMEOUT_MS (FIRST_TURN_TIMEOUT_MS for
// the first, which loads the engine) runs on the main thread and the worker is dropped for good, as
// on an error. The world goes to the worker with the page's own grid (worldLoader.js
// worldMessage), so the worker never fetches and unzips it again.
import { reviveFog } from '../engine/fog';
import { worldMessage } from '../worldgen/worldLoader';

export const TURN_WORKER_TIMEOUT_MS = 30000;
export const FIRST_TURN_TIMEOUT_MS = 60000;
export const PING_TIMEOUT_MS = 4000;
export const MAX_RESPAWNS = 2;

/**
 * The client over any worker factory (tests pass a fake). `makeWorker()` returns a Worker-like
 * object ({ postMessage, terminate, onmessage, onerror, onmessageerror }) or throws.
 */
export const createTurnClient = ({
  makeWorker,
  worldMsg = () => null,
  revive = (s) => s,
  supported = () => true,
  timers = { setTimeout: (...a) => setTimeout(...a), clearTimeout: (...a) => clearTimeout(...a) },
  warn = (...a) => console.warn(...a),
  turnTimeoutMs = TURN_WORKER_TIMEOUT_MS,
  firstTurnTimeoutMs = FIRST_TURN_TIMEOUT_MS,
  pingTimeoutMs = PING_TIMEOUT_MS,
  maxRespawns = MAX_RESPAWNS
}) => {
  let worker = null;
  let failed = false;
  let answered = false; // the current worker loaded its engine ('ready') or answered a turn
  let respawns = 0;
  let seq = 0;
  const pending = new Map(); // id -> (state | null) => void
  const pings = new Map(); // id -> (alive: boolean) => void

  const settleAll = () => {
    pending.forEach((done) => done(null)); pending.clear();
    pings.forEach((done) => done(false)); pings.clear();
  };
  const drop = () => {
    try { worker?.terminate(); } catch { /* already gone */ }
    worker = null;
    answered = false;
  };
  const giveUp = (why) => {
    warn(`The turn worker ${why}; turns run on the main thread.`);
    failed = true;
    drop();
    settleAll();
  };

  const available = () => !failed && supported();

  const spawn = () => {
    let w;
    try {
      w = makeWorker();
      const msg = worldMsg();
      if (msg) w.postMessage(msg); // the world to load first (one world per page)
    } catch (err) {
      giveUp(`could not start (${err?.message || err})`);
      return null;
    }
    w.onmessage = (e) => {
      if (w !== worker) return; // a dropped worker's late answer
      const data = e.data || {};
      if (data.type === 'ready') { answered = true; return; }
      if (data.type === 'pong') { const done = pings.get(data.id); pings.delete(data.id); done?.(true); return; }
      if (data.type === 'fatal') { giveUp(`failed (${String(data.error).split('\n')[0]})`); return; }
      const done = pending.get(data.id);
      pending.delete(data.id);
      if (!done) return;
      answered = true;
      if (data.error) { warn('The turn worker failed; the turn runs on the main thread:', data.error); done(null); return; }
      done(data.state ? revive(data.state) : null);
    };
    w.onerror = (e) => { if (w === worker) giveUp(`could not start (${e?.message || 'error'})`); };
    w.onmessageerror = () => { if (w === worker) giveUp('sent a message that could not be read'); };
    worker = w;
    answered = false;
    return w;
  };

  /** True when the worker answers a ping in time. */
  const ping = (w) => new Promise((resolve) => {
    const id = `ping-${++seq}`;
    const timer = timers.setTimeout(() => { if (pings.has(id)) { pings.delete(id); resolve(false); } }, pingTimeoutMs);
    pings.set(id, (alive) => { timers.clearTimeout(timer); resolve(alive); });
    try { w.postMessage({ type: 'ping', id }); } catch { pings.delete(id); timers.clearTimeout(timer); resolve(false); }
  });

  /** A live worker for the next turn: the current one if it answers a ping, else a fresh one. */
  const liveWorker = async () => {
    if (!worker) return spawn();
    const w = worker;
    // Still loading its engine (a prewarmed worker): a ping could wait behind the module loading,
    // so the turn goes straight in with the first-turn timeout.
    if (!answered) return w;
    if (await ping(w)) return w === worker ? w : null;
    if (w !== worker) return worker; // replaced meanwhile
    if (respawns >= maxRespawns) { giveUp('stopped answering'); return null; }
    respawns += 1;
    warn('The turn worker stopped answering; starting a new one.');
    drop();
    return available() ? spawn() : null;
  };

  /** The state after `action` as the worker resolves it, or null (run it here instead). */
  const run = async (state, action) => {
    if (!available()) return null;
    const w = await liveWorker();
    if (!w || failed) return null;
    const id = ++seq;
    return new Promise((resolve) => {
      const timer = timers.setTimeout(() => { if (pending.has(id)) giveUp('did not answer in time'); }, answered ? turnTimeoutMs : firstTurnTimeoutMs);
      pending.set(id, (next) => { timers.clearTimeout(timer); resolve(next); });
      try { w.postMessage({ id, state, action }); } catch (err) {
        pending.delete(id); timers.clearTimeout(timer);
        warn('Could not send the turn to the worker:', err);
        resolve(null);
      }
    });
  };

  /** Starts the worker and its engine ahead of the first End Turn (the first turn is no slower). */
  const prewarm = () => { if (available() && !worker) spawn(); };

  return { run, prewarm, available, ping: () => (worker ? ping(worker) : Promise.resolve(false)), get worker() { return worker; } };
};

const browserSupported = () => typeof Worker !== 'undefined' && typeof window !== 'undefined';

const client = createTurnClient({
  // Vite bundles the worker from this exact `new Worker(new URL(...))` shape.
  makeWorker: () => new Worker(new URL('../engine/worker/turn.worker.js', import.meta.url), { type: 'module' }),
  worldMsg: worldMessage,
  revive: (state) => (state?.fog ? { ...state, fog: reviveFog(state.fog) } : state),
  supported: browserSupported
});

export const turnWorkerAvailable = () => client.available();

/** Loads the turn worker and its engine now, so the first End Turn does not wait for it. */
export const prewarmTurnWorker = () => client.prewarm();

/** The state after `action` as the worker resolves it, or null (run it here instead). */
export const runTurnInWorker = (state, action) => client.run(state, action);
