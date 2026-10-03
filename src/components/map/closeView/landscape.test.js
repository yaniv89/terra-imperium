import { describe, it, expect } from 'vitest';
import { getTiles } from '../../../data/geo/tiles';
import { landscapeOnScreen, landTilesOnScreen, treeKindOf, treeSpots, workOf, tileIsCleared, hash01, TREES_FROM_K, TREES_PER_HEX, CONIFER_LAT } from './landscape';
import { tiltFor, TILT_CLOSE, TILT_SUPER, unitPx, SUPER_FROM_K } from './scale';
import { waterness, snowiness, detailWeight, pxPerKm, DETAIL_SCALES_KM } from './terrainShader';
import { visibleRasterTiles, RASTER_MAX_Z } from '../../../data/geo/rasterTiles';

const tiles = getTiles();
// A simple equirectangular screen: 10 px a degree around (lat0, lon0), 800 x 400.
const screen = (lat0, lon0, pxPerDeg = 10) => (lat, lon) => ({ x: 400 + (lon - lon0) * pxPerDeg, y: 200 - (lat - lat0) * pxPerDeg });

describe('close view landscape', () => {
  it('finds only the land tiles on screen', () => {
    const on = landTilesOnScreen(screen(50, 10), 800, 400, 0);
    expect(on.length).toBeGreaterThan(50);
    on.forEach((t) => {
      expect(tiles.land[t.tile]).toBe(1);
      expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x).toBeLessThanOrEqual(800);
    });
  });
  it('plants trees only in forest and jungle, the kind by latitude, never on a city or a work', () => {
    const forest = []; for (let i = 0; i < tiles.count && forest.length < 400; i++) if (tiles.featureOf(i) === 'forest' || tiles.featureOf(i) === 'jungle') forest.push(i);
    forest.forEach((t) => {
      const kind = treeKindOf(tiles, t);
      if (tiles.featureOf(t) === 'jungle') expect(kind).toBe('palm');
      else expect(kind).toBe(Math.abs(tiles.lat[t] / 1000) >= CONIFER_LAT ? 'conifer' : 'broad');
    });
    const plain = [...Array(tiles.count).keys()].find((i) => tiles.land[i] === 1 && tiles.featureOf(i) === 'none');
    expect(treeKindOf(tiles, plain)).toBeNull();
    const t = forest[0];
    expect(tileIsCleared({ tileState: {} }, new Set(), t)).toBe(false);
    expect(tileIsCleared({ tileState: {} }, new Set([t]), t)).toBe(true);
    expect(tileIsCleared({ tileState: { [t]: { improvement: 'lumber_camp' } } }, new Set(), t)).toBe(true);
  });
  it('places the same trees every time, inside the hex', () => {
    const a = treeSpots(123, 50); const b = treeSpots(123, 50);
    expect(a).toEqual(b);
    expect(a).toHaveLength(TREES_PER_HEX);
    a.forEach((s) => expect(Math.hypot(s.dLat, s.dLon * Math.cos((50 * Math.PI) / 180))).toBeLessThan(0.45));
    expect(hash01(1, 2)).toBeGreaterThanOrEqual(0); expect(hash01(1, 2)).toBeLessThan(1);
  });
  it('draws a work per improved tile on screen, trees only from the zoom where they read', () => {
    const forest = [...Array(tiles.count).keys()].find((i) => tiles.featureOf(i) === 'forest' && Math.abs(tiles.lat[i] / 1000) < 60);
    const farm = tiles.neighbors[forest].find((x) => tiles.land[x] === 1) ?? forest;
    const lat0 = tiles.lat[forest] / 1000; const lon0 = tiles.lon[forest] / 1000;
    const world = { tileState: { [farm]: { improvement: 'farm', pillaged: true }, 7: { road: true } } };
    expect(workOf(world, farm)).toEqual({ kind: 'farm', pillaged: true });
    expect(workOf(world, 7)).toBeNull();
    const far = landscapeOnScreen({ toScreen: screen(lat0, lon0), width: 800, height: 400, k: TREES_FROM_K - 1, world, cityTiles: new Set() });
    expect(far.trees).toEqual([]);
    expect(far.works.map((w) => w.kind)).toEqual(['farm']);
    const near = landscapeOnScreen({ toScreen: screen(lat0, lon0, 60), width: 800, height: 400, k: 40, world: { tileState: {} }, cityTiles: new Set() });
    expect(near.trees.length).toBeGreaterThanOrEqual(TREES_PER_HEX);
    const capped = landscapeOnScreen({ toScreen: screen(lat0, lon0), width: 800, height: 400, k: 40, world: { tileState: {} }, cityTiles: new Set(), maxTrees: 30 });
    expect(capped.trees.length).toBeLessThanOrEqual(30);
  });
  it('tilts the models lower in the super zoom', () => {
    expect(tiltFor(10)).toBe(TILT_CLOSE); expect(tiltFor(40)).toBe(TILT_CLOSE);
    expect(tiltFor(200)).toBeCloseTo(TILT_SUPER);
    expect(tiltFor(90)).toBeGreaterThan(TILT_CLOSE); expect(tiltFor(90)).toBeLessThan(TILT_SUPER);
  });
  it('grows the models with the zoom, more slowly in the super zoom so towns stay inside their hex', () => {
    expect(unitPx(20)).toBeCloseTo(11); expect(unitPx(SUPER_FROM_K)).toBeCloseTo(22);
    expect(unitPx(200)).toBeGreaterThan(unitPx(100));
    expect(unitPx(200) / 200).toBeLessThan(unitPx(SUPER_FROM_K) / SUPER_FROM_K * 0.7);
  });
});

