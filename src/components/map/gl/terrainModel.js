// src/components/map/gl/terrainModel.js
// Phase F, the rendering half (plans/MASTER-PLAN.md 5.4 and 7 row 14; world art plan 3 to 6):
// rivers and mountain chains for the WebGL map as plain lists (no three.js), from the terrain
// columns of the grid (src/data/geo/terrainData.js). GLMapView.jsx draws them in the terrain
// pass, between the Earth and the territories, so the fog mask hides them where nothing is
// explored and the grey wash greys them where the land is explored but out of sight.
//
//   Rivers     every river EDGE of the grid (riverEdgeList) between its two shared corners
//              (edgeCorners: both tiles get bit-identical points), joined corner to corner into
//              chains and rounded (Chaikin, RIVER_SMOOTHING rounds, end points kept, so chains still meet at their
//              junctions). Width by size (stream, river, great river), growing slowly with the
//              zoom. Shown from the regional zoom (world plan 3: the world view keeps the raster's
//              own rivers): great rivers from RIVER_FROM_K[3], rivers from [2], streams from [1].
//   Bridges    where a road crosses a river edge (crossingsOf: a road on both banks): a short deck
//              across the river at the edge's middle, from the hex zoom (sceneModel.landSprites).
//   Mountains  chains along the ridge lines (ridgeEdgesOf): peaks spaced along each ridge edge in
//              screen pixels, the highest kept where two would overlap, lower and gapped on a pass
//              (isPass) so the saddle reads as a way through; a pass mark on each pass tile from
//              the region zoom. Up to the close zoom, where the close view's 3D ridges take over.
// World units are the map projection's (mapView.js); every list is cached per projection.
// Art (ART-PRODUCTION-PLAN batch 14, spec S11): these lines and sprites are the placeholders for
// the `map-terrain/rivers` kit (src/assets/map/terrain/rivers.glb, banks and fords for the close
// view) and `map-terrain/mountain-ridges` (src/assets/map/terrain/mountain-ridges.glb).
import { getTiles } from '../../../data/geo/tiles';
import { riverEdgeList, edgeCorners } from '../../../data/geo/terrainData';

// The zoom (k) from which each river size shows: index = size (1 stream, 2 river, 3 great river).
export const RIVER_FROM_K = Object.freeze([Infinity, 4, 2.6, 1.8]);
// Half widths in CSS px at zoom RIVER_REF_K, growing as k^RIVER_EXP.
export const RIVER_HALF_PX = Object.freeze([0, 0.55, 0.85, 1.3]);
export const RIVER_REF_K = 4;
export const RIVER_EXP = 0.45;
export const RIVER_COLOR = Object.freeze([0.3, 0.55, 0.78, 0.95]);
// Rounds of corner cutting: hex edges meet at 120 degrees, two rounds read as a river's bends.
export const RIVER_SMOOTHING = 2;
export const MOUNTAIN_SPRITES_FROM_K = 1;
export const PASS_MARK_FROM_K = 2.5;

/** A river's half width in CSS px at zoom k. */
export const riverHalfPx = (size, k) => RIVER_HALF_PX[size] * (k / RIVER_REF_K) ** RIVER_EXP;

const cacheBy = () => new WeakMap(); // projection -> value (a resize makes a new projection)

// A world point for a lat/lon, unwrapped next to `near` (an x in world units) so a line never
// spans the whole world at the date line.
const unwrapX = (x, near, worldW) => (near == null ? x : x + worldW * Math.round((near - x) / worldW));

const riverCache = cacheBy();
/**
 * The river chains in world units: [{ points: [[x, y]...], sizes: [size per segment] }]. Every
 * river edge once; chains run between corners where rivers meet, split or end, then are rounded
 * once (each inner corner cut at a quarter of its two segments).
 */
