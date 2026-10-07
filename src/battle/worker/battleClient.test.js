// The battle client never fails silently (the frozen empty battle of the phone playtest): a worker
// that dies before its first frame is retried on the main thread; any later error reaches the UI.
import { describe, it, expect } from 'vitest';
import { createBattleClient } from './battleClient';

// A fake backend: `script(onMessage, payload)` plays what the backend would post.
const fake = (name, script, log) => (onMessage) => ({
  inline: name === 'inline',
  start: (payload) => { log.push(`${name}:start`); script(onMessage, payload); },
  orders: () => {}, pause: () => {}, resume: () => {}, speed: () => {},
  stop: () => log.push(`${name}:stop`)
});
const frame = { type: 'frame', view: { tick: 0, squads: [] } };

describe('battle client', () => {
  it('a worker error before the first frame retries the same battle on the main thread', () => {
    const log = []; const got = [];
    createBattleClient({
      setup: { id: 's' }, hasWorker: true, onMessage: (m) => got.push(m.type),
      createWorkerBackend: fake('worker', (on) => on({ type: 'error', stage: 'load', message: 'grid failed to load' }), log),
      createInlineBackend: fake('inline', (on) => on(frame), log)
    });
    expect(log).toEqual(['worker:start', 'worker:stop', 'inline:start']);
    expect(got).toEqual(['frame']);
  });

  it('an error once the battle runs, or on the main thread too, reaches the screen', () => {
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
    expect(got2.map((m) => m.message)).toEqual(['sim failed']);
  });

  it('the real inline backend reports a setup the sim cannot build instead of throwing', () => {
    const got = [];
    expect(() => createBattleClient({ setup: { broken: true }, preferWorker: false, onMessage: (m) => got.push(m) })).not.toThrow();
    expect(got[0]).toMatchObject({ type: 'error', stage: 'start' });
  });
});
