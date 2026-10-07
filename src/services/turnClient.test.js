// The turn worker's client (turnClient.js) over a fake worker: a silent worker (iOS Safari stops
// workers without an error event) never leaves "The world moves" up.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTurnClient } from './turnClient';

// A fake worker: `behaviour` decides how it answers each message.
const fakeWorker = (behaviour = {}) => {
  const w = {
    sent: [],
    terminated: false,
    onmessage: null,
    postMessage(msg) {
      this.sent.push(msg);
      const reply = (data) => queueMicrotask(() => { if (!this.terminated) this.onmessage?.({ data }); });
      if (msg?.type === 'ping') { if (behaviour.pong !== false) reply({ type: 'pong', id: msg.id }); return; }
      if (msg?.type === '__world') return;
      if (behaviour.silent) return;
      if (behaviour.error) { reply({ id: msg.id, error: 'boom' }); return; }
      if (behaviour.fatal) { reply({ type: 'fatal', error: 'no engine' }); return; }
      reply({ id: msg.id, state: { turn: (msg.state?.turn || 0) + 1 } });
    },
    terminate() { this.terminated = true; }
  };
  return w;
};

const setup = (workers, opts = {}) => {
  const made = [];
  const queue = [...workers];
  const client = createTurnClient({
    makeWorker: () => { const w = queue.shift() || fakeWorker(); made.push(w); return w; },
    worldMsg: () => ({ type: '__world', spec: { kind: 'earth' }, grid: { count: 1 } }),
    warn: () => {},
    ...opts
  });
  return { client, made };
};

describe('turnClient', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('runs turns in one worker, sends the world (with its grid) first and pings before later turns', async () => {
    const { client, made } = setup([fakeWorker()]);
    expect(await client.run({ turn: 1 }, { type: 'ADVANCE_TURN' })).toEqual({ turn: 2 });
    expect(await client.run({ turn: 2 }, { type: 'ADVANCE_TURN' })).toEqual({ turn: 3 });
    expect(made).toHaveLength(1);
    const types = made[0].sent.map((m) => m.type || 'turn');
    expect(types).toEqual(['__world', 'turn', 'ping', 'turn']);
    expect(made[0].sent[0].grid).toEqual({ count: 1 });
  });

  it('replaces a worker that stopped answering pings, and the turn still runs in a worker', async () => {
    const dead = fakeWorker();
    const { client, made } = setup([dead, fakeWorker()]);
    expect(await client.run({ turn: 1 }, {})).toEqual({ turn: 2 });
    dead.postMessage = function (msg) { this.sent.push(msg); }; // killed in the background: silent
    const p = client.run({ turn: 2 }, {});
    await vi.advanceTimersByTimeAsync(4000);
    expect(await p).toEqual({ turn: 3 });
    expect(made).toHaveLength(2);
    expect(dead.terminated).toBe(true);
    expect(client.available()).toBe(true);
  });

  it('gives up after too many replacements: turns run on the main thread', async () => {
    const silentPing = () => fakeWorker({ pong: false });
    const { client } = setup([silentPing(), silentPing(), silentPing()], { maxRespawns: 1 });
    expect(await client.run({ turn: 1 }, {})).toEqual({ turn: 2 });
    const p2 = client.run({ turn: 2 }, {});
    await vi.advanceTimersByTimeAsync(4000);
    expect(await p2).toEqual({ turn: 3 }); // the second worker
    const p3 = client.run({ turn: 3 }, {});
    await vi.advanceTimersByTimeAsync(4000);
    expect(await p3).toBeNull();
    expect(client.available()).toBe(false);
  });

  it('a turn without an answer resolves null after the timeout (the first turn gets longer)', async () => {
    const { client } = setup([fakeWorker({ silent: true })], { turnTimeoutMs: 30000, firstTurnTimeoutMs: 60000 });
    let result = 'waiting';
    client.run({ turn: 1 }, {}).then((r) => { result = r; });
    await vi.advanceTimersByTimeAsync(30000);
    expect(result).toBe('waiting');
    await vi.advanceTimersByTimeAsync(30000);
    expect(result).toBeNull();
    expect(client.available()).toBe(false);
  });

  it('an engine error answers null for that turn but keeps the worker', async () => {
    const { client } = setup([fakeWorker({ error: true })]);
    expect(await client.run({ turn: 1 }, {})).toBeNull();
    expect(client.available()).toBe(true);
  });

  it('a fatal message (the engine could not load) stops using workers at once', async () => {
    const { client } = setup([fakeWorker({ fatal: true })]);
    expect(await client.run({ turn: 1 }, {})).toBeNull();
    expect(client.available()).toBe(false);
  });

  it('a worker that cannot be created means the main thread', async () => {
    const client = createTurnClient({ makeWorker: () => { throw new Error('no module workers'); }, warn: () => {} });
    expect(await client.run({ turn: 1 }, {})).toBeNull();
    expect(client.available()).toBe(false);
  });

  it('a prewarmed worker still loading gets the turn without a ping; once ready, turns are pinged first', async () => {
    const w = fakeWorker();
    const { client, made } = setup([w]);
    client.prewarm();
    expect(made).toHaveLength(1);
    expect(await client.run({ turn: 1 }, {})).toEqual({ turn: 2 }); // not ready yet: no ping
    expect(w.sent.map((m) => m.type || 'turn')).toEqual(['__world', 'turn']);
    const w2 = fakeWorker();
    const second = setup([w2]);
    second.client.prewarm();
    w2.onmessage({ data: { type: 'ready' } });
    expect(await second.client.run({ turn: 1 }, {})).toEqual({ turn: 2 });
    expect(w2.sent.map((m) => m.type || 'turn')).toEqual(['__world', 'ping', 'turn']);
  });

  it('"Run it here" settles a waiting turn with null and the next turn gets a fresh worker', async () => {
    const stuck = fakeWorker({ silent: true });
    const { client, made } = setup([stuck, fakeWorker()]);
    const p = client.run({ turn: 1 }, {});
    await Promise.resolve(); await Promise.resolve();
    expect(client.abandon()).toBe(true);
    expect(await p).toBeNull();
    expect(stuck.terminated).toBe(true);
    expect(client.available()).toBe(true);
    expect(await client.run({ turn: 1 }, {})).toEqual({ turn: 2 });
    expect(made).toHaveLength(2);
    expect(client.abandon()).toBe(false); // nothing waiting
  });

  it('an answer that cannot be revived settles the turn (null) instead of hanging', async () => {
    const { client } = setup([fakeWorker()], { revive: () => { throw new Error('bad fog'); } });
    expect(await client.run({ turn: 1 }, {})).toBeNull();
    expect(client.turnLog()).toMatch(/revive-failed/);
  });

  it('keeps a log of sent, answer and settled with the state size', async () => {
    const { client } = setup([fakeWorker()]);
    await client.run({ turn: 1, big: 'x'.repeat(100) }, { type: 'ADVANCE_TURN' });
    const evs = client.events().map((e) => e.ev);
    expect(evs).toEqual(['spawn', 'sent', 'answer', 'settled']);
    expect(client.events()[1].bytes).toBeGreaterThan(100);
    expect(client.turnLog()).toMatch(/sent .*ADVANCE_TURN/);
  });

  it('a worker error event settles the waiting turn', async () => {
    const w = fakeWorker({ silent: true });
    const { client } = setup([w]);
    const p = client.run({ turn: 1 }, {});
    await Promise.resolve(); await Promise.resolve();
    w.onerror({ message: 'out of memory' });
    expect(await p).toBeNull();
  });
});
