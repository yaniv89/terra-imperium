// The battle client never fails silently (the frozen empty battle of the phone playtest, the "no
// answer after 25 seconds" card on the iPhone): before its first frame a worker that reports an
// error, dies or says nothing for a while is replaced by a fresh worker, then by the main thread;
// any later error reaches the UI.
import { describe, it, expect } from 'vitest';
import { createBattleClient } from './battleClient';

// A fake backend: `script(onMessage, payload)` plays what the backend would post.
const fake = (name, script, log) => (onMessage, opts = {}) => {
  const label = name === 'worker' && opts.fresh ? 'fresh' : name;
  return {
    inline: name === 'inline',
    start: (payload) => { log.push(`${label}:start`); script(onMessage, payload, label); },
    orders: () => {}, pause: () => {}, resume: () => {}, speed: () => {},
    stop: () => log.push(`${label}:stop`)
  };
};
const frame = { type: 'frame', view: { tick: 0, squads: [] } };
// Timers the test runs by hand.
const clock = () => {
  const timers = new Map(); let id = 0;
  return {
    setTimer: (fn) => { id += 1; timers.set(id, fn); return id; },
    clearTimer: (i) => timers.delete(i),
    fire: () => { const all = [...timers.values()]; timers.clear(); all.forEach((fn) => fn()); return all.length; },
    pending: () => timers.size
  };
};

describe('battle client', () => {
  it('a worker error before the first frame tries a fresh worker, then the main thread', () => {
    const log = []; const got = [];
    createBattleClient({
      setup: { id: 's' }, hasWorker: true, onMessage: (m) => got.push(m),
      createWorkerBackend: fake('worker', (on) => on({ type: 'error', stage: 'load', message: 'grid failed to load' }), log),
      createInlineBackend: fake('inline', (on) => on(frame), log)
    });
    expect(log).toEqual(['worker:start', 'worker:stop', 'fresh:start', 'fresh:stop', 'inline:start']);
    expect(got.map((m) => m.type)).toEqual(['stage', 'stage', 'frame']);
    expect(got[0]).toMatchObject({ stage: 'retry', kind: 'fresh', reason: 'error', detail: 'grid failed to load' });
    expect(got[1]).toMatchObject({ stage: 'retry', kind: 'inline', reason: 'error' });
  });

  it('a dead warm worker is replaced by a fresh one that starts the battle', () => {
    const log = []; const got = [];
    createBattleClient({
      setup: {}, hasWorker: true, onMessage: (m) => got.push(m.type),
      createWorkerBackend: fake('worker', (on, _p, label) => on(label === 'fresh' ? frame : { type: 'error', stage: 'worker', message: 'The battle worker stopped.' }), log),
      createInlineBackend: fake('inline', () => { throw new Error('must not get here'); }, log)
    });
    expect(log).toEqual(['worker:start', 'worker:stop', 'fresh:start']);
    expect(got).toEqual(['stage', 'frame']);
  });

  it('a worker that never answers (killed by the phone) is replaced after the stall time', () => {
    const log = []; const got = []; const c = clock();
    createBattleClient({
      setup: {}, hasWorker: true, onMessage: (m) => got.push(m), setTimer: c.setTimer, clearTimer: c.clearTimer, isHidden: () => false,
      createWorkerBackend: fake('worker', (on, _p, label) => { if (label === 'fresh') on({ type: 'stage', stage: 'script' }); }, log),
      createInlineBackend: fake('inline', (on) => on(frame), log)
    });
    expect(log).toEqual(['worker:start']);
    expect(c.pending()).toBe(1);
    c.fire(); // the silent warm worker: a fresh one
    expect(log).toEqual(['worker:start', 'worker:stop', 'fresh:start']);
    expect(got.map((m) => m.stage || m.type)).toEqual(['retry', 'script']);
    c.fire(); // the fresh one said 'script' and then nothing: the main thread
    expect(log.slice(-2)).toEqual(['fresh:stop', 'inline:start']);
    expect(got.map((m) => m.stage || m.type)).toEqual(['retry', 'script', 'retry', 'frame']);
    expect(got[2]).toMatchObject({ kind: 'inline', reason: 'stalled' });
    expect(c.pending()).toBe(0); // a running battle has no stall timer
  });

  it('a stall while the page is hidden never replaces the worker', () => {
    const log = []; const c = clock(); let hidden = true;
    createBattleClient({
      setup: {}, hasWorker: true, onMessage: () => {}, setTimer: c.setTimer, clearTimer: c.clearTimer, isHidden: () => hidden,
      createWorkerBackend: fake('worker', () => {}, log),
      createInlineBackend: fake('inline', () => {}, log)
    });
    c.fire(); c.fire();
    expect(log).toEqual(['worker:start']);
    hidden = false;
    c.fire();
    expect(log).toEqual(['worker:start', 'worker:stop', 'fresh:start']);
  });

  it('progress from the worker keeps it: each stage restarts the stall time', () => {
    const log = []; const c = clock(); let say = null;
    createBattleClient({
      setup: {}, hasWorker: true, onMessage: () => {}, setTimer: c.setTimer, clearTimer: c.clearTimer, isHidden: () => false,
      createWorkerBackend: fake('worker', (on) => { say = on; }, log),
      createInlineBackend: fake('inline', () => {}, log)
    });
    say({ type: 'stage', stage: 'script' });
    say({ type: 'stage', stage: 'world' });
    expect(c.pending()).toBe(1); // one timer, restarted
    say(frame);
    expect(c.pending()).toBe(0);
    expect(log).toEqual(['worker:start']);
  });

  it('an error once the battle runs, or with nothing left to try, reaches the screen', () => {
    const got = [];
    createBattleClient({
      setup: {}, hasWorker: true, onMessage: (m) => got.push(m),
      createWorkerBackend: fake('worker', (on) => { on(frame); on({ type: 'error', stage: 'step', message: 'boom' }); }, []),
      createInlineBackend: fake('inline', () => { throw new Error('must not retry after a frame'); }, [])
    });
    expect(got.map((m) => m.type)).toEqual(['frame', 'error']);
    expect(got[1].message).toBe('boom');

    const got2 = [];
    createBattleClient({
      setup: {}, hasWorker: true, onMessage: (m) => got2.push(m),
      createWorkerBackend: fake('worker', (on) => on({ type: 'error', message: 'worker died' }), []),
      createInlineBackend: fake('inline', (on) => on({ type: 'error', message: 'sim failed' }), [])
    });
    expect(got2.filter((m) => m.type === 'error').map((m) => [m.message, m.attempts])).toEqual([['sim failed', 3]]);
  });

  it('messages from a replaced worker are dropped', () => {
    const got = []; let first = null;
    createBattleClient({
      setup: {}, hasWorker: true, onMessage: (m) => got.push(m.type),
      createWorkerBackend: fake('worker', (on, _p, label) => { if (label === 'worker') { first = on; on({ type: 'error', message: 'x' }); } }, []),
      createInlineBackend: fake('inline', () => {}, [])
    });
    first(frame); // the old worker, too late
    expect(got).toEqual(['stage']);
  });

  it('the real inline backend reports a setup the sim cannot build instead of throwing', () => {
    const got = [];
    expect(() => createBattleClient({ setup: { broken: true }, preferWorker: false, onMessage: (m) => got.push(m) })).not.toThrow();
    expect(got[0]).toMatchObject({ type: 'error', stage: 'start' });
  });
});
