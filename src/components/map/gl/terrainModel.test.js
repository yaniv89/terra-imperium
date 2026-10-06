import { describe, it, expect } from 'vitest';
import { geoEquirectangular } from 'd3-geo';
import { getTiles } from '../../../data/geo/tiles';
import { riverEdgeList } from '../../../data/geo/terrainData';
import {
  riverChains, smoothChain, riverLines, riverBand, riverHalfPx, ridgeSegments, mountainPeaks, passPoints, bridgeLines,
  RIVER_FROM_K, PASS_GAP, RIVER_SMOOTHING
} from './terrainModel';

const projection = geoEquirectangular().fitSize([1000, 500], { type: 'Sphere' });

describe('rivers on the WebGL map', () => {
  it('joins every river edge into chains, each edge once', () => {
    const chains = riverChains(projection);
    const edges = riverEdgeList().length;
    // each round of corner cutting turns m segments into 2m - 1 (one chain of a single edge stays)
    const source = (out) => { let m = out; for (let i = 0; i < RIVER_SMOOTHING; i++) m = m > 1 ? (m + 1) / 2 : m; return m; };
    expect(chains.reduce((n, c) => n + source(c.sizes.length), 0)).toBe(edges);
    expect(chains.length).toBeLessThan(edges);
    // no segment spans the date line (b unwrapped next to a)
    chains.forEach((c) => c.points.slice(1).forEach((p, i) => expect(Math.abs(p[0] - c.points[i][0])).toBeLessThan(50)));
  });

  it('cuts corners but keeps the chain ends (chains still meet at junctions)', () => {
    const { points, sizes } = smoothChain([[0, 0], [4, 0], [4, 4]], [1, 3]);
    expect(points[0]).toEqual([0, 0]);
    expect(points[points.length - 1]).toEqual([4, 4]);
    expect(sizes).toEqual([1, 3, 3]);
    expect(points).toContainEqual([3, 0]);
    expect(points).toContainEqual([4, 1]);
  });

  it('shows great rivers first, then rivers, then streams, wider as the zoom grows', () => {
    const chains = riverChains(projection);
    expect(riverLines(chains, 1)).toHaveLength(0);
    const great = riverLines(chains, RIVER_FROM_K[3]);
    const rivers = riverLines(chains, RIVER_FROM_K[2]);
    const all = riverLines(chains, RIVER_FROM_K[1]);
    expect(great.length).toBeGreaterThan(0);
    expect(rivers.length).toBeGreaterThan(great.length);
    expect(all.length).toBeGreaterThan(rivers.length);
    expect(riverBand(1)).toBe(0);
    expect(riverBand(40)).toBe(3);
    expect(riverHalfPx(3, 40)).toBeGreaterThan(riverHalfPx(3, 4));
    expect(riverHalfPx(3, 10)).toBeGreaterThan(riverHalfPx(1, 10));
  });

  it('puts a bridge across the river edge where a road crosses it', () => {
    const tiles = getTiles();
    const { a, b, size } = riverEdgeList()[0];
    const at = (t) => { const { lat, lon } = tiles.latLonOf(t); return projection([lon, lat]); };
    const pa = at(a); const pb = at(b);
    const lines = bridgeLines(a, b, size, pa, pb, projection, 20);
    expect(lines).toHaveLength(2);
    const mid = [(lines[1].a[0] + lines[1].b[0]) / 2, (lines[1].a[1] + lines[1].b[1]) / 2];
    // the deck crosses the edge between the two centres, along the road
    const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    expect(d(mid, pa) + d(mid, pb)).toBeLessThan(d(pa, pb) * 1.2);
  });
});

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
