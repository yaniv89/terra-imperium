// src/components/map/gl/riverModel.js
// The river lines of the WebGL map as plain numbers (no three.js), from the river file
// (src/data/geo/riverLines.js): which reaches show at a zoom, how wide, and their segments for the
// GPU (riverLayer.js draws them). Pure and unit tested.
//
//   Fade in    every Natural Earth rank has a zoom band (RIVER_FADE_K) over which it fades in: the
//              great rivers (ranks 0 to 4: Nile, Tigris, Euphrates, Indus, Ganges, Yangtze,
//              Yellow, Mekong, Danube, Rhine, Volga, Mississippi, Amazon, Niger, Congo...) show
//              from the world view, small tributaries only at the middle and close zooms.
//   Detail     five bands of detail (RIVER_BANDS): the Douglas-Peucker level of the points kept,
//              the ranks drawn and the rounds of corner cutting (Chaikin) that make the line a
//              smooth curve at that zoom. All but the world band are built for a window round the
//              view only (the whole world would be hundreds of thousands of segments). Each reach is
//              one triangle strip (riverStrips), so a river never overlaps itself at its joints.
//   Width      riverWidthPx: a map width that grows slowly with the zoom (thin at the source,
//              wider downstream by the reach's weight), at least the real width in km once that is
//              wider, never past a cap: the Nile is about 2 km wide at the close zoom, not a band.
//   Strength   a small river is a little lighter than a great one (riverInk), so the trunk leads.
// The shader (riverLayer.js) computes the same width, fade and ink from the same constants.

// [from k, full k]: a rank shows from `from` and is at full strength by `full`.
export const RIVER_FADE_K = Object.freeze([
  [0, 0], [0, 0], [0, 0], [0, 0], [1.4, 2.4], [3.2, 5], [4.5, 7.5], [6.5, 10.5], [9, 14], [15, 28], [22, 42]
]);
/** A rank's strength (0 to 1) at zoom k. */
export const riverFade = (rank, k) => {
  const [a, b] = RIVER_FADE_K[Math.min(rank, RIVER_FADE_K.length - 1)];
  if (k >= b) return 1;
  if (k <= a) return 0;
  const t = (k - a) / (b - a);
  return t * t * (3 - 2 * t);
};

// The detail bands, by zoom: from k, the highest rank drawn, the Douglas-Peucker level kept, the
// least distance (km) between two points kept (thinning for the far views, where a pixel is many
// km), Chaikin rounds, and whether the band is built for a window round the view (else the world).
export const RIVER_BANDS = Object.freeze([
  { fromK: 0, maxRank: 5, level: 0, stepKm: 12, smooth: 0, windowed: false },
  { fromK: 2.2, maxRank: 5, level: 0, stepKm: 0, smooth: 0, windowed: false },
  { fromK: 4.5, maxRank: 9, level: 1, stepKm: 0, smooth: 1, windowed: true },
  { fromK: 14, maxRank: 10, level: 2, stepKm: 0, smooth: 1, windowed: true },
  { fromK: 60, maxRank: 10, level: 3, stepKm: 0, smooth: 2, windowed: true }
]);
/**
 * The highest rank worth building at a settled zoom k: the ranks shown by k x ahead (so a river
 * fading in while the player zooms in further is already there), never below 3.
 */
export const riverRankCap = (k, ahead = 1.6) => {
  let cap = 3;
  RIVER_FADE_K.forEach(([from], r) => { if (from < k * ahead) cap = Math.max(cap, r); });
  return cap;
};

/** The detail band index for zoom k. */
export const riverBandAt = (k) => {
  let b = 0;
  RIVER_BANDS.forEach((band, i) => { if (k >= band.fromK) b = i; });
  return b;
};

// Width rule (CSS px; sw = the reach's weight at that point, 0.15 a stream to 2 the Nile's mouth).
export const RIVER_WIDTH = Object.freeze({
  base: 0.5, perW: 1.5, wExp: 0.6, refK: 3, exp: 0.28, // the map width: (base + perW sw^wExp) (k / refK)^exp
  kmBase: 0.08, kmPerW: 0.55, // the real width in km: kmBase + kmPerW sw (the Nile at the delta about 1.2 km)
  capBase: 3, capPerSqrtW: 7 // never wider than this (px)
});
/** A river's full width in CSS px at weight `sw`, zoom k, `pxPerKm` (CSS px per km on the ground). */
export const riverWidthPx = (sw, k, pxPerKm) => {
  const W = RIVER_WIDTH;
  const map = (W.base + W.perW * sw ** W.wExp) * (k / W.refK) ** W.exp;
  const real = (W.kmBase + W.kmPerW * sw) * pxPerKm;
  return Math.min(Math.max(map, real), W.capBase + W.capPerSqrtW * Math.sqrt(sw));
};

/** How much ink a river of weight `sw` gets (0.6 a trickle to 1 a great river). */
export const RIVER_INK = Object.freeze({ min: 0.6, fromW: 0.15, fullW: 0.6 });
export const riverInk = (sw) => {
  const t = Math.max(0, Math.min(1, (sw - RIVER_INK.fromW) / (RIVER_INK.fullW - RIVER_INK.fromW)));
  return RIVER_INK.min + (1 - RIVER_INK.min) * t * t * (3 - 2 * t);
};

/** CSS px per km on the ground at zoom k for a projection of scale `s` (d3: px a radian at k 1). */
export const pxPerKmAt = (k, s) => (k * s) / 6371;

