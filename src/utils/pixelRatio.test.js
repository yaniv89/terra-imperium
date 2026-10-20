import { describe, it, expect, vi } from 'vitest';
import { watchPixelRatio } from './pixelRatio';

// a window whose devicePixelRatio we change: each query fires once when the ratio leaves its value
const fakeWindow = () => {
  const queries = [];
  const win = {
    devicePixelRatio: 1,
    matchMedia: (q) => {
      const listeners = new Set();
      const mq = { q, addEventListener: (_, f) => listeners.add(f), removeEventListener: (_, f) => listeners.delete(f), listeners };
      queries.push(mq);
      return mq;
    },
    setRatio(r) {
      const live = queries.filter((m) => m.listeners.size && m.q !== `(resolution: ${r}dppx)`);
      win.devicePixelRatio = r;
      live.forEach((m) => [...m.listeners].forEach((f) => f()));
    },
    queries
  };
  return win;
};

describe('watchPixelRatio (H-06)', () => {
  it('calls back on every change of ratio and stops when asked', () => {
    const win = fakeWindow(); const seen = vi.fn();
    const stop = watchPixelRatio(seen, win);
    win.setRatio(1.36);
    win.setRatio(2);
    expect(seen.mock.calls.map((c) => c[0])).toEqual([1.36, 2]);
    stop();
    win.setRatio(1);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(win.queries.every((m) => m.listeners.size === 0)).toBe(true);
  });
  it('does nothing without media queries (tests, a worker)', () => {
    expect(() => watchPixelRatio(() => {}, null)()).not.toThrow();
  });
});
