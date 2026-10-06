// src/data/geo/rasterDetail.test.js
// The level 6 and land cover manifest (scripts/geo/build-raster-detail.mjs) and its helpers.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { LAND_COVER, makeDetailIndex, bestColourTile, coverClassOf } from './rasterDetail';
import { RASTER_MAX_Z } from './rasterTiles';

const manifest = JSON.parse(readFileSync('public/map/tiles/detail.json', 'utf8'));

describe('raster detail manifest', () => {
  it('names the same land cover classes as the build', () => {
    expect(manifest.cover.classes).toEqual([...LAND_COVER]);
    expect(coverClassOf(6)).toBe('forest');
    expect(coverClassOf(250)).toBe('water');
  });

  it('lists level 6 land tiles that exist on disk, and cover for levels 5 and 6', () => {
    const six = manifest.detail[6];
    expect(six.length).toBeGreaterThan(1500);
    expect(six.length).toBeLessThan(128 * 64 * 0.6); // land only: most of the sea is not stored
    [six[0], six[Math.floor(six.length / 2)], six[six.length - 1]].forEach((k) => {
      expect(existsSync(`public/map/tiles/6/${k}.webp`), k).toBe(true);
      expect(existsSync(`public/map/cover/6/${k}.png`), k).toBe(true);
    });
    expect(manifest.cover.levels[5].length).toBeGreaterThan(500);
    expect(statSync(`public/map/cover/5/${manifest.cover.levels[5][0]}.png`).size).toBeGreaterThan(0);
  });
});

describe('choosing the tile to draw', () => {
  const index = makeDetailIndex({ detail: { 6: ['10-4'] }, cover: { classes: LAND_COVER, levels: { 5: ['5-2'], 6: ['10-4'] } } });

  it('draws a level 6 land tile itself, and falls back to level 5 at sea', () => {
    expect(index.maxZ).toBe(6);
    expect(bestColourTile(index, 6, 10, 4)).toMatchObject({ z: 6, x: 10, y: 4, u0: 0, v0: 0, u1: 1, v1: 1 });
    // (11, 5) is not stored: the quarter of level 5 tile (5, 2) that covers it
    expect(bestColourTile(index, 6, 11, 5)).toMatchObject({ z: 5, x: 5, y: 2, u0: 0.5, v0: 0.5, u1: 1, v1: 1 });
    expect(index.hasColour(RASTER_MAX_Z, 0, 0)).toBe(true);
    expect(index.hasCover(5, 5, 2)).toBe(true);
    expect(index.hasCover(5, 0, 0)).toBe(false);
  });

  it('asks for the deepest stored level when zoomed past it', () => {
    expect(bestColourTile(index, 7, 21, 9)).toMatchObject({ z: 6, x: 10, y: 4, u0: 0.5, v0: 0.5 });
  });
});
