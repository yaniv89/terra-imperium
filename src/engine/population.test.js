import { describe, it, expect } from 'vitest';
import {
  getPopulationGrowthRate, nextRegionPopulation,
  BASE_GROWTH, FOOD_TIER_GROWTH_BONUS, INFRA_GROWTH_BONUS, UNREST_GROWTH_PENALTY,
  POPULATION_UNREST_THRESHOLD, WAR_POPULATION_LOSS_RATE, POPULATION_FLOOR_RATIO, POPULATION_CAP_RATIO,
  PEOPLE_BY_SIZE, sizeToPeople, logisticGrowthMult, peopleOf, foodForPeople, GROWTH_HEADROOM
} from './population';
import { drawPeople, addPeople, growthThreshold } from './world/cities';

describe('getPopulationGrowthRate', () => {
  it('is just the base trickle for an undeveloped, calm region', () => {
    expect(getPopulationGrowthRate({})).toBe(BASE_GROWTH);
  });

  it('adds one FOOD_TIER_GROWTH_BONUS per Food building tier built (counting from 1, not the 0-based tier index)', () => {
    const noFood = getPopulationGrowthRate({ foodTier: -1 });
    const tier0 = getPopulationGrowthRate({ foodTier: 0 });
    const tier2 = getPopulationGrowthRate({ foodTier: 2 });
    expect(tier0 - noFood).toBeCloseTo(FOOD_TIER_GROWTH_BONUS, 10);
    expect(tier2 - noFood).toBeCloseTo(FOOD_TIER_GROWTH_BONUS * 3, 10);
  });

  it('adds INFRA_GROWTH_BONUS per infrastructure level', () => {
    const none = getPopulationGrowthRate({ infrastructure: 0 });
    const five = getPopulationGrowthRate({ infrastructure: 5 });
    expect(five - none).toBeCloseTo(INFRA_GROWTH_BONUS * 5, 10);
  });

  it('adds a government/policy/wonder popGrowthBonus straight through', () => {
    const base = getPopulationGrowthRate({});
    const boosted = getPopulationGrowthRate({ popGrowthBonus: 0.01 });
    expect(boosted - base).toBeCloseTo(0.01, 10);
  });

  it('applies no unrest penalty at or below the threshold', () => {
    const atThreshold = getPopulationGrowthRate({ unrest: POPULATION_UNREST_THRESHOLD });
    expect(atThreshold).toBe(BASE_GROWTH);
  });

  it('applies UNREST_GROWTH_PENALTY once unrest exceeds the threshold', () => {
    const overThreshold = getPopulationGrowthRate({ unrest: POPULATION_UNREST_THRESHOLD + 1 });
    expect(BASE_GROWTH - overThreshold).toBeCloseTo(UNREST_GROWTH_PENALTY, 10);
  });

  it('combines every lever additively', () => {
    const rate = getPopulationGrowthRate({ foodTier: 1, infrastructure: 4, popGrowthBonus: 0.002, unrest: 80 });
    const expected = BASE_GROWTH + 2 * FOOD_TIER_GROWTH_BONUS + 4 * INFRA_GROWTH_BONUS + 0.002 - UNREST_GROWTH_PENALTY;
    expect(rate).toBeCloseTo(expected, 10);
  });
});

describe('nextRegionPopulation', () => {
  it('grows logistically: r P (1 - P / K), K = baseline x POPULATION_CAP_RATIO', () => {
    const next = nextRegionPopulation({ currentPopulation: 1000, modernBaseline: 1000, growthRate: 0.01, underInvasion: false });
    expect(next).toBeCloseTo(1000 + 0.01 * 1000 * (1 - 1 / POPULATION_CAP_RATIO), 5);
    const half = nextRegionPopulation({ currentPopulation: 2500, modernBaseline: 1000, growthRate: 0.01, underInvasion: false });
    expect(half - 2500).toBeCloseTo(0.01 * 2500 * 0.5, 5);
  });

  it('loses population at WAR_POPULATION_LOSS_RATE when under invasion, regardless of growth rate', () => {
    const next = nextRegionPopulation({ currentPopulation: 1000, modernBaseline: 1000, growthRate: 0.05, underInvasion: true });
    expect(next).toBeCloseTo(1000 * (1 - WAR_POPULATION_LOSS_RATE), 5);
  });

  it('never grows past POPULATION_CAP_RATIO times the modern baseline', () => {
    const next = nextRegionPopulation({ currentPopulation: 1000 * POPULATION_CAP_RATIO, modernBaseline: 1000, growthRate: 0.5, underInvasion: false });
    expect(next).toBe(1000 * POPULATION_CAP_RATIO);
  });

  it('never falls below POPULATION_FLOOR_RATIO times the modern baseline even under sustained war losses', () => {
    let population = 1000 * POPULATION_FLOOR_RATIO * 1.001;
    for (let i = 0; i < 20; i++) {
      population = nextRegionPopulation({ currentPopulation: population, modernBaseline: 1000, growthRate: 0, underInvasion: true });
    }
    expect(population).toBeGreaterThanOrEqual(1000 * POPULATION_FLOOR_RATIO);
  });

  it('is a no-op when the region has no modern baseline to clamp against', () => {
    const next = nextRegionPopulation({ currentPopulation: 500, modernBaseline: 0, growthRate: 0.5, underInvasion: false });
    expect(next).toBe(500);
  });
});