const chaikin = (pts, rounds) => {
  let p = pts;
  for (let r = 0; r < rounds && p.length > 2; r++) {
    const out = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]; const b = p[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
};

const meets = (r, w) => {
  if (!w) return true;
  if (r.maxLat < w.south || r.minLat > w.north) return false;
  for (const shift of [-360, 0, 360]) if (r.maxLon + shift >= w.west && r.minLon + shift <= w.east) return true;
  return false;
};

// Natural Earth weighs some long rivers like streams (the Rhine and the Tigris are 0.35 at most):
// a low rank adds weight, so the rivers a map should lead with read wider than their tributaries.
// Scaled down toward a source (by the weight up to 0.3), so the taper stays.
export const RANK_BOOST = Object.freeze([0.3, 0.3, 0.3, 0.25, 0.22, 0.12, 0.06]);
/** The weight a point is drawn with, from its reach weight `sw` and the reach's rank. */
export const drawnWeight = (sw, rank) => sw + (RANK_BOOST[rank] || 0) * Math.min(1, sw / 0.3);

/** A reach's points in a band: [[lon, lat, sw]...] (the drawn weight ramps from w0 to w1 along its length). */
export const reachPoints = (r, band) => {
  const { level, smooth, stepKm } = RIVER_BANDS[band];
  const pts = [];
  const last = r.lon.length - 1;
  const stepDeg = stepKm / 111.2;
  for (let i = 0; i <= last; i++) {
    if (r.level[i] > level) continue;
    if (stepDeg && i > 0 && i < last && pts.length) {
      const p = pts[pts.length - 1];
      if (Math.hypot((r.lon[i] - p[0]) * Math.cos((r.lat[i] * Math.PI) / 180), r.lat[i] - p[1]) < stepDeg) continue;
    }
    pts.push([r.lon[i], r.lat[i], 0]);
  }
  let total = 0; const along = [0];
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot((pts[i][0] - pts[i - 1][0]) * Math.cos((pts[i][1] * Math.PI) / 180), pts[i][1] - pts[i - 1][1]);
    along.push(total);
  }
  pts.forEach((p, i) => { p[2] = drawnWeight(total ? r.w0 + ((r.w1 - r.w0) * along[i]) / total : r.w0, r.rank); });
  return chaikin(pts, smooth);
};

/**
 * The river lines of a band for the GPU, one triangle strip a reach (so a river has no joints of
 * its own to overlap): two vertices a point, { cur, prev, next: Float32Array (lon, lat a vertex),
 * info: Float32Array (weight, rank, side -1 or 1, the reach's first longitude: its wrap anchor),
 * index: Uint32Array, vertices, reaches }. `window` { west, east, south, north } (degrees) keeps
 * the reaches that meet it (null: the world); `rankCap` drops the ranks not shown yet.
 */
export const riverStrips = (reaches, band, window = null, rankCap = Infinity) => {
  const maxRank = Math.min(RIVER_BANDS[band].maxRank, rankCap);
  const lists = [];
  let points = 0; let segs = 0;
  reaches.forEach((r) => {
    if (r.rank > maxRank || !meets(r, window)) return;
    const pts = reachPoints(r, band);
    if (pts.length < 2) return;
    lists.push([r.rank, pts]);
    points += pts.length; segs += pts.length - 1;
  });
  const n = points * 2;
  const cur = new Float32Array(n * 2); const prev = new Float32Array(n * 2); const next = new Float32Array(n * 2);
  const info = new Float32Array(n * 4); const index = new Uint32Array(segs * 6);
  let v = 0; let ix = 0;
  lists.forEach(([rank, pts]) => {
    const anchor = pts[0][0];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)];
      for (const side of [-1, 1]) {
        cur[v * 2] = p[0]; cur[v * 2 + 1] = p[1];
        prev[v * 2] = a[0]; prev[v * 2 + 1] = a[1];
        next[v * 2] = b[0]; next[v * 2 + 1] = b[1];
        info[v * 4] = p[2]; info[v * 4 + 1] = rank; info[v * 4 + 2] = side; info[v * 4 + 3] = anchor;
        v++;
      }
      if (i > 0) { const q = v - 4; index.set([q, q + 1, q + 2, q + 1, q + 3, q + 2], ix); ix += 6; }
    });
  });
  return { cur, prev, next, info, index, vertices: n, reaches: lists.length };
};

/**
 * The river bands to keep clear in the close view (trees and fields never stand in a river), as
 * screen discs { x, y, r } along the lines drawn there: `project(lat, lon)` -> { x, y } or null,
 * `widthPx(sw)` the drawn width, `area` the lat/lon window, `k` the zoom (the ranks shown).
 */
export const riverDiscs = ({ reaches, project, width, height, area, k, widthPx, margin = 40 }) => {
  const out = [];
  if (!reaches || !area) return out;
  const band = Math.max(3, riverBandAt(k));
  const window = { west: area.west, east: area.east, south: area.south, north: area.north };
  reaches.forEach((rc) => {
    if (riverFade(rc.rank, k) < 0.05 || rc.rank > RIVER_BANDS[band].maxRank || !meets(rc, window)) return;
    const pts = reachPoints(rc, band).map(([lon, lat, sw]) => { const p = project(lat, lon); return p && { x: p.x, y: p.y, sw }; });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]; const b = pts[i + 1];
      if (!a || !b || Math.abs(b.x - a.x) > width) continue;
      if ((a.x < -margin && b.x < -margin) || (a.y < -margin && b.y < -margin) || (a.x > width + margin && b.x > width + margin) || (a.y > height + margin && b.y > height + margin)) continue;
      const r = widthPx((a.sw + b.sw) / 2) / 2 + 1.5;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / Math.max(2, r)));
      for (let s = 0; s < steps; s++) out.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps, r });
      if (i === pts.length - 2) out.push({ x: b.x, y: b.y, r });
    }
  });
  return out;
};