export const riverChains = (projection, tiles = getTiles()) => {
  let hit = riverCache.get(projection);
  if (hit && hit.tiles === tiles) return hit.chains;
  const worldW = projection.scale() * 2 * Math.PI;
  // corners keyed by their exact unit vector (both tiles of an edge compute the same numbers)
  const nodes = new Map(); // key -> { ll, edges: [edge index] }
  const edges = [];
  const nodeOf = (v, ll) => {
    const key = `${v[0]},${v[1]},${v[2]}`;
    let n = nodes.get(key);
    if (!n) { n = { key, ll, edges: [] }; nodes.set(key, n); }
    return n;
  };
  riverEdgeList(tiles).forEach(({ a, b, size }) => {
    const k = tiles.neighbors[a].indexOf(b);
    if (k < 0) return;
    const c = edgeCorners(a, k, tiles);
    const na = nodeOf(c.a, c.from); const nb = nodeOf(c.b, c.to);
    if (na === nb) return;
    const i = edges.length;
    edges.push({ na, nb, size, used: false });
    na.edges.push(i); nb.edges.push(i);
  });
  const chains = [];
  const walk = (start, first) => {
    const pts = [start]; const sizes = [];
    let node = start; let ei = first;
    while (ei != null && !edges[ei].used) {
      const e = edges[ei];
      e.used = true;
      sizes.push(e.size);
      node = e.na === node ? e.nb : e.na;
      pts.push(node);
      // carry on through a corner only two river edges share
      ei = node.edges.length === 2 ? node.edges.find((j) => j !== ei) : null;
    }
    return { pts, sizes };
  };
  const emit = ({ pts, sizes }) => {
    if (pts.length < 2) return;
    const xy = [];
    pts.forEach((n) => {
      const p = projection([n.ll.lon, n.ll.lat]);
      if (!p) return;
      xy.push([unwrapX(p[0], xy.length ? xy[xy.length - 1][0] : null, worldW), p[1]]);
    });
    if (xy.length !== pts.length) return;
    let c = { points: xy, sizes };
    for (let i = 0; i < RIVER_SMOOTHING; i++) c = smoothChain(c.points, c.sizes);
    chains.push(c);
  };
  // chain ends first (ends and junctions), then the loops left over
  nodes.forEach((n) => { if (n.edges.length !== 2) n.edges.forEach((ei) => { if (!edges[ei].used) emit(walk(n, ei)); }); });
  edges.forEach((e, ei) => { if (!e.used) emit(walk(e.na, ei)); });
  riverCache.set(projection, { tiles, chains });
  return chains;
};

/** One round of Chaikin corner cutting; the ends stay. Segment sizes follow their source segment. */
export const smoothChain = (points, sizes) => {
  if (points.length < 3) return { points, sizes };
  const out = [points[0]]; const outSizes = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i]; const [bx, by] = points[i + 1];
    const q = [ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25];
    const r = [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75];
    if (i > 0) { out.push(q); outSizes.push(Math.max(sizes[i - 1], sizes[i])); }
    out.push(i < points.length - 2 ? r : points[i + 1]);
    outSizes.push(sizes[i]);
  }
  return { points: out, sizes: outSizes };
};

/**
 * The river segments to draw at zoom k (createLineLayer's list): the sizes shown from k, each
 * segment's half width growing as k^RIVER_EXP.
 */
export const riverLines = (chains, k) => {
  const lines = [];
  const scale = RIVER_REF_K ** -RIVER_EXP;
  chains.forEach(({ points, sizes }) => {
    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];
      if (k < RIVER_FROM_K[size]) continue;
      lines.push({ a: points[i], b: points[i + 1], half: RIVER_HALF_PX[size] * scale, exp: RIVER_EXP, color: RIVER_COLOR });
    }
  });
  return lines;
};

/** The band of k a river list is built for (rebuild only when it changes). */
export const riverBand = (k) => RIVER_FROM_K.filter((from) => k >= from).length;

// ------------------------------------------------------------------ mountains
const ridgeCache = cacheBy();
/**
 * The ridge edges in world units: [{ a, b, ta, tb, elev, passA, passB, lat }] (b unwrapped next
 * to a), each edge of the ridge forest once. `elev`: the higher end's elevation, metres.
 */
export const ridgeSegments = (projection, tiles = getTiles()) => {
  let hit = ridgeCache.get(projection);
  if (hit && hit.tiles === tiles) return hit.segs;
  const segs = [];
  const worldW = projection.scale() * 2 * Math.PI;
  if (tiles.ridge) {
    const at = (t) => { const { lat, lon } = tiles.latLonOf(t); return projection([lon, lat]); };
    for (let t = 0; t < tiles.count; t++) {
      const mask = tiles.ridge[t];
      if (!mask) continue;
      const ns = tiles.neighbors[t];
      for (let k = 0; k < ns.length; k++) {
        const n = ns[k];
        if (!(mask & (1 << k))) continue;
        if (n < t && (tiles.ridge[n] & (1 << tiles.neighbors[n].indexOf(t)))) continue; // drawn from n
        const a = at(t); const b0 = at(n);
        if (!a || !b0) continue;
        segs.push({
          a, b: [unwrapX(b0[0], a[0], worldW), b0[1]], ta: t, tb: n,
          elev: Math.max(tiles.elevation[t], tiles.elevation[n]),
          passA: tiles.isPass(t), passB: tiles.isPass(n), lat: tiles.lat[t] / 1000
        });
      }
    }
  }
  ridgeCache.set(projection, { tiles, segs });
  return segs;
};

