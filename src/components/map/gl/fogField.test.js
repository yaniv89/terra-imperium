import { describe, it, expect } from 'vitest';
import { getTiles } from '../../../data/geo/tiles';
import { tileGpuData, unitOf, walkNearest } from './tileGpuData';
import { buildFogField, FIELD_W, FIELD_H } from './fogField';

const texelAt = (lat, lon) => ({ x: Math.floor(((lon + 180) / 360) * FIELD_W), y: Math.floor(((90 - lat) / 180) * FIELD_H) });

describe('the soft fog field', () => {
  const tiles = getTiles();
  const grid = tileGpuData(tiles);
  // explored: a disk of tiles round Kish, in sight: a smaller one
  const centre = walkNearest(tiles, unitOf(32.5, 44.4), tiles.nearest(32.5, 44.4));
  const states = new Uint8Array(tiles.count);
  const c = tiles.centres[centre];
  for (let t = 0; t < tiles.count; t++) {
    const d = Math.acos(Math.min(1, tiles.centres[t][0] * c[0] + tiles.centres[t][1] * c[1] + tiles.centres[t][2] * c[2])) * 6371;
    states[t] = d < 300 ? 2 : d < 600 ? 1 : 0;
  }
  const t0 = performance.now();
  const field = buildFogField({ states, lookup: grid.lookup });
  const ms = performance.now() - t0;
  const at = (lat, lon) => { const { x, y } = texelAt(lat, lon); const o = (y * FIELD_W + x) * 4; return [field.data[o] / 255, field.data[o + 1] / 255]; };

  it('is one RGBA texel per lookup texel, cheap enough to bake on every fog change', () => {
    expect(field.width).toBe(FIELD_W);
    expect(field.height).toBe(FIELD_H);
    expect(field.data.length).toBe(FIELD_W * FIELD_H * 4);
    expect(ms).toBeLessThan(400); // a few tens of ms on a desktop; generous for a loaded CI box
  });

  it('is 1 deep inside, 0 far outside and soft only near the edges', () => {
    expect(at(32.5, 44.4)).toEqual([1, 1]); // in sight
    const [ex, vis] = at(32.5, 44.4 + 450 / (111 * Math.cos((32.5 * Math.PI) / 180))); // explored, out of sight
    expect(ex).toBe(1);
    expect(vis).toBe(0);
    expect(at(32.5, 60)).toEqual([0, 0]); // unexplored
    // across the explored edge (about 600 km east) the field falls smoothly through the middle
    const km = (k) => at(32.5, 44.4 + k / (111 * Math.cos((32.5 * Math.PI) / 180)))[0];
    expect(km(520)).toBeGreaterThan(0.9);
    expect(km(600)).toBeGreaterThan(0.1);
    expect(km(600)).toBeLessThan(0.9);
    expect(km(690)).toBeLessThan(0.1);
  });

  it('wraps east to west', () => {
    const s = new Uint8Array(tiles.count);
    const edge = walkNearest(tiles, unitOf(0, 179.9), tiles.nearest(0, 179.9));
    s[edge] = 1;
    const f = buildFogField({ states: s, lookup: grid.lookup });
    const y = Math.floor(FIELD_H / 2);
    expect(f.data[(y * FIELD_W + 0) * 4]).toBeGreaterThan(0); // the blur reaches across the seam
  });
});