describe('people from size (one population model)', () => {
  it('keeps the old 1,000 x size^2.8 curve as an integer table', () => {
    for (let size = 1; size < PEOPLE_BY_SIZE.length; size++) expect(sizeToPeople(size)).toBe(Math.round(1000 * size ** 2.8));
    expect(sizeToPeople(0)).toBe(1000);
    expect(sizeToPeople(99)).toBe(PEOPLE_BY_SIZE[PEOPLE_BY_SIZE.length - 1]);
  });

  it('interpolates people by the food bank between two sizes', () => {
    const t = growthThreshold(3);
    expect(peopleOf({ size: 3, food: 0 }, t)).toBe(PEOPLE_BY_SIZE[3]);
    expect(peopleOf({ size: 3, food: t / 2 }, t)).toBe(Math.round((PEOPLE_BY_SIZE[3] + PEOPLE_BY_SIZE[4]) / 2));
  });
});

describe('logisticGrowthMult', () => {
  it('is near 1 for a small city, falls smoothly as size nears housing, and is 0 past the soft cap', () => {
    const housing = 5;
    const m = [1, 2, 3, 4, 5, 6, 7].map((s) => logisticGrowthMult(s, housing));
    expect(m[0]).toBeGreaterThan(0.95);
    for (let i = 1; i < m.length; i++) expect(m[i]).toBeLessThanOrEqual(m[i - 1]);
    expect(logisticGrowthMult(housing, housing)).toBeGreaterThan(0.25);
    expect(logisticGrowthMult(housing + 1, housing)).toBeGreaterThan(0);
    expect(logisticGrowthMult(housing + GROWTH_HEADROOM, housing)).toBe(0);
    expect(logisticGrowthMult(housing + 2, housing)).toBe(0);
  });

  it('a higher housing (a Granary, an aqueduct) raises growth at the same size', () => {
    expect(logisticGrowthMult(5, 6)).toBeGreaterThan(logisticGrowthMult(5, 4));
  });
});

describe('drawPeople and addPeople', () => {
  const city = { size: 4, food: 30 };
  it('a levy costs food, never a size', () => {
    const t = growthThreshold(4);
    const next = drawPeople(city, 10000);
    expect(next.size).toBe(4);
    expect(next.food).toBeCloseTo(30 - foodForPeople(4, 10000, t), 1);
    const huge = drawPeople(city, 1e7);
    expect(huge.size).toBe(4);
    expect(huge.food).toBe(0);
  });

  it('a plague (canShrink) can cost whole sizes, down to 1', () => {
    const next = drawPeople({ size: 6, food: 0 }, PEOPLE_BY_SIZE[6] - PEOPLE_BY_SIZE[4] - 1000, { canShrink: true });
    expect(next.size).toBe(4);
    const all = drawPeople({ size: 6, food: 0 }, 1e9, { canShrink: true });
    expect(all.size).toBe(1);
  });

  it('is a no-op for nothing and for a size-less record', () => {
    expect(drawPeople(city, 0)).toBe(city);
    const legacy = { currentPopulation: 5 };
    expect(drawPeople(legacy, 100)).toBe(legacy);
  });

  it('new people go into the food bank, short of the next threshold', () => {
    const t = growthThreshold(4);
    const next = addPeople(city, 5000);
    expect(next.food).toBeGreaterThan(30);
    expect(addPeople(city, 1e9).food).toBeLessThan(t);
  });
});
