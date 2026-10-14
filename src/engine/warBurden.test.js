import { describe, it, expect } from 'vitest';
import { warBurdenInputs, warExhaustionRise, WE_RISE_BASE, WE_RISE_PER_BESIEGED, WE_RISE_BESIEGED_CAP, WE_RISE_LOST_LAND } from './warBurden';

describe('warBurden (CB09 I121, X22)', () => {
  it('a war with nothing happening costs only the base', () => {
    expect(warExhaustionRise({ cities: 4 })).toBe(WE_RISE_BASE);
    expect(warExhaustionRise(undefined)).toBe(WE_RISE_BASE);
  });

  it('sieges and lost land add to the rise, sieges capped', () => {
    expect(warExhaustionRise({ cities: 4, besieged: 2 })).toBe(WE_RISE_BASE + 2 * WE_RISE_PER_BESIEGED);
    expect(warExhaustionRise({ cities: 9, besieged: 9 })).toBe(WE_RISE_BASE + WE_RISE_BESIEGED_CAP * WE_RISE_PER_BESIEGED);
    // 1 of 4 cities taken (3 left + 1 lost): a quarter of WE_RISE_LOST_LAND.
    expect(warExhaustionRise({ cities: 3, lost: 1 })).toBeCloseTo(WE_RISE_BASE + WE_RISE_LOST_LAND / 4);
  });

  it('reads sieges, occupations and live conquests from the cities', () => {
    const regions = {
      a1: { owner: 'a', siege: { by: 'b' } },
      a2: { owner: 'a', occupiedBy: 'b' },
      b1: { owner: 'b', conquest: { from: 'a', warId: 'w1' } },
      b2: { owner: 'b', conquest: { from: 'a', warId: 'old' } },
      c1: { owner: 'c' }
    };
    const out = warBurdenInputs(regions, new Set(['a']), (id) => id === 'w1');
    expect(out.get('a')).toEqual({ cities: 2, besieged: 1, occupied: 1, lost: 1 });
    expect(out.has('c')).toBe(false);
    expect(warBurdenInputs(regions, new Set(), () => true).size).toBe(0);
  });
});
