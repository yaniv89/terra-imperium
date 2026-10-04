import { describe, it, expect } from 'vitest';
import { seedDevelopment, getTotalDev, getPopFactor, POP_FACTOR_MIN, POP_FACTOR_MAX, getDevelopProvinceCost } from './development';
import { getNationCapital, REGIONS_DATA } from '../data/regions';

// On the tile world a city's development mirrors its size and yields (resolveTurn's cities
// phase); seedDevelopment is the fallback for a record without a dev field.
describe('seedDevelopment', () => {
  it('seeds from the city size the registry reports, never below 1', () => {
    const id = getNationCapital('eg');
    const dev = seedDevelopment(id);
    expect(dev.tax).toBeGreaterThanOrEqual(1);
    expect(dev.production).toBeGreaterThanOrEqual(1);
    expect(dev.manpower).toBe(Math.max(1, REGIONS_DATA[id].resources.hr));
    expect(seedDevelopment('not-a-city')).toEqual({ tax: 1, production: 1, manpower: 1 });
  });
  it('returns a fresh object every call, not a shared mutable reference', () => {
    const id = getNationCapital('fr');
    const a = seedDevelopment(id); const b = seedDevelopment(id);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe('getTotalDev', () => {
  it('sums tax + production + manpower', () => { expect(getTotalDev({ dev: { tax: 2, production: 3, manpower: 4 } })).toBe(9); });
  it('is 0 for a region with no dev field', () => { expect(getTotalDev({})).toBe(0); });
});

describe('getPopFactor', () => {
  it('is 1 at the baseline, floored below and soft-capped above', () => {
    expect(getPopFactor({ currentPopulation: 100 }, { population: 100 })).toBe(1);
    expect(getPopFactor({ currentPopulation: 1 }, { population: 100 })).toBe(POP_FACTOR_MIN);
    const big = getPopFactor({ currentPopulation: 1e9 }, { population: 100 });
    expect(big).toBeLessThan(POP_FACTOR_MAX);
    expect(big).toBeGreaterThan(POP_FACTOR_MAX - 0.001);
    // every extra person still counts a little: no flat zone below the cap
    expect(getPopFactor({ currentPopulation: 400 }, { population: 100 })).toBeGreaterThan(getPopFactor({ currentPopulation: 300 }, { population: 100 }));
    expect(getPopFactor({ currentPopulation: 5 }, undefined)).toBe(1);
  });

  it('is 1 for a city: its size already drives its yields (one population model)', () => {
    expect(getPopFactor({ size: 4, currentPopulation: 1e7 }, { population: 100 })).toBe(1);
  });
});

describe('getDevelopProvinceCost', () => {
  it('rises with development', () => {
    expect(getDevelopProvinceCost({ dev: { tax: 10, production: 10, manpower: 10 } })).toBeGreaterThan(getDevelopProvinceCost({ dev: { tax: 1, production: 1, manpower: 1 } }));
  });
});
