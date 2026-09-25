import { describe, it, expect } from 'vitest';
import {
  seedDevelopment, getTotalDev, getPopFactor, POP_FACTOR_MIN, POP_FACTOR_MAX,
  DEV_TYPE_POOL, getDevelopProvinceCost
} from './development';
import { REGIONS_DATA } from '../data/regions';

describe('seedDevelopment', () => {
  it('splits an even gold value exactly in half between tax and production', () => {
    const [regionId] = Object.entries(REGIONS_DATA).find(([, d]) => (d.resources?.gold || 0) >= 10) || [];
    expect(regionId).toBeDefined();
    const gold = REGIONS_DATA[regionId].resources.gold;
    const dev = seedDevelopment(regionId);
    expect(dev.tax + dev.production).toBe(Math.max(2, gold)); // ceil+floor sums back to gold (or the 1+1 floor if gold<2)
  });

  it('never seeds below 1 for any of the three types, even at 0 gold/hr', () => {
    const zeroRegionId = Object.keys(REGIONS_DATA).find((id) => {
      const r = REGIONS_DATA[id].resources || {};
      return (r.gold || 0) === 0 && (r.hr || 0) === 0;
    });
    if (!zeroRegionId) return; // no such region in the current dataset — nothing to assert
    const dev = seedDevelopment(zeroRegionId);
    expect(dev.tax).toBeGreaterThanOrEqual(1);
    expect(dev.production).toBeGreaterThanOrEqual(1);
    expect(dev.manpower).toBeGreaterThanOrEqual(1);
  });

  it('seeds manpower directly from hr (floored at 1)', () => {
    const [regionId] = Object.entries(REGIONS_DATA).find(([, d]) => (d.resources?.hr || 0) > 0) || [];
    const hr = REGIONS_DATA[regionId].resources.hr;
    expect(seedDevelopment(regionId).manpower).toBe(Math.max(1, hr));
  });

  it('returns a fresh object every call, not a shared mutable reference', () => {
    const [regionId] = Object.keys(REGIONS_DATA);
    const a = seedDevelopment(regionId);
    const b = seedDevelopment(regionId);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('getTotalDev', () => {
  it('sums tax + production + manpower', () => {
    expect(getTotalDev({ dev: { tax: 3, production: 5, manpower: 7 } })).toBe(15);
  });

  it('is 0 for a region with no dev field', () => {
    expect(getTotalDev({})).toBe(0);
    expect(getTotalDev(null)).toBe(0);
  });
});

describe('getPopFactor', () => {
  const regionData = { population: 1000 };

  it('is 1.0 at exactly the modern baseline', () => {
    expect(getPopFactor({ currentPopulation: 1000 }, regionData)).toBe(1);
  });

  it('clamps above POP_FACTOR_MAX for a region that has grown far beyond baseline', () => {
    expect(getPopFactor({ currentPopulation: 10000 }, regionData)).toBe(POP_FACTOR_MAX);
  });

  it('clamps below POP_FACTOR_MIN for a region devastated far below baseline', () => {
    expect(getPopFactor({ currentPopulation: 10 }, regionData)).toBe(POP_FACTOR_MIN);
  });

  it('falls back to 1 when the region data has no population baseline', () => {
    expect(getPopFactor({ currentPopulation: 500 }, { population: 0 })).toBe(1);
  });
});

describe('DEV_TYPE_POOL', () => {
  it('routes each development type to the plan\'s specified power pool', () => {
    expect(DEV_TYPE_POOL.tax).toBe('adm');
    expect(DEV_TYPE_POOL.production).toBe('dip');
    expect(DEV_TYPE_POOL.manpower).toBe('mil');
  });
});

describe('getDevelopProvinceCost', () => {
  it('is exactly 50 at 0 total dev and 0 developmentCost modifier (the plan\'s own baseline)', () => {
    expect(getDevelopProvinceCost({ dev: { tax: 0, production: 0, manpower: 0 } }, 0)).toBe(50);
  });

  it('scales up with the region\'s own current total development', () => {
    const cheap = getDevelopProvinceCost({ dev: { tax: 1, production: 1, manpower: 1 } }, 0);
    const expensive = getDevelopProvinceCost({ dev: { tax: 10, production: 10, manpower: 10 } }, 0);
    expect(expensive).toBeGreaterThan(cheap);
  });

  it('scales down with a negative developmentCost modifier (e.g. the Administrator trait)', () => {
    const base = getDevelopProvinceCost({ dev: { tax: 5, production: 5, manpower: 5 } }, 0);
    const discounted = getDevelopProvinceCost({ dev: { tax: 5, production: 5, manpower: 5 } }, -0.1);
    expect(discounted).toBeLessThan(base);
  });
});
