import { describe, it, expect } from 'vitest';
import { rankReasons, spread, autoParityOf, withAuxiliaries } from './battleOdds';

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
  it('auxiliaries Auto trains are a factor of their own (playtest 40651416284: 14,900 against 10,000 lost to 21,820 against 31,640 auxiliaries)', () => {
    const f = withAuxiliaries([], 1000, 1490, { attacker: 3164, defender: 2182 });
    expect(f).toEqual([{ id: 'aux', label: 'Auxiliaries', value: 1.69, detail: '3164 vs 2182' }]); // (1000 + 3164) / (1490 + 2182) against 1000 / 1490
    expect(withAuxiliaries([], 1000, 1000, { attacker: 0, defender: 0 })).toEqual([]);
  });
});