describe('close terrain shader rules', () => {
  it('classes the raster colours: sea, lake and river blue are water; green, sand, rock and snow are land', () => {
    [[92, 160, 205], [48, 104, 165], [18, 42, 92], [58, 118, 170], [96, 156, 214]].forEach((c) => expect(waterness(...c)).toBeGreaterThan(0.9));
    [[86, 130, 60], [214, 190, 140], [152, 128, 102], [168, 160, 152], [240, 243, 246]].forEach((c) => expect(waterness(...c)).toBe(0));
    expect(snowiness(232, 238, 244)).toBe(1); expect(snowiness(185, 190, 195)).toBeGreaterThan(0.5);
    [[86, 130, 60], [168, 160, 152], [214, 190, 140]].forEach((c) => expect(snowiness(...c)).toBe(0));
  });
  it('fades ground detail in by screen size', () => {
    const atClose = pxPerKm(780, 10, 2); const atSuper = pxPerKm(780, 200, 2);
    expect(detailWeight(DETAIL_SCALES_KM[2], atClose)).toBe(0); // 1.5 km crags are invisible at zoom 10
    expect(detailWeight(DETAIL_SCALES_KM[0], atSuper)).toBe(1);
    expect(detailWeight(DETAIL_SCALES_KM[2], atSuper)).toBeGreaterThan(0.5);
  });
  it('reads level 5 tiles for the screen at any zoom', () => {
    const raster = { x: 0, y: 0, width: 780, height: 390 };
    const close = visibleRasterTiles({ raster, transform: { x: -3000, y: -1000, k: 10 }, width: 844, height: 390, forceZ: RASTER_MAX_Z, margin: 0 });
    expect(close.every((t) => t.z === RASTER_MAX_Z)).toBe(true);
    expect(close.length).toBeGreaterThan(10); expect(close.length).toBeLessThan(60);
    const sup = visibleRasterTiles({ raster, transform: { x: -60000, y: -20000, k: 200 }, width: 844, height: 390, forceZ: RASTER_MAX_Z, margin: 0 });
    expect(sup.length).toBeGreaterThan(0); expect(sup.length).toBeLessThanOrEqual(4);
  });
});
