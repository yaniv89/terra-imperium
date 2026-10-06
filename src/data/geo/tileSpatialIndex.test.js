// src/data/geo/tileSpatialIndex.test.js
import { describe, it, expect } from 'vitest';
import { getTiles } from './tiles';
import { tilesInWindow } from './tileSpatialIndex';

const scan = ({ south, north, west, east }, water = false) => {
  const tiles = getTiles(); const out = [];
  for (let i = 0; i < tiles.count; i++) {
    if (!water && !tiles.land[i]) continue;
    const la = tiles.lat[i] / 1000; const lo = tiles.lon[i] / 1000;
    if (la < south || la > north) continue;
    if (west <= east ? (lo < west || lo > east) : (lo < west && lo > east)) continue;
    out.push(i);
  }
  return out;
};

describe('the tile spatial index', () => {
  it('finds exactly the tiles a full scan finds, across the antimeridian too', () => {
    [
      { south: 40, north: 52, west: -6, east: 12 },
      { south: -10.5, north: 3.3, west: 100.1, east: 120.7 },
      { south: 50, north: 72, west: 170, east: -170 },
      { south: -90, north: 90, west: -180, east: 180 }
    ].forEach((w) => expect(tilesInWindow(w)).toEqual(scan(w)));
    const sea = { south: 30, north: 40, west: -40, east: -20 };
    expect(tilesInWindow(sea, { water: true }).length).toBe(scan(sea, true).length);
  });
});
