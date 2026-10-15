// The staged start (startWatch.js): progress restarts the clock, hidden time never counts, and the
// start fails only after a long time with no new stage.
import { describe, it, expect } from 'vitest';
import { createStartWatch, START_STALL_MS, START_STAGES } from './startWatch';

const at = () => { const c = { t: 1000 }; c.now = () => c.t; return c; };

describe('battle start watch', () => {
  it('a slow start that keeps making progress never fails, however long it takes in all', () => {
    const c = at(); const w = createStartWatch({ now: c.now });
    for (const s of ['worker', 'script', 'world', 'sim', 'setup', 'frame']) {
      c.t += START_STALL_MS - 1;
      expect(w.check()).toBeNull();
      expect(w.note(s)).toBe(true);
    }
    expect(c.t - 1000).toBeGreaterThan(25000 * 6); // far past the old single 25 s deadline
    w.note('drawn');
    c.t += START_STALL_MS * 10;
    expect(w.check()).toBeNull();
    expect(w.done()).toBe(true);
  });

  it('no new stage for the stall time fails once, naming the stage reached', () => {
    const c = at(); const w = createStartWatch({ now: c.now });
    w.note('worker'); w.note('script');
    c.t += START_STALL_MS;
    expect(w.check()).toEqual({ reason: 'stalled', stage: 'script', waitedMs: START_STALL_MS });
    expect(w.check()).toBeNull();
    expect(w.failed()).toMatchObject({ stage: 'script' });
    expect(w.note('world')).toBe(false); // too late
  });

  it('an earlier or repeated stage is not progress', () => {
    const c = at(); const w = createStartWatch({ now: c.now });
    w.note('sim');
    c.t += START_STALL_MS - 10;
    expect(w.note('script')).toBe(false);
    expect(w.note('sim')).toBe(false);
    expect(w.note('nonsense')).toBe(false);
    c.t += 10;
    expect(w.check()).toMatchObject({ stage: 'sim' });
  });

  it('time in the background never counts, and the wait restarts on the return', () => {
    const c = at(); const w = createStartWatch({ now: c.now });
    w.note('worker');
    c.t += 20000;
    w.hidden(true);
    c.t += 600000; // ten minutes in another app
    expect(w.check()).toBeNull();
    w.hidden(false);
    c.t += START_STALL_MS - 1;
    expect(w.check()).toBeNull();
    c.t += 1;
    expect(w.check()).toMatchObject({ stage: 'worker' });
  });

  it('a replaced worker restarts the clock and sends the bar back to the worker stage', () => {
    const c = at(); const w = createStartWatch({ now: c.now });
    w.note('worker'); w.note('script'); w.note('world');
    c.t += START_STALL_MS - 1;
    w.bump('retry fresh', 'worker');
    expect(w.stage()).toBe('worker');
    c.t += START_STALL_MS - 1;
    expect(w.check()).toBeNull();
    expect(w.note('script')).toBe(true); // the new worker's stages count again
    expect(w.summary()).toMatch(/^field 0\.0, worker 0\.0, script 0\.0, world 0\.0, script 60\.0, retry fresh@world 30\.0$/);
  });

  it('the bar runs from 0 to 1 over the stages', () => {
    const c = at(); const w = createStartWatch({ now: c.now, first: 'models' });
    expect(w.fraction()).toBe(0);
    w.note('setup');
    expect(w.fraction()).toBeCloseTo(START_STAGES.indexOf('setup') / (START_STAGES.length - 1));
    w.note('drawn');
    expect(w.fraction()).toBe(1);
  });

  it('an error marks the start failed where it stood', () => {
    const c = at(); const w = createStartWatch({ now: c.now });
    w.note('worker');
    c.t += 1234;
    expect(w.fail('error')).toEqual({ reason: 'error', stage: 'worker', waitedMs: 1234 });
    expect(w.check()).toBeNull();
  });
});
