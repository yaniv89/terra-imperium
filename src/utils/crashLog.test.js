import { describe, it, expect } from 'vitest';
import { createCrashLog, endingOf, CRASH_LOG_KEY } from './crashLog';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('crash log (reloads the player never sees)', () => {
  it('tells a crash in front from a close and from a kill in the background', () => {
    expect(endingOf(null)).toBe(null);
    expect(endingOf({ closed: true })).toBe('closed');
    expect(endingOf({ closed: false, hidden: true })).toBe('background');
    expect(endingOf({ closed: false, hidden: false })).toBe('crash');
  });

  it('remembers the screen and turn of a session that died, and counts crashes in a row', () => {
    const storage = memoryStorage();
    let t = 1000;
    const a = createCrashLog({ storage, now: () => t });
    expect(a.last).toBe(null);
    a.screen('map', 40); a.screen('battle', 41); a.event('map-context-lost');
    // the page dies (no pagehide): the next load sees it
    t = 2000;
    const b = createCrashLog({ storage, now: () => t });
    expect(b.last).toMatchObject({ screen: 'battle', turn: 41, ending: 'crash' });
    expect(b.streak).toBe(1);
    t = 3000;
    const c = createCrashLog({ storage, now: () => t });
    expect(c.streak).toBe(2);
    c.closed();
    const d = createCrashLog({ storage, now: () => 4000 });
    expect(d.last.ending).toBe('closed');
    expect(d.streak).toBe(0);
    expect(d.summary()).toMatch(/crash on battle turn 41 \| map-context-lost/);
  });

  it('keeps a bounded log and survives broken or blocked storage', () => {
    const storage = memoryStorage();
    for (let i = 0; i < 30; i++) createCrashLog({ storage, now: () => i });
    expect(JSON.parse(storage.getItem(CRASH_LOG_KEY)).sessions.length).toBeLessThanOrEqual(12);
    storage.setItem(CRASH_LOG_KEY, '{not json');
    expect(() => createCrashLog({ storage })).not.toThrow();
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    const log = createCrashLog({ storage: blocked });
    expect(() => { log.screen('map', 1); log.event('x'); log.closed(); }).not.toThrow();
  });
});
