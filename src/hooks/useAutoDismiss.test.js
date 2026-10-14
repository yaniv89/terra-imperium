// Playtest audit X19: the era banner's five seconds run on their own clock. No DOM library is
// installed, so React's two hooks are replaced by a tiny runner that keeps effects and refs.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const slots = [];
let cursor = 0;
vi.mock('react', () => ({
  useRef: (init) => { const i = cursor++; if (!slots[i]) slots[i] = { kind: 'ref', ref: { current: init } }; return slots[i].ref; },
  useEffect: (fn, deps) => {
    const i = cursor++;
    const prev = slots[i];
    if (prev && prev.deps && deps.length === prev.deps.length && deps.every((d, k) => Object.is(d, prev.deps[k]))) return;
    if (prev?.cleanup) prev.cleanup();
    slots[i] = { kind: 'effect', deps, cleanup: fn() };
  }
}));

import { useAutoDismiss } from './useAutoDismiss';

// One "render" of a component calling the hook.
const useRender = (value, clear, ms = 5000) => { cursor = 0; useAutoDismiss(value, clear, ms); };

describe('useAutoDismiss (X19)', () => {
  beforeEach(() => { slots.length = 0; vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('clears the banner after its time', () => {
    const clear = vi.fn();
    useRender('Iron Age', clear);
    vi.advanceTimersByTime(4999);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('re-rendering (the turn changing, a new callback each render) does not cancel the timer', () => {
    const first = vi.fn();
    const second = vi.fn();
    useRender('Iron Age', first);
    vi.advanceTimersByTime(1000);
    useRender('Iron Age', second); // end turn: the component renders again with a fresh closure
    vi.advanceTimersByTime(1000);
    useRender('Iron Age', vi.fn());
    vi.advanceTimersByTime(3000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(0);
  });

  it('calls the newest callback when the timer fires', () => {
    const first = vi.fn();
    const latest = vi.fn();
    useRender('Iron Age', first);
    vi.advanceTimersByTime(2000);
    useRender('Iron Age', latest);
    vi.advanceTimersByTime(3000);
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('does nothing while there is no banner, and restarts for a new one', () => {
    const clear = vi.fn();
    useRender(null, clear);
    vi.advanceTimersByTime(10000);
    expect(clear).not.toHaveBeenCalled();
    useRender('Bronze Age', clear);
    vi.advanceTimersByTime(2000);
    useRender('Iron Age', clear);
    vi.advanceTimersByTime(4000);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
