import { describe, it, expect } from 'vitest';
import { getTiles } from '../data/geo/tiles';
import { paintTileData, coverBaseOf, FLAG_LAND, FLAG_LAKE } from './paintData';
import { LAND_COVER } from '../data/geo/rasterDetail';
import { tileGeo, PAINT_FRAGMENT } from '../components/map/gl/proceduralPaint';
import { DATA_W } from '../components/map/gl/tileGpuData';

const cls = (name) => LAND_COVER.indexOf(name);

describe('GPU painter inputs (MV4)', () => {
  it('packs two texels a tile: colour and elevation, flags, cover, roughness and rivers', () => {
    const tiles = getTiles();
    const { data, rows } = paintTileData(tiles);
    expect(rows * DATA_W).toBeGreaterThanOrEqual(tiles.count * 2);
    const lake = tiles.terrainNames.indexOf('lake');
    let land = 0; let checked = 0;
    for (let i = 0; i < tiles.count; i += 97) {
      const o = i * 8;
      const flags = data[o + 4] % 8;
      const isLand = tiles.land[i] === 1 && tiles.terrain[i] !== lake;
      expect((flags & FLAG_LAND) !== 0).toBe(isLand);
      expect((flags & FLAG_LAKE) !== 0).toBe(tiles.terrain[i] === lake);
      if (isLand) { land++; expect(data[o + 3]).toBeGreaterThanOrEqual(2); } else expect(data[o + 3]).toBeLessThanOrEqual(-80);
      expect(data[o + 6]).toBe(tiles.rivers[i]);
      [0, 1, 2].forEach((c) => { expect(data[o + c]).toBeGreaterThanOrEqual(0); expect(data[o + c]).toBeLessThanOrEqual(1); });
      checked++;
    }
    expect(land).toBeGreaterThan(checked * 0.2);
    expect(paintTileData(tiles)).toBe(paintTileData(tiles)); // cached per grid
  });

  it('cover base classes follow the Earth build (classifyCover without the elevation rules)', () => {
    expect(coverBaseOf({ feature: 'forest', koppen: 'BWh' })).toBe(cls('forest'));
    expect(coverBaseOf({ feature: 'marsh', koppen: 'Cfa' })).toBe(cls('wetland'));
    expect(coverBaseOf({ feature: 'floodplain', koppen: 'BWh' })).toBe(cls('irrigated'));
    expect(coverBaseOf({ feature: 'none', koppen: 'BWh' })).toBe(cls('desert'));
    expect(coverBaseOf({ feature: 'none', koppen: 'BSk' })).toBe(cls('steppe'));
    expect(coverBaseOf({ feature: 'none', koppen: 'Dfc' })).toBe(cls('forest'));
    expect(coverBaseOf({ feature: 'none', koppen: 'Af' })).toBe(cls('rainforest'));
    expect(coverBaseOf({ feature: 'none', koppen: 'ET' })).toBe(cls('tundra'));
    expect(coverBaseOf({ feature: 'none', koppen: 'EF' })).toBe(cls('ice'));
    expect(coverBaseOf({ feature: 'none', koppen: 'Cfb' })).toBe(cls('grassland'));
  });

  it('places pyramid tiles like rasterTiles.js (level z: 2^(z+1) x 2^z, north at the top)', () => {
    const { geo, kmPx } = tileGeo(6, 0, 0);
    expect(geo[0]).toBeCloseTo(-Math.PI); expect(geo[1]).toBeCloseTo(Math.PI / 2);
    expect(geo[2]).toBeCloseTo((2 * Math.PI) / 128); expect(geo[3]).toBeCloseTo(Math.PI / 64);
    expect(kmPx).toBeCloseTo(1.22, 1);
    const last = tileGeo(3, 15, 7).geo;
    expect(last[0] + last[2]).toBeCloseTo(Math.PI); expect(last[1] - last[3]).toBeCloseTo(-Math.PI / 2);
    expect(PAINT_FRAGMENT).toContain('void main()');
  });
});
