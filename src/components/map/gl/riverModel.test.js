import { describe, it, expect } from 'vitest';
import { riverLinesNow } from '../../../data/geo/riverLines';
import { encodeRivers, decodeRivers } from '../../../data/geo/riverCodec';
import { getTiles } from '../../../data/geo/tiles';
import {
  riverFade, riverBandAt, riverRankCap, riverWidthPx, riverStrips, reachPoints, pxPerKmAt, RIVER_BANDS
} from './riverModel';

const reaches = riverLinesNow();
// d3's fitSize scale for a 1600 px wide world (the desktop reference) and an 844 px one
const S_DESKTOP = 1600 / (2 * Math.PI);

describe('the river file', () => {
  it('round-trips through the codec', () => {
    const src = [{ rank: 3, w0: 20, w1: 150, pts: [[100, -50], [130, -20], [-400, 7000]], levels: [0, 2, 0] }];
    const [r] = decodeRivers(encodeRivers(src, 2000));
    expect(r.rank).toBe(3); expect(r.w0).toBe(0.2); expect(r.w1).toBe(1.5);
    expect(Array.from(r.lon)).toEqual([0.05, 0.065, -0.2]);
    expect(Array.from(r.lat)).toEqual([-0.025, -0.01, 3.5]);
    expect(Array.from(r.level)).toEqual([0, 2, 0]);
  });

  it('is built and on disk, with the great rivers in it', () => {
    expect(reaches?.length).toBeGreaterThan(2000);
    const near = (lat, lon, maxRank) => reaches.some((r) => r.rank <= maxRank && r.lon.some((x, i) => Math.abs(x - lon) < 0.3 && Math.abs(r.lat[i] - lat) < 0.3));
    // the Nile at Cairo, the Euphrates, the Rhine at Koblenz, the Mississippi at St. Louis: all seen from the world view
    expect(near(30.05, 31.25, 4)).toBe(true);
    expect(near(33.3, 43.9, 4)).toBe(true);
    expect(near(50.36, 7.6, 4)).toBe(true);
    expect(near(38.6, -90.2, 4)).toBe(true);
  });

  it('keeps every river on land (the hex coast) and widens it downstream', () => {
    const tiles = getTiles();
    let off = 0; let n = 0;
    reaches.forEach((r) => { for (let i = 0; i < r.lon.length; i += 7) { n++; const t = tiles.nearest(r.lat[i], ((r.lon[i] + 540) % 360) - 180); if (tiles.land[t] !== 1) off++; } });
    // the hex coast is softened at the corners: a point a few km past a water hex's centre line is
    // still on the drawn land, so allow a sliver
    expect(off / n).toBeLessThan(0.02);
    // the Nile: thin at a source, about 2 at the delta
    const sw = reaches.flatMap((r) => [r.w0, r.w1]);
    expect(Math.min(...sw)).toBeLessThan(0.1);
    expect(Math.max(...sw)).toBeGreaterThan(1.5);
  });
});

describe('river lines on the WebGL map', () => {
  it('fades the great rivers in first and the tributaries only closer', () => {
    expect(riverFade(1, 1)).toBe(1);
    expect(riverFade(4, 3)).toBe(1); // the Tigris and the Rhine at the world zoom
    expect(riverFade(9, 3)).toBe(0);
    expect(riverFade(9, 12)).toBe(0);
    expect(riverFade(9, 40)).toBe(1);
    expect(riverFade(7, 12)).toBe(1);
    // only the ranks shown soon are built
    expect(riverRankCap(1)).toBe(4);
    expect(riverRankCap(12)).toBe(9);
    expect(riverRankCap(40)).toBe(10);
    const capped = riverStrips(reaches, 2, null, 6);
    for (let i = 0; i < capped.vertices; i += 50) expect(capped.info[i * 4 + 1]).toBeLessThanOrEqual(6);
  });

  it('picks more detail and more ranks as the zoom grows', () => {
    expect(riverBandAt(1)).toBe(0);
    expect(riverBandAt(3)).toBe(1);
    expect(riverBandAt(12)).toBe(2);
    expect(riverBandAt(40)).toBe(3);
    expect(riverBandAt(200)).toBe(4);
    const far = riverStrips(reaches, 0);
    const world = riverStrips(reaches, 1);
    const middle = riverStrips(reaches, 2);
    expect(far.vertices).toBeLessThan(world.vertices * 0.85);
    expect(world.reaches).toBeGreaterThan(500);
    expect(middle.vertices).toBeGreaterThan(world.vertices);
    // two vertices a point, two triangles between two points
    expect(world.cur.length).toBe(world.vertices * 2);
    expect(world.info.length).toBe(world.vertices * 4);
    expect(world.index.length).toBe((world.vertices / 2 - world.reaches) * 6);
    // the close bands only round a window: the Nile delta
    const delta = riverStrips(reaches, 3, { west: 28, east: 34, south: 28, north: 32 });
    expect(delta.vertices).toBeGreaterThan(100);
    expect(delta.vertices).toBeLessThan(riverStrips(reaches, 3).vertices / 10);
    for (let i = 0; i < delta.vertices; i++) {
      expect(delta.info[i * 4 + 1]).toBeLessThanOrEqual(RIVER_BANDS[3].maxRank);
      expect(Math.abs(delta.info[i * 4 + 2])).toBe(1);
    }
  });

  it('smooths a reach and ramps its width along it', () => {
    const r = { rank: 2, w0: 0.2, w1: 1, lon: Float64Array.from([0, 1, 2]), lat: Float64Array.from([0, 1, 0]), level: Uint8Array.from([0, 0, 0]) };
    const pts = reachPoints(r, 3);
    // the weight plus the rank's boost (smaller toward the thin source)
    expect(pts[0][2]).toBeCloseTo(0.4); expect(pts[0].slice(0, 2)).toEqual([0, 0]);
    expect(pts[pts.length - 1][2]).toBeCloseTo(1.3); expect(pts[pts.length - 1].slice(0, 2)).toEqual([2, 0]);
    expect(pts.length).toBeGreaterThan(3);
    // corners are cut: no point at the sharp middle vertex any more
    expect(pts.some(([x, y]) => x === 1 && y === 1)).toBe(false);
  });

  it('draws thin lines far out, wider downstream, real width close in, never a wide band', () => {
    const at = (sw, k) => riverWidthPx(sw, k, pxPerKmAt(k, S_DESKTOP));
    expect(at(2, 3)).toBeGreaterThan(at(0.2, 3));
    expect(at(2, 3)).toBeLessThan(3); // a fine line at the world zoom
    expect(at(0.15, 12)).toBeLessThan(2.2);
    expect(at(2, 40)).toBeGreaterThan(at(2, 12));
    // the Nile at the close zoom: a few px, not the raster's 10 km band (16 px)
    expect(at(2, 40)).toBeLessThan(7);
    // the closest zoom: real km, capped
    const k = 200; const ppk = pxPerKmAt(k, S_DESKTOP);
    expect(at(2, k)).toBeGreaterThanOrEqual(1.18 * ppk * 0.99);
    expect(at(2, 1000)).toBeLessThanOrEqual(3 + 7 * Math.sqrt(2));
  });
});
