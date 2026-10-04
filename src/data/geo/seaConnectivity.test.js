// The real seas reach the open ocean (plans/math/straits.md). The grid's hexes are far wider than
// Gibraltar or the Bosphorus, so scripts/geo/build-tiles.mjs carves the straits (STRAIT_LINES) and
// small inlets; this flood fill from the mid-Atlantic checks the result on whatever grid ships.
import { describe, it, expect } from 'vitest';
import { getTiles } from './tiles';
import { buildScenarioStarts, SCENARIO_IDS } from '../scenarios';

const tiles = getTiles();
const sea = (i) => tiles.land[i] !== 1 && tiles.terrainOf(i) !== 'lake';

// Sea components: id per cell (-1 for land and lakes).
const comp = new Int32Array(tiles.count).fill(-1);
const sizes = [];
for (let s = 0; s < tiles.count; s++) {
  if (!sea(s) || comp[s] >= 0) continue;
  const c = sizes.length; let size = 0; const stack = [s]; comp[s] = c;
  while (stack.length) { const i = stack.pop(); size++; tiles.neighbors[i].forEach((j) => { if (comp[j] < 0 && sea(j)) { comp[j] = c; stack.push(j); } }); }
  sizes.push(size);
}
const ocean = comp[tiles.nearest(0, -30)];
// A sea cell near a point (the probe sits in the middle of the sea, at any grid frequency).
const seaNear = (lat, lon) => tiles.nearest(lat, lon, 7).find(sea) ?? -1;

const SEAS = {
  'Western Mediterranean': [38, 5], 'Tyrrhenian Sea': [40, 12], 'Adriatic Sea': [43, 15], 'Ionian Sea': [37, 19],
  'Aegean Sea': [38.5, 25], 'Sea of Marmara': [40.75, 28], 'Black Sea': [43, 34], 'Sea of Azov': [46, 36.5],
  'North Sea': [56, 3], Kattegat: [57, 11.5], 'Baltic Sea': [56, 19], 'Gulf of Bothnia': [62, 20], 'Gulf of Finland': [59.9, 26.5],
  'Gulf of Riga': [57.7, 23.5], 'White Sea': [65.5, 37], 'Red Sea': [20, 38.5], 'Gulf of Aqaba': [28.7, 34.8], 'Gulf of Aden': [12.5, 47],
  'Persian Gulf': [27, 51], 'Gulf of Oman': [24.5, 58.5], 'Strait of Malacca': [3, 100.5], 'Gulf of Thailand': [10, 102],
  'South China Sea': [12, 113], 'Java Sea': [-5, 110], 'Sea of Japan': [40, 135], 'Yellow Sea': [36, 123], 'Bohai Sea': [38.8, 119.5],
  'Sea of Okhotsk': [53, 148], 'Bass Strait': [-39.5, 146], 'Gulf of Carpentaria': [-14, 139], 'Hudson Bay': [60, -85],
  'Gulf of St Lawrence': [48, -62], 'Gulf of Mexico': [25, -90], 'Caribbean Sea': [15, -75], 'Gulf of California': [27, -111],
  'Irish Sea': [53.8, -5], 'Baffin Bay': [73, -65], 'Kara Sea': [73, 65]
};

describe('sea connectivity', () => {
  it('every real sea reaches the open ocean', () => {
    const closed = Object.entries(SEAS).filter(([, [lat, lon]]) => { const c = seaNear(lat, lon); return c < 0 || comp[c] !== ocean; }).map(([name]) => name);
    expect(closed).toEqual([]);
  });

  it('the only water cut off from the ocean is a real landlocked sea (the Caspian)', () => {
    const caspian = comp[seaNear(42, 51)];
    expect(caspian).toBeGreaterThanOrEqual(0);
    expect(caspian).not.toBe(ocean);
    // The South Pole cell reads as water (the land polygon test misses the pole): not a sea.
    const pole = comp[tiles.nearest(-90, 0)];
    const others = sizes.map((_, c) => c).filter((c) => c !== ocean && c !== caspian && c !== pole);
    expect(others.map((c) => { const i = comp.indexOf(c); return `${sizes[c]} cells at ${tiles.lat[i] / 1000}, ${tiles.lon[i] / 1000}`; })).toEqual([]);
  });

  it('keeps every capital and every scenario start city on land', () => {
    Object.entries(tiles.capitals).forEach(([id, t]) => expect(tiles.land[t], `capital of ${id}`).toBe(1));
    SCENARIO_IDS.forEach((scenarioId) => {
      const { starts } = buildScenarioStarts(tiles, scenarioId);
      Object.entries(starts).forEach(([nationId, { cities }]) => cities.forEach(({ tile }) => expect(tiles.land[tile], `${scenarioId} city of ${nationId}`).toBe(1)));
    });
  });

  it('keeps the names of towns a strait took on land beside it', () => {
    ['Gibraltar', 'Çanakkale', 'Helsinki', 'St.  Petersburg', 'Maracaibo'].forEach((name) => {
      const at = Object.entries(tiles.names).filter(([, n]) => n === name).map(([t]) => Number(t));
      expect(at.length, name).toBeGreaterThan(0);
      at.forEach((t) => expect(tiles.land[t], name).toBe(1));
    });
  });
});
