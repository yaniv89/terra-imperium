// src/data/scenarios.spread.test.js
// Start capitals spread so towns never stand on each other (scenarios.js spreadCapitals).
import { describe, it, expect } from 'vitest';
import { getTiles } from './geo/tiles';
import { spreadCapitals, ringsFrom, START_SPACING_MIN } from './scenarios';

describe('start capitals', () => {
  const tiles = getTiles();
  const ids = Object.keys(tiles.capitals).filter((id) => tiles.capitals[id] != null);
  const out = spreadCapitals(tiles, ids);

  it('moves a crowded capital within its own land, a few rings at most', () => {
    const moved = ids.filter((id) => out[id] !== tiles.capitals[id]);
    expect(moved.length).toBeGreaterThan(5);
    moved.forEach((id) => {
      expect(tiles.countryOf(out[id])).toBe(id);
      expect(ringsFrom(tiles, tiles.capitals[id], 4).has(out[id])).toBe(true);
    });
    // the big lands keep their real capitals
    ['fr', 'de', 'cn', 'us', 'ru', 'eg', 'it'].forEach((id) => expect(out[id]).toBe(tiles.capitals[id]));
  });

  it('leaves only lands with no room at all (one-tile islands, enclaves) closer than the minimum', () => {
    const close = new Set();
    const size = (id) => (tiles.countryTiles[id] || []).length;
    ids.forEach((id) => {
      const near = ringsFrom(tiles, out[id], START_SPACING_MIN - 1);
      ids.forEach((o) => {
        if (o === id || !near.has(out[o])) return;
        close.add(id);
        // in every pair still touching, the smaller land has no room to move (an island, an enclave)
        expect(Math.min(size(id), size(o))).toBeLessThanOrEqual(4);
      });
    });
    // e.g. Jerusalem, Ramallah and Amman no longer touch
    ['il', 'ps', 'jo', 'lb', 'sy'].forEach((id) => expect(close.has(id)).toBe(false));
  });

  it('is the same every time', () => {
    expect(spreadCapitals(tiles, [...ids].reverse())).toEqual(out);
  });
});
