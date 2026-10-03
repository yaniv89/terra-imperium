// src/engine/districts.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import { loadTiles } from '../data/geo/tiles';
import { emptyWorld, foundCity, queueItem, productionCost, processCity, cityYields, allocateTiles } from './world/cities';
import { districtSite, districtsOf, districtYields, adjacencyOf, hasDistrict, repairedDistrict, DISTRICT_BASE, DISTRICT_REPAIR_TURNS, DISTRICTS } from './districts';
import { tileFacts, canImprove } from '../data/tileYields';
import { pillageTile } from './threat';

let tiles;
beforeAll(async () => { tiles = await loadTiles(); });
const ctx = (over = {}) => ({ researched: [], ageId: 'bronze', turnNumber: 1, citiesOwned: 1, luxuries: 0, ...over });

describe('districts as tiles (plan C3.4)', () => {
  it('a Library lays out a Campus on the best free tile of the border, once, and it pays science', () => {
    let { world, city } = foundCity(emptyWorld(), tiles, { nationId: 'fr', tile: tiles.capitals.fr, name: 'Paris', size: 4, isCapital: true });
    expect(hasDistrict(world, city, 'science')).toBe(false);
    const site = districtSite(tiles, world, city, 'science');
    expect(site).not.toBeNull();
    expect(city.tiles).toContain(site);
    expect(site).not.toBe(city.tile);
    // Every other free tile of the border scores no better.
    const score = (t) => adjacencyOf(tiles, world, t, 'science', city) * 10 + (tiles.neighbors[city.tile].includes(t) ? 1 : 0);
    city.tiles.filter((t) => t !== city.tile && tiles.land[t] === 1 && tiles.reliefOf(t) !== 'mountains').forEach((t) => expect(score(t)).toBeLessThanOrEqual(score(site)));
    const before = cityYields(city, tiles, world, allocateTiles(city, tiles, world, []), []).science;
    city = { ...city, buildings: { ...city.buildings, categories: { ...city.buildings.categories, science: -1 } } };
    city = queueItem(city, { kind: 'building', category: 'science', tier: 0 });
    const cost = productionCost({ kind: 'building', category: 'science', tier: 0 });
    city = { ...city, production: { ...city.production, progress: cost } };
    const r = processCity(world, tiles, city, ctx());
    world = r.world; city = r.city;
    expect(city.buildings.categories.science).toBe(0);
    expect(world.tileState[site]?.district).toBe('science');
    expect(r.logs.some((l) => /Campus/.test(l))).toBe(true);
    const ds = districtsOf(tiles, world, city);
    expect(ds).toEqual([expect.objectContaining({ kind: 'science', tile: site, pillaged: false, yield: 'science' })]);
    expect(ds[0].amount).toBe(DISTRICT_BASE + adjacencyOf(tiles, world, site, 'science', city));
    const after = cityYields(city, tiles, world, allocateTiles(city, tiles, world, []), []).science;
    expect(after - before).toBeCloseTo(ds[0].amount + 2, 5); // the Library's own +2 tech points and the Campus
    // A second tier adds no second Campus; the tile takes no improvement.
    city = queueItem({ ...city, buildings: { ...city.buildings, categories: { ...city.buildings.categories, science: 0 } } }, { kind: 'building', category: 'science', tier: 1 });
    city = { ...city, production: { ...city.production, progress: productionCost({ kind: 'building', category: 'science', tier: 1 }) } };
    const r2 = processCity(world, tiles, city, ctx({ researched: ['governance_royal_chancery'] }));
    expect(districtsOf(tiles, r2.world, r2.city).length).toBe(1);
    expect(canImprove(tileFacts(tiles, site, r2.world.tileState[site]), 'farm')).toBe(false);
    expect(tileFacts(tiles, site, r2.world.tileState[site]).district).toBe('science');
  });

  it('a pillaged district pays nothing and is rebuilt after the repair turns', () => {
    let { world, city } = foundCity(emptyWorld(), tiles, { nationId: 'fr', tile: tiles.capitals.fr, name: 'Paris', size: 4, isCapital: true });
    const site = districtSite(tiles, world, city, 'economy');
    world = { ...world, tileState: { ...world.tileState, [site]: { district: 'economy' } } };
    expect(districtYields(tiles, world, city).gold).toBeGreaterThanOrEqual(DISTRICT_BASE);
    const state = { world, regions: { [city.id]: { ...city, owner: 'fr' } }, nations: { fr: {}, gb: {} }, turnNumber: 10 };
    const raid = pillageTile(state, 'gb', site, new Set(['fr']));
    expect(raid).not.toBeNull();
    expect(raid.tileState[site].pillaged).toBe(true);
    const burnt = { ...world, tileState: raid.tileState };
    expect(districtYields(tiles, burnt, city).gold).toBe(0);
    expect(repairedDistrict(burnt.tileState[site], 10 + DISTRICT_REPAIR_TURNS - 1)).toBe(burnt.tileState[site]);
    const r = processCity(burnt, tiles, city, ctx({ turnNumber: 10 + DISTRICT_REPAIR_TURNS }));
    expect(r.world.tileState[site].pillaged).toBe(false);
    expect(districtYields(tiles, r.world, city).gold).toBeGreaterThanOrEqual(DISTRICT_BASE);
  });

  it('every district kind names a building line and a yield', () => {
    Object.values(DISTRICTS).forEach((d) => { expect(['science', 'culture', 'economy']).toContain(d.line); expect(['science', 'culture', 'gold']).toContain(d.yield); expect(d.glyph).toHaveLength(1); });
  });
});
