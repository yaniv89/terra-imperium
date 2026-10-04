// src/data/scenarios.spread.test.js
// Start capitals spread so towns never stand on each other (scenarios.js spreadCapitals).
import { describe, it, expect } from 'vitest';
import { getTiles } from './geo/tiles';
import { spreadCapitals, ringsFrom, startSpacing, buildScenarioStarts } from './scenarios';

describe('start capitals', () => {
  const tiles = getTiles();
  const ids = Object.keys(tiles.capitals).filter((id) => tiles.capitals[id] != null);
  const out = spreadCapitals(tiles, ids);

  it('moves a crowded capital only within its own land; the big lands keep theirs', () => {
    const moved = ids.filter((id) => out[id] !== tiles.capitals[id]);
    expect(moved.length).toBeGreaterThan(5);
    moved.forEach((id) => expect(tiles.countryOf(out[id])).toBe(id));
    ['fr', 'de', 'cn', 'us', 'ru', 'eg'].forEach((id) => expect(out[id]).toBe(tiles.capitals[id]));
  });

  it('keeps every capital START_SPACING_KM from every other unless its own land has no room', () => {
    const START_SPACING = startSpacing(tiles);
    const size = (id) => (tiles.countryTiles[id] || []).length;
    const crowded = new Set();
    ids.forEach((id) => {
      const near = ringsFrom(tiles, out[id], START_SPACING - 1);
      ids.forEach((o) => { if (o !== id && near.has(out[o])) crowded.add(size(id) <= size(o) ? id : o); });
    });
    // only small lands are left crowded, and Amman, Beirut, Damascus, Cairo are clear
    ['jo', 'lb', 'sy', 'fr', 'de', 'eg'].forEach((id) => expect(crowded.has(id)).toBe(false));
    crowded.forEach((id) => expect(size(id)).toBeLessThanOrEqual(12));
  });

  it('is the same every time', () => {
    expect(spreadCapitals(tiles, [...ids].reverse())).toEqual(out);
  });

  it('a moved capital keeps its real name', () => {
    const { starts } = buildScenarioStarts(tiles, 'dawn');
    const moved = ids.filter((id) => starts[id] && starts[id].capital !== tiles.capitals[id] && tiles.names[tiles.capitals[id]]);
    expect(moved.length).toBeGreaterThan(0);
    moved.forEach((id) => expect(starts[id].cities[0].name, id).toBe(tiles.names[tiles.capitals[id]]));
    expect(starts.fr.cities[0].name).toBeUndefined(); // unmoved: the tile's own name
  });
});