/** A peak's width in CSS px at zoom k, before its height factor. */
export const peakPx = (k) => Math.max(6, Math.min(26, 6.5 * k ** 0.42));
// How much of a ridge edge next to a pass stays empty (the saddle), from the pass tile's centre.
export const PASS_GAP = 0.42;
const SNOW_M = 1900; // a tile's MEAN elevation: the Alps' is about 1,500 m

/** The height factor (0.75 to 1.25) and snow of a peak from its elevation and latitude. */
export const peakLook = (elev, lat) => ({
  f: 0.75 + 0.5 * Math.max(0, Math.min(1, (elev - 800) / 4000)),
  snow: elev > SNOW_M - Math.max(0, Math.abs(lat) - 35) * 45
});

/**
 * The peaks of the mountain chains for a settled zoom k: [{ anchor, px, snow, variant, pass }],
 * spaced along every ridge edge, the highest kept where two overlap, none in a pass's saddle,
 * ordered north to south (the southern ones drawn over). `near(point)` keeps those round the view.
 */
export const mountainPeaks = (segs, k, near = null) => {
  const base = peakPx(k);
  const spacing = (base * 0.5) / k; // world units: neighbours overlap into one chain
  const cell = (base * 0.42) / k;
  const taken = new Set();
  const out = [];
  const order = segs.slice().sort((p, q) => q.elev - p.elev);
  order.forEach((s) => {
    const dx = s.b[0] - s.a[0]; const dy = s.b[1] - s.a[1];
    const len = Math.hypot(dx, dy);
    const n = Math.max(1, Math.round(len / spacing));
    const look = peakLook(s.elev, s.lat);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      if ((s.passA && t < PASS_GAP) || (s.passB && t > 1 - PASS_GAP)) continue;
      const p = [s.a[0] + dx * t, s.a[1] + dy * t];
      if (near && !near(p)) continue;
      const key = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`;
      if (taken.has(key)) continue;
      taken.add(key);
      const nearPass = (s.passA && t < 0.6) || (s.passB && t > 0.4);
      out.push({ anchor: p, px: base * look.f * (nearPass ? 0.75 : 1), snow: look.snow && !nearPass, variant: (s.ta * 7 + s.tb * 3 + i) % 3, pass: nearPass });
    }
  });
  return out.sort((p, q) => p.anchor[1] - q.anchor[1]);
};

const passCache = cacheBy();
/** The pass tiles in world units: [{ tile, anchor }]. */
export const passPoints = (projection, tiles = getTiles()) => {
  let hit = passCache.get(projection);
  if (hit && hit.tiles === tiles) return hit.list;
  const list = [];
  if (tiles.pass) {
    for (let t = 0; t < tiles.count; t++) {
      if (!tiles.isPass(t)) continue;
      const { lat, lon } = tiles.latLonOf(t);
      const p = projection([lon, lat]);
      if (p) list.push({ tile: t, anchor: p });
    }
  }
  passCache.set(projection, { tiles, list });
  return list;
};

/**
 * A bridge where a road crosses the river edge between tiles a and b: two segments (the dark
 * outline, then the deck) across the river at the edge's middle, along the road, in world units.
 * `pa`, `pb`: the two tile centres (pb unwrapped next to pa); `k`: the settled zoom.
 */
export const bridgeLines = (a, b, size, pa, pb, projection, k, tiles = getTiles()) => {
  const kk = tiles.neighbors[a].indexOf(b);
  if (kk < 0 || !size) return [];
  const c = edgeCorners(a, kk, tiles);
  const p0 = projection([c.from.lon, c.from.lat]); const p1 = projection([c.to.lon, c.to.lat]);
  if (!p0 || !p1) return [];
  const worldW = projection.scale() * 2 * Math.PI;
  const m = [(unwrapX(p0[0], pa[0], worldW) + unwrapX(p1[0], pa[0], worldW)) / 2, (p0[1] + p1[1]) / 2];
  const dx = pb[0] - pa[0]; const dy = pb[1] - pa[1]; const len = Math.hypot(dx, dy) || 1;
  const reach = (riverHalfPx(size, k) + 2.2) / k; // world units each side of the middle
  const ux = (dx / len) * reach; const uy = (dy / len) * reach;
  const from = [m[0] - ux, m[1] - uy]; const to = [m[0] + ux, m[1] + uy];
  return [
    { a: from, b: to, half: 1.9, exp: 0, color: [0.18, 0.13, 0.09, 0.95] },
    { a: from, b: to, half: 1.1, exp: 0, color: [0.86, 0.79, 0.64, 1] }
  ];
};
