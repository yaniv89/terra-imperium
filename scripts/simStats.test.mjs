import { describe, it, expect } from 'vitest';
import { gini, hhi, kaplanMeier, pairedDiff, tCritical95, zipfSlope, forEachOwnedTile, worldHealth, bootstrapMeanCI } from './simStats.mjs';

describe('balance-sim statistics', () => {
  it('gini is 0 for equal holders and (n-1)/n when one holds everything', () => {
    expect(gini([5, 5, 5, 5])).toBe(0);
    expect(gini([0, 0, 0, 10])).toBeCloseTo(0.75, 10);
    expect(gini([1, 2, 3, 4])).toBeCloseTo(0.25, 10);
  });

  it('gini and hhi do not change when every holding scales (a denser grid)', () => {
    const land = [40, 25, 10, 10, 5, 3];
    expect(gini(land.map((x) => x * 1.8))).toBeCloseTo(gini(land), 10);
    expect(hhi(land.map((x) => x * 1.8))).toBeCloseTo(hhi(land), 10);
  });

  it('hhi is 1/k for k equal holders and 1 for a monopoly', () => {
    expect(hhi([3, 3, 3, 3])).toBeCloseTo(0.25, 10);
    expect(hhi([7, 0, 0])).toBe(1);
  });

  it('kaplan-meier handles censoring and late entry', () => {
    // Four lives: deaths at 10 and 20, one alive (censored), one born at 15 and alive.
    const lives = [{ born: 0, died: 10 }, { born: 0, died: 20 }, { born: 0, died: null }, { born: 15, died: null }];
    const km = kaplanMeier(lives, [5, 10, 20, 30]);
    expect(km.at[5]).toBe(1);
    expect(km.at[10]).toBeCloseTo(2 / 3, 10); // 1 of 3 at risk (the late one is not born yet)
    expect(km.at[20]).toBeCloseTo(4 / 9, 10); // 1 of 3 at risk (the late one now counts)
    expect(km.at[30]).toBeCloseTo(4 / 9, 10);
    expect(km.median).toBe(20);
  });

  it('paired t interval flags a consistent shift and not noise', () => {
    const base = [10, 20, 30, 40, 50];
    const shift = pairedDiff(base, [12, 21, 33, 41, 52]);
    expect(shift.meanDiff).toBeCloseTo(1.8, 10);
    expect(shift.significant).toBe(true);
    expect(shift.lo).toBeGreaterThan(0);
    expect(shift.up).toBe(5);
    const noise = pairedDiff(base, [12, 18, 31, 39, 50]);
    expect(noise.significant).toBe(false);
    expect(noise.lo).toBeLessThan(0);
    expect(noise.hi).toBeGreaterThan(0);
  });

  it('one pair gives no interval and identical runs are never significant', () => {
    expect(pairedDiff([1], [2]).significant).toBe(false);
    expect(Number.isNaN(pairedDiff([1], [2]).lo)).toBe(true);
    expect(pairedDiff([1, 2, 3], [1, 2, 3]).significant).toBe(false);
  });

  it('uses Student t for small samples', () => {
    expect(tCritical95(1)).toBeCloseTo(12.706, 3);
    expect(tCritical95(4)).toBeCloseTo(2.776, 3);
    expect(tCritical95(500)).toBe(1.96);
  });

  it('bootstrap interval is deterministic and brackets the mean', () => {
    const d = [1, 2, 3, 2, 1, 2, 3, 4, 2, 1, 3, 2];
    const [lo, hi] = bootstrapMeanCI(d);
    expect(bootstrapMeanCI(d)).toEqual([lo, hi]);
    expect(lo).toBeLessThan(2.17);
    expect(hi).toBeGreaterThan(2.17);
  });

  it('zipf slope is -1 for a perfect rank-size law', () => {
    expect(zipfSlope([1000, 500, 1000 / 3, 250, 200])).toBeCloseTo(-1, 6);
  });

  it('walks tile ownership stored as an object, a Map or a typed array', () => {
    const seen = (store) => { const out = []; forEachOwnedTile(store, (t, c) => out.push([t, c])); return out; };
    expect(seen({ 3: 'a', 7: 'b' })).toEqual([[3, 'a'], [7, 'b']]);
    expect(seen(new Map([[3, 'a']]))).toEqual([[3, 'a']]);
    expect(seen(Uint16Array.from([0, 0, 5]))).toEqual([[2, 5]]);
  });

  it('world health reads shares from cities and tiles', () => {
    const state = {
      nations: { a: { id: 'a', economy: { gold: 100 } }, b: { id: 'b', economy: { gold: 100 } }, c: { id: 'c', isEliminated: true } },
      regions: { ca: { id: 'ca', owner: 'a', currentPopulation: 10 }, cb: { id: 'cb', owner: 'b', currentPopulation: 5 }, cb2: { id: 'cb2', owner: 'b', currentPopulation: 5 } },
      world: { tileOwner: { 0: 'ca', 1: 'ca', 2: 'cb', 3: 'cb2', 9: 'ca' } },
      resources: { gold: 0 }
    };
    const h = worldHealth(state, { isLand: (t) => t < 9, landTiles: 8, playerId: 'p' });
    expect(h.nationsAlive).toBe(2);
    expect(h.giniWealth).toBe(0);
    expect(h.giniPopulation).toBe(0);
    expect(h.hhiLand).toBe(0.5); // 2 and 2 land tiles; the sea tile 9 is ignored
    expect(h.effectiveNations).toBe(2);
    expect(h.topLandShare).toBe(0.25);
    expect(h.landClaimedShare).toBe(0.5);
  });
});
