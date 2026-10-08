// scripts/geo/build-river-lines.mjs
// The map's river lines (plans/game/map-river-lines/README.md): a small binary the WebGL map draws
// as smooth, tapered vector lines over the Earth raster (src/components/map/gl/riverLayer.js).
//
// Source: Natural Earth 1:10M rivers_lake_centerlines_scale_rank (public domain, CREDITS.md),
// fetched by `npm run fetch:tiles` into scripts/geo/.raw/ne. Every reach keeps its scalerank (the
// zoom it fades in at) and its strokeweig (its width, which grows downstream: the Nile goes 0.2 at
// the source to 2.0 at the delta).
//   1. Widths along a reach: each end takes the mean of its own weight and the next reach of the
//      same river (rivernum), so the width ramps instead of stepping; a free end inland is a
//      source and narrows to SOURCE_SHARE of the weight; a free end at the coast is a mouth.
//   2. Land only: every reach is cut by the hex coast (src/data/geo/hexLand.json, the land the
//      raster shows), so a river ends at the coast and never runs over the sea or a lake hex.
//   3. Detail bands: Douglas-Peucker in km gives every point the coarsest band it is kept in
//      (riverCodec.js RIVER_BAND_TOL_KM), so the map reads one file at every zoom.
// Deterministic. Nothing here touches tiles.json, hexLand.json or the river rules.
// Run: npm run build:rivers   (a few seconds; writes public/map/rivers.bin.gz)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { encodeRivers, decodeRivers, RIVER_BAND_TOL_KM } from '../../src/data/geo/riverCodec.js';
import { getTiles } from '../../src/data/geo/tiles.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RAW = path.join(ROOT, 'scripts/geo/.raw/ne/ne_10m_rivers_lake_centerlines_scale_rank.geojson');
const OUT = path.join(ROOT, 'public/map/rivers.bin.gz');
export const MAX_RANK = 10; // ranks 11 and 12 are a handful of stubs
export const SOURCE_SHARE = 0.3; // a source's width as a share of its reach's weight
const Q = 1000; // coordinate quanta a degree (about 110 m; the lines are smoothed on the map)
const KM_DEG = 111.2;
const DENSIFY_KM = 1; // the coast test's step along a reach
const MIN_PIECE_KM = 2; // shorter bits left between two water hexes are dropped

// ---- the land (the hex coast) -------------------------------------------------------------------
const loadLand = () => {
  const fc = JSON.parse(readFileSync(path.join(ROOT, 'src/data/geo/hexLand.json'), 'utf8'));
  const rings = [];
  fc.features.forEach((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach((p) => p.forEach((ring) => {
      let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
      ring.forEach(([x, y]) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; });
      rings.push({ xs: Float64Array.from(ring, (c) => c[0]), ys: Float64Array.from(ring, (c) => c[1]), minX, maxX, minY, maxY });
    }));
  });
  // rings by 5 degree cell of their bounding box
  const cells = new Map();
  const key = (cx, cy) => cx * 1000 + cy;
  rings.forEach((r) => {
    for (let cx = Math.floor(r.minX / 5); cx <= Math.floor(r.maxX / 5); cx++) for (let cy = Math.floor(r.minY / 5); cy <= Math.floor(r.maxY / 5); cy++) {
      const k = key(cx, cy); (cells.get(k) || cells.set(k, []).get(k)).push(r);
    }
  });
  return (lon0, lat) => {
    const lon = ((((lon0 + 180) % 360) + 360) % 360) - 180;
    let inside = false;
    for (const r of cells.get(key(Math.floor(lon / 5), Math.floor(lat / 5))) || []) {
      if (lon < r.minX || lon > r.maxX || lat < r.minY || lat > r.maxY) continue;
      const { xs, ys } = r;
      for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
        if ((ys[i] > lat) !== (ys[j] > lat) && lon < ((xs[j] - xs[i]) * (lat - ys[i])) / (ys[j] - ys[i]) + xs[i]) inside = !inside;
      }
    }
    return inside;
  };
};

const kmBetween = ([x0, y0], [x1, y1]) => Math.hypot((x1 - x0) * Math.cos(((y0 + y1) / 2) * (Math.PI / 180)), y1 - y0) * KM_DEG;

// ---- Douglas-Peucker levels ---------------------------------------------------------------------
// Each point's split distance (km), capped by its parent's, so the kept set at any tolerance is the
// classic DP result; the ends get Infinity.
const dpLevels = (pts) => {
  const n = pts.length;
  const lat0 = pts[0][1] * (Math.PI / 180);
  const xy = pts.map(([x, y]) => [x * Math.cos(lat0) * KM_DEG, y * KM_DEG]);
  const d = new Float64Array(n); d[0] = Infinity; d[n - 1] = Infinity;
  const stack = [[0, n - 1, Infinity]];
  while (stack.length) {
    const [a, b, cap] = stack.pop();
    if (b - a < 2) continue;
    const [ax, ay] = xy[a]; const [bx, by] = xy[b];
    const dx = bx - ax; const dy = by - ay; const len2 = dx * dx + dy * dy;
    let best = -1; let bi = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0; t = Math.max(0, Math.min(1, t));
      const dist = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (dist > best) { best = dist; bi = i; }
    }
    const v = Math.min(best, cap);
    d[bi] = v;
    stack.push([a, bi, v], [bi, b, v]);
  }
  return Array.from(d, (v) => RIVER_BAND_TOL_KM.findIndex((tol) => v >= tol));
};

