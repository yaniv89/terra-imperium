// The ground beyond the map: it starts exactly where the map ends (no seam, no cliff), never drops
// into a void at its rim, carries a coast out to sea; tile types reach the shader as a mask; and the
// sun's shadow box covers what's on screen and stays texel-snapped.
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { TILE } from '../setup/mapgen';
import { SKIRT, buildTileMask, makeSkirtHeight, buildSkirtGeometry, fitShadowBox, hasCoast, horizonLevel } from './terrainSurface';

const makeMap = (w = 20, h = 12, edgeWater = false) => {
  const tiles = new Array(w * h).fill(TILE.OPEN);
  tiles[5 * w + 7] = TILE.ROAD; tiles[3 * w + 2] = TILE.FOREST; tiles[8 * w + 9] = TILE.SAND; tiles[1 * w + 1] = TILE.ROCK;
  if (edgeWater) for (let z = 0; z < h; z++) tiles[z * w + (w - 1)] = TILE.WATER;
  const height = Array.from({ length: w * h }, (_, i) => (i * 37) % 256);
  return { w, h, tiles, height };
};
const heightAtFor = (map) => (x, z) => {
  const ix = Math.max(0, Math.min(map.w - 1, Math.floor(x))); const iz = Math.max(0, Math.min(map.h - 1, Math.floor(z)));
  return map.tiles[iz * map.w + ix] === TILE.WATER ? -0.5 : (map.height[iz * map.w + ix] / 256) * 0.55;
};

describe('the land beyond the battlefield', () => {
  it('meets the map exactly along its border (same height at every shared vertex)', () => {
    const map = makeMap(); const heightAt = heightAtFor(map); const skirt = makeSkirtHeight(map, heightAt);
    for (let x = 0; x <= map.w; x++) {
      [0, map.h].forEach((z) => expect(skirt(x, z)).toBeCloseTo(heightAt(Math.min(map.w - 0.01, x), Math.min(map.h - 0.01, z)), 6));
    }
  });

  it('eases down to the horizon plane at its rim, and runs out to sea off a coast', () => {
    const land = makeMap(); const skirtL = makeSkirtHeight(land, heightAtFor(land));
    expect(skirtL(-SKIRT, 5)).toBeCloseTo(horizonLevel(false) + 0.02, 3);
    const coast = makeMap(20, 12, true); expect(hasCoast(coast)).toBe(true);
    expect(makeSkirtHeight(coast, heightAtFor(coast))(20 + 20, 6)).toBeLessThan(-0.5);
  });

  it('builds four strips whose inner rows are the map\'s own border vertices', () => {
    const map = makeMap(); const heightAt = heightAtFor(map);
    const geo = buildSkirtGeometry(map, makeSkirtHeight(map, heightAt), () => ({ r: 1, g: 1, b: 1 }), 6);
    const pos = geo.attributes.position;
    const verts = new Set(); for (let i = 0; i < pos.count; i++) verts.add(`${pos.getX(i)},${pos.getZ(i)}`);
    for (let x = 0; x <= map.w; x++) { expect(verts.has(`${x},0`)).toBe(true); expect(verts.has(`${x},${map.h}`)).toBe(true); }
    for (let z = 0; z <= map.h; z++) { expect(verts.has(`0,${z}`)).toBe(true); expect(verts.has(`${map.w},${z}`)).toBe(true); }
    expect(verts.has('5,5')).toBe(false); // no hidden geometry under the map
    expect(geo.index.count % 3).toBe(0);
  });

  it('hands the shader one mask texel per tile: road, sand, rock, forest', () => {
    const map = makeMap(); const mask = buildTileMask(map); const d = mask.image.data;
    const at = (x, z, c) => d[(z * map.w + x) * 4 + c];
    expect(at(7, 5, 0)).toBe(255); expect(at(9, 8, 1)).toBe(255); expect(at(1, 1, 2)).toBe(255); expect(at(2, 3, 3)).toBe(255);
    expect(at(0, 0, 0) + at(0, 0, 1) + at(0, 0, 2) + at(0, 0, 3)).toBe(0);
  });
});

describe('fitShadowBox', () => {
  const right = new Vector3(1, 0, -1).normalize(); const up = new Vector3(0, 1, 0);
  it('covers every ground corner on screen, tighter when zoomed in', () => {
    const target = { x: 50, y: 0, z: 40 };
    const near = fitShadowBox([{ x: 40, z: 30 }, { x: 60, z: 50 }], target, { right, up });
    const far = fitShadowBox([{ x: 0, z: 0 }, { x: 100, z: 90 }], target, { right, up });
    expect(near.radius).toBeGreaterThanOrEqual(Math.hypot(10, 10));
    expect(far.radius).toBeGreaterThan(near.radius);
    expect(far.radius).toBeLessThanOrEqual(90);
  });
  it('snaps the box to whole texels in the light\'s frame (no shimmer while panning)', () => {
    const a = fitShadowBox([], { x: 10.013, y: 0, z: 7.3 }, { right, up, mapSize: 1024 });
    const pr = a.center.x * right.x + a.center.z * right.z;
    expect(Math.abs(pr / a.texel - Math.round(pr / a.texel))).toBeLessThan(1e-6);
  });
});

describe('coasts vs rivers', () => {
  it('a river leaving the map is not a coast, and its channel rises back to land at the rim', () => {
    const map = makeMap(20, 12);
    for (let x = 0; x < 20; x++) map.tiles[6 * 20 + x] = TILE.WATER; // a river across the field
    expect(hasCoast(map)).toBe(false);
    const skirt = makeSkirtHeight(map, heightAtFor(map));
    expect(skirt(-5, 6.5)).toBeLessThan(-0.3); // the channel carries on
    expect(skirt(-SKIRT, 6.5)).toBeCloseTo(horizonLevel(false) + 0.02, 3); // …and ends at the rim
  });
});
