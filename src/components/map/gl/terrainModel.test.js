import { describe, it, expect } from 'vitest';
import { geoEquirectangular } from 'd3-geo';
import { getTiles } from '../../../data/geo/tiles';
import { ridgeSegments, mountainPeaks, passPoints, PASS_GAP } from './terrainModel';

const projection = geoEquirectangular().fitSize([1000, 500], { type: 'Sphere' });

describe('mountain chains on the WebGL map', () => {
  it('lists every ridge edge once', () => {
    const tiles = getTiles();
    const segs = ridgeSegments(projection);
    const keys = new Set(segs.map((s) => `${Math.min(s.ta, s.tb)}-${Math.max(s.ta, s.tb)}`));
    expect(keys.size).toBe(segs.length);
    let bits = 0;
    for (let t = 0; t < tiles.count; t++) { let m = tiles.ridge[t]; while (m) { bits += m & 1; m >>= 1; } }
    expect(segs.length).toBeGreaterThanOrEqual(bits / 2);
  });

  it('spaces peaks along the ridges, keeps a gap in every pass, south drawn last', () => {
    const segs = ridgeSegments(projection);
    const k = 12;
    const peaks = mountainPeaks(segs, k);
    expect(peaks.length).toBeGreaterThan(100);
    expect(peaks.every((p, i) => i === 0 || p.anchor[1] >= peaks[i - 1].anchor[1])).toBe(true);
    // no peak sits in a pass's saddle: within PASS_GAP of a pass tile's centre along its ridge edge
    const passes = passPoints(projection);
    expect(passes.length).toBeGreaterThan(50);
    const segLen = segs.reduce((m, s) => Math.min(m, Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])), Infinity);
    let nearest = Infinity;
    passes.forEach(({ anchor }) => peaks.forEach((p) => { nearest = Math.min(nearest, Math.hypot(p.anchor[0] - anchor[0], p.anchor[1] - anchor[1])); }));
    expect(nearest).toBeGreaterThan(segLen * PASS_GAP * 0.5);
    // fewer, larger peaks far out; the world view still shows chains
    expect(mountainPeaks(segs, 1).length).toBeLessThan(peaks.length);
    expect(mountainPeaks(segs, 1).length).toBeGreaterThan(50);
  });
});