export const buildRiverLines = () => {
  const t0 = Date.now();
  const fc = JSON.parse(readFileSync(RAW, 'utf8'));
  const tiles = getTiles();
  const isLand = loadLand();
  // 1. the reaches and their ends
  const reaches = [];
  fc.features.forEach((f) => {
    const p = f.properties;
    const rank = p.scalerank ?? 12;
    if (rank > MAX_RANK || /canal/i.test(p.featurecla || '')) return;
    const sw = Number(p.strokeweig) || 0.2;
    const lines = f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : [];
    lines.forEach((line) => {
      // continuous longitudes (a reach never jumps across the date line)
      const pts = [];
      line.forEach(([x, y]) => { const px = pts.length ? pts[pts.length - 1][0] : x; pts.push([x + 360 * Math.round((px - x) / 360), y]); });
      if (pts.length >= 2) reaches.push({ rank, sw, river: p.rivernum ?? -1, pts });
    });
  });
  const nodeKey = ([x, y]) => `${Math.round((((x + 540) % 360) - 180) * 1000)},${Math.round(y * 1000)}`;
  const nodes = new Map();
  reaches.forEach((r, i) => [0, r.pts.length - 1].forEach((e) => { const k = nodeKey(r.pts[e]); (nodes.get(k) || nodes.set(k, []).get(k)).push(i); }));
  const waterNear = ([lon, lat]) => {
    const t = tiles.nearest(lat, ((((lon + 180) % 360) + 360) % 360) - 180, 1);
    return t < 0 || tiles.land[t] !== 1 || tiles.neighbors[t].some((n) => tiles.land[n] !== 1);
  };
  let sources = 0;
  const endWidth = (r, i, pt) => {
    const others = nodes.get(nodeKey(pt)).filter((j) => j !== i);
    const same = others.filter((j) => reaches[j].river === r.river);
    if (same.length) return (r.sw + same.reduce((s, j) => s + reaches[j].sw, 0) / same.length) / 2;
    if (others.length || waterNear(pt)) return r.sw;
    sources++;
    return r.sw * SOURCE_SHARE;
  };
  // 2. cut by the hex coast, 3. levels
  const out = [];
  let dropped = 0;
  reaches.forEach((r, i) => {
    const w0 = endWidth(r, i, r.pts[0]); const w1 = endWidth(r, i, r.pts[r.pts.length - 1]);
    // densified, with the share of the reach's length at each point
    const dense = [[...r.pts[0], 0]];
    let total = 0;
    for (let j = 1; j < r.pts.length; j++) {
      const a = r.pts[j - 1]; const b = r.pts[j];
      const km = kmBetween(a, b);
      const steps = Math.max(1, Math.ceil(km / DENSIFY_KM));
      for (let s = 1; s <= steps; s++) dense.push([a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps, total + (km * s) / steps]);
      total += km;
    }
    const land = dense.map(([x, y]) => isLand(x, y));
    const coastBetween = (p, q, pIsLand) => { // the coast point between a land and a water point
      let a = p; let b = q;
      for (let it = 0; it < 14; it++) {
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
        if (isLand(m[0], m[1]) === pIsLand) a = m; else b = m;
      }
      return a;
    };
    const pieces = [];
    let cur = null;
    for (let j = 0; j < dense.length; j++) {
      if (land[j]) {
        if (!cur) { cur = j > 0 ? [coastBetween(dense[j], dense[j - 1], true)] : []; }
        cur.push(dense[j]);
      } else if (cur) { cur.push(coastBetween(dense[j - 1], dense[j], true)); pieces.push(cur); cur = null; }
    }
    if (cur) pieces.push(cur);
    pieces.forEach((pc) => {
      const clean = pc.filter((p, j) => j === 0 || p[0] !== pc[j - 1][0] || p[1] !== pc[j - 1][1]);
      if (clean.length < 2 || clean[clean.length - 1][2] - clean[0][2] < MIN_PIECE_KM) { dropped++; return; }
      const levels = dpLevels(clean);
      const kept = clean.map((p, j) => [p, levels[j]]).filter(([, l]) => l >= 0);
      const tw = (km) => (total ? w0 + ((w1 - w0) * km) / total : w0);
      out.push({
        rank: r.rank, w0: Math.round(tw(clean[0][2]) * 100), w1: Math.round(tw(clean[clean.length - 1][2]) * 100),
        pts: kept.map(([p]) => [Math.round(p[0] * Q), Math.round(p[1] * Q)]), levels: kept.map(([, l]) => l)
      });
    });
  });
  // big rivers last, so their reaches come after the tributaries in the file (draw order)
  out.sort((a, b) => b.rank - a.rank);
  const bytes = encodeRivers(out, Q);
  const gz = gzipSync(bytes, { level: 9 });
  writeFileSync(OUT, gz);
  const check = decodeRivers(bytes);
  const points = check.reduce((s, r) => s + r.lon.length, 0);
  const byLevel = [0, 0, 0, 0]; check.forEach((r) => r.level.forEach((l) => { byLevel[l]++; }));
  console.log(`river lines: ${reaches.length} reaches in, ${out.length} pieces on land (${dropped} slivers dropped, ${sources} sources), ${points} points (by band ${byLevel.join(' / ')})`);
  console.log(`public/map/rivers.bin.gz: ${bytes.length} bytes raw, ${gz.length} bytes gzipped (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  return { reaches: out.length, points, raw: bytes.length, gzipped: gz.length };
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) buildRiverLines();
