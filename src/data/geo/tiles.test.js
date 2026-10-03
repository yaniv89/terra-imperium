// Workstream 1 acceptance (plans/civ-map-rework.md, Part K row 1): the shipped grid is the right
// size and shape, every nation has a capital on its own land, rivers run on land, and the
// lookups agree with the geometry.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadTiles } from './tiles';
import { cellCount } from './geodesic';
import countriesMeta from './countries-meta.json';

let tiles;
beforeAll(async () => { tiles = await loadTiles(); });

describe('world grid', () => {
  it('is a frequency-75 geodesic grid with 12 pentagons', () => {
    expect(tiles.count).toBe(cellCount(75));
    expect(tiles.count).toBe(56252);
    const pentagons = tiles.neighbors.filter((ns) => ns.length === 5).length;
    expect(pentagons).toBe(12);
    expect(tiles.neighbors.every((ns) => ns.length === 5 || ns.length === 6)).toBe(true);
  });

  it('has symmetric neighbours', () => {
    let bad = 0;
    tiles.neighbors.forEach((ns, i) => ns.forEach((j) => { if (!tiles.neighbors[j].includes(i)) bad++; }));
    expect(bad).toBe(0);
  });

  it('is about 29% land, within the real 27 to 31%', () => {
    const land = tiles.land.reduce((a, b) => a + b, 0);
    expect(land / tiles.count).toBeGreaterThan(0.27);
    expect(land / tiles.count).toBeLessThan(0.31);
  });

  it('keeps pentagons off important land', () => {
    const onLand = tiles.neighbors.map((ns, i) => i).filter((i) => tiles.neighbors[i].length === 5 && tiles.land[i] && tiles.latLonOf(i).lat > -60);
    expect(onLand.length).toBeLessThanOrEqual(1);
  });

  it('gives every one of the 240 nations a unique capital tile on its own land', () => {
    const ids = Object.keys(countriesMeta);
    expect(ids.length).toBe(240);
    ids.forEach((cid) => {
      const tile = tiles.capitals[cid];
      expect(tile, cid).toBeGreaterThanOrEqual(0);
      expect(tiles.land[tile], `${cid} capital on land`).toBe(1);
      expect(tiles.countryOf(tile), `${cid} capital owner`).toBe(cid);
      expect(tiles.countryTiles[cid].length, `${cid} has land`).toBeGreaterThan(0);
    });
    const all = Object.values(tiles.capitals);
    expect(new Set(all).size).toBe(all.length);
  });

  it('places known capitals on the right tile', () => {
    const near = (cid, lat, lon) => {
      const p = tiles.latLonOf(tiles.capitals[cid]);
      const d = Math.hypot(p.lat - lat, (p.lon - lon) * Math.cos((lat * Math.PI) / 180));
      expect(d, cid).toBeLessThan(1.6); // within about one cell
    };
    near('eg', 30.06, 31.25); near('fr', 48.86, 2.35); near('jp', 35.68, 139.69); near('us', 38.9, -77.04); near('br', -15.79, -47.88);
  });

  it('classifies famous places correctly', () => {
    const at = (lat, lon) => tiles.nearest(lat, lon);
    expect(tiles.terrainOf(at(27.98, 86.92))).not.toBe('ocean');
    expect(tiles.reliefOf(at(27.98, 86.92))).toBe('mountains'); // Everest
    expect(tiles.terrainOf(at(23.4, 25.6))).toBe('desert'); // deep Sahara
    expect(tiles.land[at(0, -140)]).toBe(0); // mid Pacific
    expect(tiles.terrainOf(at(0, -140))).toBe('ocean');
    expect(['snow', 'tundra']).toContain(tiles.terrainOf(at(72, -40))); // Greenland ice sheet
    expect(['grassland', 'plains']).toContain(tiles.terrainOf(at(49, 2))); // northern France
    expect(tiles.terrainOf(at(-3, -60))).toBe('grassland'); // Amazon
    expect(tiles.featureOf(at(-3, -60))).toBe('jungle');
  });

  it('runs rivers on land edges only, with the Nile and the Danube present', () => {
    let waterOnly = 0;
    tiles.rivers.forEach((mask, i) => {
      if (!mask) return;
      tiles.neighbors[i].forEach((j, k) => { if (mask & (1 << k) && !tiles.land[i] && !tiles.land[j]) waterOnly++; });
    });
    expect(waterOnly).toBe(0);
    const names = Object.values(tiles.riverNames);
    expect(names).toContain('Nile');
    expect(names).toContain('Danube');
    const nileCells = Object.entries(tiles.riverNames).filter(([, n]) => n === 'Nile').length;
    expect(nileCells).toBeGreaterThan(15);
  });

  it('answers nearest-tile queries and builds hexagon polygons', () => {
    const id = tiles.nearest(48.85, 2.35);
    const p = tiles.latLonOf(id);
    expect(Math.abs(p.lat - 48.85)).toBeLessThan(1.2);
    const poly = tiles.polygonOf(id);
    expect(poly.length).toBe(tiles.neighbors[id].length);
    const two = tiles.nearest(48.85, 2.35, 2);
    expect(two[0]).toBe(id);
    expect(tiles.neighbors[id]).toContain(two[1]);
  });

  it('names the big cities', () => {
    expect(Object.values(tiles.names)).toContain('Cairo');
    expect(Object.values(tiles.names)).toContain('Tokyo');
    expect(Object.keys(tiles.names).length).toBeGreaterThan(4000);
  });
});
