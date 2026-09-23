import { describe, it, expect } from 'vitest';
import {
  getPopulationGrowthRate, nextRegionPopulation,
  BASE_GROWTH, FOOD_TIER_GROWTH_BONUS, INFRA_GROWTH_BONUS, UNREST_GROWTH_PENALTY,
  POPULATION_UNREST_THRESHOLD, WAR_POPULATION_LOSS_RATE, POPULATION_FLOOR_RATIO, POPULATION_CAP_RATIO
} from './population';

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
  it('grows by the growth rate when not under invasion', () => {
    const next = nextRegionPopulation({ currentPopulation: 1000, modernBaseline: 1000, growthRate: 0.01, underInvasion: false });
    expect(next).toBeCloseTo(1010, 5);
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
