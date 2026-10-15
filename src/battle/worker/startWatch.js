// src/battle/worker/startWatch.js
// How a commanded battle starts, stage by stage, and when to give up (pure, for tests).
// The old rule was one deadline: no frame 25 s after the battlefield opened meant failure. A slow
// phone can pass 25 s while still making progress (the worker's script, the world grid, the sim),
// and a page that went to the background came back already past the deadline. Now every stage
// that arrives restarts the clock, the clock stops while the page is hidden, and the start fails
// only after a long time with no new stage (or an error, which the screen handles itself).

/** The stages in order: on the page (models, field, worker), in the worker (script, world, sim,
 * setup) and back on the page (frame: the first frame arrived, drawn: it is on screen). */
export const START_STAGES = ['models', 'field', 'worker', 'script', 'world', 'sim', 'setup', 'frame', 'drawn'];
/** No new stage for this long (page in front) and the start has failed. */
export const START_STALL_MS = 30000;

const indexOf = (stage) => START_STAGES.indexOf(stage);

/**
 * A watch over one start. `now` is a clock in ms (performance.now on the page).
 * note(stage): a stage was reached (an earlier or unknown one is ignored, false is returned).
 * bump(label, back): progress without a new stage (a stalled worker replaced): the clock restarts,
 *   and with `back` the stage returns there (the new worker reports its stages again).
 * hidden(on): the page went to the background or came back; hidden time never counts.
 * check(): null, or { reason: 'stalled', stage, waitedMs } once, when the start has stalled.
 */
export const createStartWatch = ({ now, stallMs = START_STALL_MS, first = 'field' } = {}) => {
  const t0 = now();
  let stage = first;
  let at = t0;
  let hiddenSince = null;
  let failed = null;
  const history = [{ stage: first, ms: 0 }];
  const bumps = [];
  const watch = {
    stage: () => stage,
    /** ms since the watch began (the loading screen's seconds). */
    elapsed: () => now() - t0,
    done: () => stage === 'drawn',
    failed: () => failed,
    history: () => history.slice(),
    bumps: () => bumps.slice(),
    /** How far along the start is, 0 to 1 (the loading bar). */
    fraction: () => Math.max(0, indexOf(stage)) / (START_STAGES.length - 1),
    note(next) {
      if (failed || indexOf(next) <= indexOf(stage)) return false;
      stage = next;
      at = now();
      history.push({ stage: next, ms: Math.round(at - t0) });
      return true;
    },
    bump(label, back = null) {
      if (failed) return;
      at = now();
      bumps.push({ label: String(label), stage, ms: Math.round(at - t0) });
      // A replaced worker starts its own stages again: the bar goes back so they count.
      if (back && indexOf(back) >= 0 && indexOf(back) < indexOf(stage)) stage = back;
    },
    hidden(on) {
      if (on) { if (hiddenSince === null) hiddenSince = now(); return; }
      if (hiddenSince === null) return;
      // The phone suspended the page and the worker: the wait starts again from the return.
      at = now();
      hiddenSince = null;
    },
    check() {
      if (failed || hiddenSince !== null || stage === 'drawn') return null;
      const waitedMs = now() - at;
      if (waitedMs < stallMs) return null;
      failed = { reason: 'stalled', stage, waitedMs: Math.round(waitedMs) };
      return failed;
    },
    /** Marks the start failed for another reason (an error from the worker). */
    fail(reason) { if (!failed) failed = { reason: String(reason), stage, waitedMs: Math.round(now() - at) }; return failed; },
    /** One line for the crash log: the stages with their times in seconds, then the retries. */
    summary() {
      const s = (ms) => (ms / 1000).toFixed(1);
      const parts = history.map((h) => `${h.stage} ${s(h.ms)}`);
      bumps.forEach((b) => parts.push(`${b.label}@${b.stage} ${s(b.ms)}`));
      return parts.join(', ');
    }
  };
  return watch;
};
