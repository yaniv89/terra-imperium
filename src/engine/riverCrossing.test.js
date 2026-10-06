// src/engine/riverCrossing.test.js
// Phase F movement rules (armies.js): river crossings by size in km of march, road edges and
// Stone Bridges, and mountain passes at the hills cost.
import { describe, it, expect } from 'vitest';
import { getTiles } from '../data/geo/tiles';
import { kmPerRing } from '../data/geo/gridScale';
import { riverEdgeList } from '../data/geo/terrainData';
import { RIVER_CROSSING, RIVER_CROSSING_KM, TILE_COST_MOUNTAINS, BRIDGE_TECH, riverCrossingCost, tileStepCost, findTilePath } from './armies';

const tiles = getTiles();
const S = { world: { tileOwner: {}, tileState: {} }, regions: {}, nations: {}, wars: [], units: {} };
const quarter = (km) => Math.max(0.25, Math.round((km / kmPerRing()) * 4) / 4);

describe('river crossings', () => {
  it('cost the march of RIVER_CROSSING_KM by size, in quarter points', () => {
    expect(riverCrossingCost(0)).toBe(0);
    [1, 2, 3].forEach((size) => expect(riverCrossingCost(size)).toBe(quarter(RIVER_CROSSING_KM[size])));
    expect(riverCrossingCost(1)).toBeLessThan(riverCrossingCost(2));
    expect(riverCrossingCost(2)).toBeLessThan(riverCrossingCost(3));
    expect(RIVER_CROSSING).toBe(riverCrossingCost(2));
    // frequency 100: about 77 km a ring, so a stream half a point, a river one, a great river two
    expect([riverCrossingCost(1), riverCrossingCost(2), riverCrossingCost(3)]).toEqual([0.5, 1, 2]);
  });

  it('halve on a road edge, and Stone Bridges make a road edge free and halve the rest', () => {
    expect(riverCrossingCost(3, { roadEdge: true })).toBe(riverCrossingCost(3) / 2);
    expect(riverCrossingCost(3, { bridges: true })).toBe(riverCrossingCost(3) / 2);
    expect(riverCrossingCost(3, { roadEdge: true, bridges: true })).toBe(0);
  });

  it('price a step across each river edge by that edge\'s size', () => {
    const great = riverEdgeList().find((e) => e.size === 3 && tiles.land[e.a] && tiles.land[e.b] && tiles.reliefOf(e.b) === 'flat' && tiles.featureOf(e.b) === 'none' && ['grassland', 'plains'].includes(tiles.terrainOf(e.b)));
    const open = tileStepCost(S, tiles, null, great.b);
    expect(tileStepCost(S, tiles, great.a, great.b)).toBe(open + riverCrossingCost(3));
    expect(tileStepCost(S, tiles, great.a, great.b, 'wild', [BRIDGE_TECH])).toBe(open + riverCrossingCost(3) / 2);
    // a road on both banks: the step is a road step, and the crossing half price
    const roads = { ...S, world: { ...S.world, tileState: { [great.a]: { road: true }, [great.b]: { road: true } } } };
    expect(tileStepCost(roads, tiles, great.a, great.b)).toBe(tileStepCost(roads, tiles, null, great.b) + riverCrossingCost(3) / 2);
  });

  it('lets the path search route around a great river when a bridge is far', () => {
    // two tiles on opposite banks of a great river: the path cost includes a crossing somewhere
    const e = riverEdgeList().find((x) => x.size === 3 && tiles.land[x.a] && tiles.land[x.b] && tiles.terrainOf(x.a) !== 'snow' && tiles.terrainOf(x.b) !== 'snow');
    const r = findTilePath(S, e.a, e.b, 'xx');
    expect(r.path).toBeTruthy();
    expect(r.cost).toBeGreaterThan(0);
    expect(r.cost).toBeLessThanOrEqual(tileStepCost(S, tiles, e.a, e.b) + 1e-9);
  });
});

describe('mountain passes', () => {
  it('cost what hills cost, while other mountains cost TILE_COST_MOUNTAINS', () => {
    const pass = [...Array(tiles.count).keys()].find((t) => tiles.isPass(t) && tiles.featureOf(t) === 'none' && !['desert', 'tundra'].includes(tiles.terrainOf(t)));
    const peak = [...Array(tiles.count).keys()].find((t) => tiles.land[t] && tiles.reliefOf(t) === 'mountains' && !tiles.isPass(t));
    expect(tileStepCost(S, tiles, null, pass)).toBe(2);
    expect(tileStepCost(S, tiles, null, peak)).toBe(TILE_COST_MOUNTAINS);
  });
});
