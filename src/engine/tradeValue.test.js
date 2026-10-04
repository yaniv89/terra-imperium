import { describe, it, expect } from 'vitest';
import { gravityMult, softCap, TRADE_GRAVITY_G, TRADE_DISTANCE_KM, TRADE_ROUTE_MAX_MULT, economySizes, routeKm, pathKm, tileKm } from './tradeValue';
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';

describe('tile km', () => {
  const tiles = getTiles();
  it('is the shared exact great-circle distance', () => {
    expect(tileKm(tiles, 0, 500)).toBe(distanceKm(tiles.centres[0], tiles.centres[500]));
  });
  it('sums a path and handles missing tiles', () => {
    const t = 1000; const n = tiles.neighbors[t][0];
    expect(pathKm(tiles, [t, n])).toBeCloseTo(tileKm(tiles, t, n), 6);
    expect(pathKm(tiles, [t])).toBe(0);
    expect(tileKm(tiles, null, t)).toBe(Infinity);
  });
});

describe('gravityMult', () => {
  it('an equal partner at TRADE_DISTANCE_KM is worth about G / 2 (the old +5%)', () => {
    expect(gravityMult(10, 10, TRADE_DISTANCE_KM)).toBeCloseTo(softCap(TRADE_GRAVITY_G / 2, TRADE_ROUTE_MAX_MULT), 10);
    expect(gravityMult(10, 10, TRADE_DISTANCE_KM)).toBeGreaterThan(0.045);
    expect(gravityMult(10, 10, TRADE_DISTANCE_KM)).toBeLessThan(0.055);
  });
  it('grows with the partner economy and falls with distance', () => {
    expect(gravityMult(10, 40, 1000)).toBeGreaterThan(gravityMult(10, 10, 1000));
    expect(gravityMult(10, 10, 300)).toBeGreaterThan(gravityMult(10, 10, 3000));
  });
  it('never exceeds the per-route cap, and is 0 without an economy or a route', () => {
    expect(gravityMult(1, 1e6, 0)).toBeLessThan(TRADE_ROUTE_MAX_MULT);
    expect(gravityMult(0, 10, 100)).toBe(0);
    expect(gravityMult(10, 0, 100)).toBe(0);
    expect(gravityMult(10, 10, Infinity)).toBe(0);
  });
});

describe('economySizes and routeKm', () => {
  it('sums city sizes per owner, skipping outposts and occupied cities', () => {
    const state = { regions: { a: { owner: 'x', size: 3 }, b: { owner: 'x', size: 2 }, c: { owner: 'x', size: 5, outpost: {} }, d: { owner: 'y', size: 4, occupiedBy: 'x' } } };
    expect(economySizes(state).get('x')).toBe(5);
    expect(economySizes(state).get('y')).toBeUndefined();
  });
  it('a land route is its tile path; a sea route charges the crossing at half', () => {
    const tiles = getTiles();
    const state = { regions: { a: { tile: 100 }, b: { tile: 2000 }, p: { tile: 300 }, q: { tile: 1800 } }, nations: { x: { capitalRegionId: 'a' }, y: { capitalRegionId: 'b' } } };
    const land = { ok: true, kind: 'land', tiles: [100, tiles.neighbors[100][0]] };
    expect(routeKm(state, 'x', 'y', land)).toBeCloseTo(pathKm(tiles, land.tiles), 6);
    const sea = { ok: true, kind: 'sea', regions: ['p', 'q'] };
    expect(routeKm(state, 'x', 'y', sea)).toBeCloseTo(tileKm(tiles, 100, 300) + tileKm(tiles, 2000, 1800) + 0.5 * tileKm(tiles, 300, 1800), 6);
    expect(routeKm(state, 'x', 'y', null)).toBeCloseTo(tileKm(tiles, 100, 2000), 6);
  });
});
