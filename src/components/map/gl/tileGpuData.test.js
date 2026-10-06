import { describe, it, expect } from 'vitest';
import { getTiles } from '../../../data/geo/tiles';
import { tileGpuData, shaderTileAt, DATA_W } from './tileGpuData';

describe('tile GPU data', () => {
  const tiles = getTiles();
  const data = tileGpuData(tiles);

  it('packs centres and neighbours per tile', () => {
    expect(data.centres.length).toBe(DATA_W * data.rows * 4);
    const t = 12345;
    expect(data.centres[t * 4]).toBeCloseTo(tiles.centres[t][0], 6);
    expect(data.centres[t * 4 + 3]).toBe(tiles.land[t] === 1 ? 1 : 0);
    const ns = Array.from(data.neighbours.slice(t * 8, t * 8 + 6)).filter((v) => v >= 0);
    expect(ns).toEqual(tiles.neighbors[t]);
  });

  it('finds the same tile as the hit test everywhere (lookup plus the short walk)', () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let wrong = 0;
    for (let i = 0; i < 4000; i++) {
      const lat = Math.asin(rnd() * 2 - 1) * (180 / Math.PI);
      const lon = rnd() * 360 - 180;
      if (shaderTileAt(tiles, data, lat, lon) !== tiles.nearest(lat, lon)) wrong++;
    }
    expect(wrong).toBe(0);
  });

  it('is cached per grid', () => {
    expect(tileGpuData(tiles)).toBe(data);
  });
});
