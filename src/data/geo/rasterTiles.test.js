import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { visibleRasterTiles, rasterZoomFor, baseRasterZoom, rasterTileUrl, RASTER_MAX_Z } from './rasterTiles';

describe('the raster pyramid (plans/playtest-1.md P1.2)', () => {
  const raster = { x: 0, y: 0, width: 844, height: 422 };
  it('picks the level whose pixels match the screen, capped at the full resolution', () => {
    expect(rasterZoomFor(512)).toBe(0);
    expect(rasterZoomFor(4096)).toBe(3);
    expect(rasterZoomFor(16384)).toBe(5);
    expect(rasterZoomFor(1e9)).toBe(RASTER_MAX_Z);
    expect(baseRasterZoom(2048)).toBe(2); expect(baseRasterZoom(4096)).toBe(3);
  });
  it('draws nothing while the base picture is sharp enough, and only the tiles on screen when zoomed in', () => {
    expect(visibleRasterTiles({ raster, transform: { x: 0, y: 0, k: 1 }, width: 844, height: 390, dpr: 2, baseZ: 2 })).toEqual([]);
    const k = 10; const tiles = visibleRasterTiles({ raster, transform: { x: -844 * 4, y: -422 * 4, k }, width: 844, height: 390, dpr: 2, baseZ: 2 });
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(80);
    expect(new Set(tiles.map((t) => t.z))).toEqual(new Set([5]));
    tiles.forEach((t) => { expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x).toBeLessThan(64); expect(t.y).toBeGreaterThanOrEqual(0); expect(t.y).toBeLessThan(32); });
    // Every tile drawn exists on disk, and every corner of the screen is covered.
    tiles.forEach((t) => expect(existsSync(path.join(process.cwd(), 'public', rasterTileUrl(t.z, t.x, t.y).replace(/^\/+/, '').replace(/^[^m]*map\//, 'map/')))).toBe(true));
    const covers = (sx, sy) => { const px = (sx + 844 * 4) / k; const py = (sy + 422 * 4) / k; return tiles.some((t) => px >= t.rect.x && px <= t.rect.x + t.rect.width && py >= t.rect.y && py <= t.rect.y + t.rect.height); };
    [[0, 0], [843, 0], [0, 389], [843, 389]].forEach(([sx, sy]) => expect(covers(sx, sy)).toBe(true));
  });
});
