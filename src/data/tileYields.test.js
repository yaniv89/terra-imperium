import { describe, it, expect, beforeAll } from 'vitest';
import { loadTiles } from './geo/tiles';
import { tileFacts, tileYields, canImprove, strategicSupply, IMPROVEMENTS, RESOURCES_ON_TILES } from './tileYields';

let tiles;
beforeAll(async () => { tiles = await loadTiles(); });

const facts = (over) => ({ id: 0, land: true, terrain: 'grassland', relief: 'flat', feature: 'none', river: false, coastal: false, resource: null, improvement: null, pillaged: false, road: false, ...over });

describe('tile yields', () => {
  it('composes terrain, relief, feature, river, resource and improvement', () => {
    expect(tileYields(facts())).toEqual({ food: 2, production: 0, gold: 0 });
    expect(tileYields(facts({ relief: 'hills' }))).toEqual({ food: 1, production: 2, gold: 0 });
    expect(tileYields(facts({ terrain: 'desert', feature: 'floodplain', river: true }))).toEqual({ food: 3, production: 0, gold: 2 });
    expect(tileYields(facts({ terrain: 'plains', feature: 'forest' }))).toEqual({ food: 1, production: 2, gold: 0 });
    expect(tileYields(facts({ resource: 'wheat' }))).toEqual({ food: 3, production: 0, gold: 0 });
    expect(tileYields(facts({ resource: 'wheat', improvement: 'farm' }))).toEqual({ food: 5, production: 0, gold: 0 });
    expect(tileYields(facts({ resource: 'wheat', improvement: 'farm', pillaged: true }))).toEqual({ food: 3, production: 0, gold: 0 });
    expect(tileYields(facts({ resource: 'wheat', improvement: 'farm' }), ['infrastructure_canal_locks'])).toEqual({ food: 6, production: 0, gold: 0 });
  });

  it('makes mountains worthless unless mined, and never goes negative', () => {
    expect(tileYields(facts({ relief: 'mountains' }))).toEqual({ food: 0, production: 0, gold: 0 });
    expect(tileYields(facts({ relief: 'mountains', resource: 'gold', improvement: 'mine' })).gold).toBeGreaterThan(0);
    expect(tileYields(facts({ terrain: 'snow', feature: 'ice' }))).toEqual({ food: 0, production: 0, gold: 0 });
    expect(tileYields(facts({ land: false, terrain: 'coast' }))).toEqual({ food: 1, production: 0, gold: 1 });
  });

  it('gates improvements by tile and tech', () => {
    expect(canImprove(facts(), 'farm')).toBe(true);
    expect(canImprove(facts({ relief: 'hills' }), 'mine')).toBe(false);
    expect(canImprove(facts({ relief: 'hills' }), 'mine', ['military_bronze_casting'])).toBe(true);
    expect(canImprove(facts({ terrain: 'desert' }), 'farm')).toBe(false);
    expect(canImprove(facts({ terrain: 'desert', feature: 'floodplain' }), 'farm')).toBe(true);
    expect(canImprove(facts({ resource: 'horses' }), 'pasture')).toBe(true);
    expect(canImprove(facts({ land: false, terrain: 'coast' }), 'fishing_boats', ['economy_bronze_trade_routes'])).toBe(true);
    Object.values(IMPROVEMENTS).forEach((imp) => expect(typeof imp.allowed).toBe('function'));
  });

  it('counts strategic resources only from the right improvement', () => {
    expect(strategicSupply(facts({ resource: 'iron' }))).toBeNull();
    expect(strategicSupply(facts({ resource: 'iron', improvement: 'mine' }))).toEqual({ resource: 'iron', amount: 1 });
    expect(strategicSupply(facts({ resource: 'iron', improvement: 'mine' }), ['economy_industrial_capital'])).toEqual({ resource: 'iron', amount: 2 });
    expect(strategicSupply(facts({ resource: 'wheat', improvement: 'farm' }))).toBeNull();
  });

  it('places resources on the real grid, every one known to the table, with the curated deposits', () => {
    let count = 0;
    for (let i = 0; i < tiles.count; i++) {
      const r = tiles.resourceOf(i);
      if (!r) continue;
      count++;
      expect(RESOURCES_ON_TILES[r], r).toBeDefined();
      if (!tiles.land[i]) expect(['fish', 'whales']).toContain(r);
    }
    const land = tiles.land.reduce((a, b) => a + b, 0);
    expect(count / land).toBeGreaterThan(0.3);
    expect(count / land).toBeLessThan(0.6);
    const has = (cid, res) => tiles.countryTiles[cid].some((i) => tiles.resourceOf(i) === res);
    expect(has('sa', 'oil')).toBe(true); expect(has('cl', 'copper')).toBe(true); expect(has('se', 'iron')).toBe(true); expect(has('us', 'iron')).toBe(true);
    // The Nile floodplain works: a floodplain tile with a river in Egypt
    const nile = tiles.countryTiles.eg.find((i) => tiles.featureOf(i) === 'floodplain' && tiles.rivers[i]);
    expect(nile).toBeDefined();
    expect(tileYields(tileFacts(tiles, nile)).food).toBeGreaterThanOrEqual(3);
  });
});
