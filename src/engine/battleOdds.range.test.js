import { describe, it, expect } from 'vitest';
import { rankReasons, spread, autoParityOf } from './battleOdds';

describe('Auto prediction data (U20)', () => {
  it('the range holds the estimate, even when the samples miss it', () => {
    const [lo, hi] = spread([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1], 0.1);
    expect(lo).toBeLessThanOrEqual(0.1);
    expect(hi).toBeGreaterThanOrEqual(0.9);
    expect(spread([], 5)).toEqual([5, 5]);
  });
  it('reasons sort by absolute effect, cap at three and drop factors of 1', () => {
    const f = (id, value) => ({ id, value });
    const r = rankReasons([f('a', 1), f('b', 1.1), f('c', 0.5), f('d', 2.5), f('e', 1.3)]);
    expect(r.map((x) => x.id)).toEqual(['d', 'c', 'e']);
  });
  it('a missing parity row gives null, never a made-up number', () => {
    expect(autoParityOf('no-such-kind')).toBeNull();
  });
});
