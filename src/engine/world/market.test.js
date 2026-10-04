import { describe, it, expect } from 'vitest';
import { centralPlaceBonus, capitalFoodFor, marketKernel, marketHousingFor, marketAccess, applyMarketHousing, MARKET_KM, MARKET_REACH_KM, MARKET_PER_HOUSING, MARKET_HOUSING_MAX, CAPITAL_HOUSING, CAPITAL_HOUSING_MAX } from './market';
import { housingOf } from './cities';
import { getTiles } from '../../data/geo/tiles';
import { distanceKm } from '../../data/geo/geodesic';

const tiles = getTiles();
// A cluster of cities hex-steps apart around a French tile, plus one far away in Australia.
const build = () => {
  const cities = {};
  let t = tiles.countryTiles.fr[0];
  for (let k = 0; k < 6; k++) {
    cities[`c${k}`] = { id: `c${k}`, owner: k < 3 ? 'a' : 'b', tile: t, size: 2 + k, isCapital: k === 0 };
    t = tiles.neighbors[tiles.neighbors[t][0]][0];
  }
  cities.far = { id: 'far', owner: 'au', tile: tiles.countryTiles.au[0], size: 3 };
  return cities;
};

describe('market access', () => {
  it('the kernel falls with km and ends at the reach', () => {
    expect(marketKernel(0)).toBe(1);
    expect(marketKernel(MARKET_KM)).toBeCloseTo(0.5, 10);
    expect(marketKernel(MARKET_REACH_KM + 1)).toBe(0);
  });
  it('sums own size and nearby sizes by km, exactly as the brute-force sum', () => {
    const cities = build();
    const ma = marketAccess(cities, tiles);
    Object.values(cities).forEach((c) => {
      let brute = 0;
      Object.values(cities).forEach((d) => { if (d !== c) brute += d.size * marketKernel(distanceKm(tiles.centres[c.tile], tiles.centres[d.tile])); });
      expect(ma.get(c.id)).toBeCloseTo(brute, 9);
    });
    expect(ma.get('far')).toBe(0); // alone: only itself
  });
  it('housing grows with access, is capped, and a capital of a bigger nation houses more', () => {
    expect(marketHousingFor(MARKET_PER_HOUSING - 0.01)).toBe(0);
    expect(marketHousingFor(MARKET_PER_HOUSING * 2)).toBe(2);
    expect(marketHousingFor(1e6)).toBe(MARKET_HOUSING_MAX);
    expect(marketHousingFor(0, { isCapital: true, citiesOwned: 1 })).toBe(CAPITAL_HOUSING);
    expect(marketHousingFor(0, { isCapital: true, citiesOwned: 5 })).toBeGreaterThan(CAPITAL_HOUSING);
    expect(marketHousingFor(0, { isCapital: true, citiesOwned: 500 })).toBe(CAPITAL_HOUSING_MAX);
  });
  it('central places: a rank hierarchy, nothing below the top few dozen; capitals fed by their provinces', () => {
    expect(centralPlaceBonus(1)).toEqual({ housing: 12, food: 8 });
    expect(centralPlaceBonus(4)).toEqual({ housing: 6, food: 4 });
    expect(centralPlaceBonus(200)).toEqual({ housing: 0, food: 0 });
    expect(capitalFoodFor({ isCapital: false, citiesOwned: 9 })).toBe(0);
    expect(capitalFoodFor({ isCapital: true, citiesOwned: 1 })).toBe(0);
    expect(capitalFoodFor({ isCapital: true, citiesOwned: 5 })).toBe(2);
  });
  it('applyMarketHousing writes only changed cities, and housingOf reads it', () => {
    const cities = build();
    const before = { ...cities };
    const n = applyMarketHousing(cities, tiles);
    expect(n).toBeGreaterThan(0);
    expect(cities.c0.marketHousing).toBeGreaterThanOrEqual(CAPITAL_HOUSING);
    expect(housingOf(cities.c0)).toBe(housingOf({ ...cities.c0, marketHousing: 0 }) + cities.c0.marketHousing);
    expect(before.far.marketFood).toBeUndefined();
    const again = { ...cities };
    expect(applyMarketHousing(again, tiles)).toBe(0);
  });
});
