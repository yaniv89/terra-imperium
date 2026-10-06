// src/components/map/closeView/terrainPlacement.js
// Phase F in the close view (world plan 4 and 5), three.js free and unit tested:
//   footprints  each tile's footprint (src/data/geo/footprints.js, local km) cached per tile and
//               what it depends on, and a tile's screen frame (pixels per km east and north) to
//               draw it: the town's legal radius and the fields' plots come from here.
//   ridges      the mountain chains on screen: ridge meshes (mountainModels.js) spaced along every
//               ridge edge of the grid in view, turned along it, overlapping into one chain, lower
//               toward a pass and none in its saddle; foothills on hills tiles beside a range.
//   rivers      the river bands to keep clear (trees never stand in a river), as screen discs.
// Hook for phase B (the city manifest, another branch): `createCloseScene(..., { footprintOf })`
// takes any function (tile, state) -> footprint of this shape; the default is `cachedFootprint`.
import { getTiles } from '../../../data/geo/tiles';
import { tileFootprint, localFrame, insideDistance, RIVER_BAND_KM } from '../../../data/geo/footprints';
import { riverEdgesOf, edgeCorners } from '../../../data/geo/terrainData';
import { tilesInWindow } from '../../../data/geo/tileSpatialIndex';
import { toLatLon } from '../../../data/geo/geodesic';
import { hash01 } from './landscape';

// The ridge mesh's length in model units (mountainModels.js builds it this long along x).
export const RIDGE_LENGTH = 2;
// The town model's radius: the footprint's town disk, or this share of the safe area's inner
// radius when that is larger. The footprint's disk (4 km + 2.2 km x sqrt(size), at most 40% of the
// apothem) reads as a dot at the close zoom; the safe area (world plan 4) is the legal limit for a
// town base, so the town fills TOWN_DRAW_SHARE of it and the plots that would fall under it drop.
export const TOWN_DRAW_SHARE = 0.7;
/** The radius (km) the town model of a footprint is drawn at, never past the safe area. */
export const townDrawRadiusKm = (fp) => (fp?.town ? Math.max(fp.town.radiusKm, insideDistance(fp.safe, [0, 0]) * TOWN_DRAW_SHARE) : 0);

// ------------------------------------------------------------------ footprints
const FOOTPRINT_CACHE = 3000;
const footprints = new Map(); // tile -> { key, fp }
const roadKey = (state, t) => { const s = state?.world?.tileState?.[t]; return s?.road && !s.pillaged ? 1 : 0; };
/** What a tile's footprint depends on in the game state (its city, improvement and roads). */
export const footprintKey = (tile, state, tiles = getTiles()) => {
  const st = state?.world?.tileState?.[tile];
  const cityId = state?.world?.tileOwner?.[tile];
  const city = cityId != null ? state?.regions?.[cityId] : null;
  const centre = city && city.tile === tile ? city.size || 1 : 0;
  return `${centre}|${st?.pillaged ? '' : st?.improvement || ''}|${roadKey(state, tile)}${tiles.neighbors[tile].map((n) => roadKey(state, n)).join('')}`;
};
/** tileFootprint, cached per tile until what it depends on changes. */
export const cachedFootprint = (tile, state, tiles = getTiles()) => {
  const key = footprintKey(tile, state, tiles);
  const hit = footprints.get(tile);
  if (hit && hit.key === key) return hit.fp;
  const fp = tileFootprint(tile, state, tiles);
  if (footprints.size >= FOOTPRINT_CACHE) footprints.delete(footprints.keys().next().value);
  footprints.set(tile, { key, fp });
  return fp;
};

/**
 * The screen frame of a tile: `at([x, y] km)` -> screen { x, y }, from the centre and the pixels per
 * km east and north (the tile is small enough to be flat on screen). `pxPerKm`: their mean length.
 * `project(lat, lon)` -> { x, y } in screen pixels, or null.
 */
export const screenFrame = (tile, project, tiles = getTiles()) => {
  const f = localFrame(tile, tiles);
  const P = (p) => { const ll = toLatLon(f.fromLocal(p)); return project(ll.lat, ll.lon); };
  const c = P([0, 0]); const e = P([10, 0]); const n = P([0, 10]);
  if (!c || !e || !n) return null;
  const ex = [(e.x - c.x) / 10, (e.y - c.y) / 10]; const ny = [(n.x - c.x) / 10, (n.y - c.y) / 10];
  return {
    centre: c, ex, ny,
    pxPerKm: (Math.hypot(ex[0], ex[1]) + Math.hypot(ny[0], ny[1])) / 2,
    at: ([x, y]) => ({ x: c.x + ex[0] * x + ny[0] * y, y: c.y + ex[1] * x + ny[1] * y }),
    dir: ([x, y]) => [ex[0] * x + ny[0] * y, ex[1] * x + ny[1] * y]
  };
};

/**
 * The field plots of a footprint on screen: [{ x, y, angle, len, wid, shade }] (screen px; angle
 * of the long side, screen radians, y down). `frame` from screenFrame.
 */
export const plotsOnScreen = (fp, frame) => fp.fields.map((f, i) => {
  const c = frame.at(f.centre);
  const along = frame.dir(f.dir);
  const across = frame.dir([-f.dir[1], f.dir[0]]);
  const long = Math.hypot(f.poly[1][0] - f.poly[0][0], f.poly[1][1] - f.poly[0][1]);
  const short = Math.hypot(f.poly[2][0] - f.poly[1][0], f.poly[2][1] - f.poly[1][1]);
  return { x: c.x, y: c.y, angle: Math.atan2(along[1], along[0]), len: long * Math.hypot(...along), wid: short * Math.hypot(...across), shade: hash01(fp.tileId, 500 + i) };
});

// ------------------------------------------------------------------ ridges and hills
export const MAX_RIDGES = 1200;
export const MAX_HILLS = 600;
// A ridge mesh covers this many km of its ridge line; neighbours overlap by RIDGE_OVERLAP.
export const RIDGE_KM = 26;
export const RIDGE_OVERLAP = 1.3;
export const PASS_SADDLE = 0.3; // the share of a ridge edge at a pass left empty (the saddle)

/**
 * The mountain chains and foothills in a window of the screen: { ridges: [{ x, y, yaw, sx, sy,
 * sz, variant, snow, visible }], hills: [...] } in screen pixels and model scales, for models
 * standing on the ground at tilt `lean` (sin of the tilt; a model's ground is squashed by it).
 * `project(lat, lon)` -> { x, y }; `area` a lat/lon window; `isExplored`, `isVisible` (fog).
 */
export const reliefOnScreen = ({ project, width, height, area, lean, isExplored = () => true, isVisible = () => true, tiles = getTiles(), margin = 80 }) => {
  const ridges = []; const hills = [];
  if (!area || !tiles.ridge) return { ridges, hills };
  const inView = (p) => p && p.x > -margin && p.y > -margin && p.x < width + margin && p.y < height + margin;
  const pt = (t) => { const ll = tiles.latLonOf(t); return project(ll.lat, ll.lon); };
  const list = tilesInWindow(area);
  const seen = new Set();
  const kmBetween = (a, b) => { const p = tiles.centres[a]; const q = tiles.centres[b]; return 6371 * Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]))); };
  for (const t of list) {
    const mask = tiles.ridge[t];
    if (mask && isExplored(t)) {
      const ns = tiles.neighbors[t];
      for (let k = 0; k < ns.length && ridges.length < MAX_RIDGES; k++) {
        const n = ns[k];
        if (!(mask & (1 << k)) || !isExplored(n)) continue;
        const key = t < n ? `${t}-${n}` : `${n}-${t}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const a = pt(t); const b = pt(n);
        if (!a || !b || !(inView(a) || inView(b)) || Math.abs(b.x - a.x) > width * 2) continue;
        const dx = b.x - a.x; const dy = b.y - a.y;
        const lenPx = Math.hypot(dx, dy);
        const km = kmBetween(t, n);
        const count = Math.max(1, Math.round(km / RIDGE_KM));
        const passA = tiles.isPass(t); const passB = tiles.isPass(n);
        const elev = Math.max(tiles.elevation[t], tiles.elevation[n]);
        const hf = 0.7 + 0.6 * Math.max(0, Math.min(1, (elev - 800) / 3600));
        // tile means sit far under the summits: the Alps' mean is about 1,500 m
        const snow = elev > 1900 - Math.max(0, Math.abs(tiles.lat[t] / 1000) - 35) * 45;
        // the model's x axis along the line, on the squashed ground: yaw and the scale that spans it
        const yaw = Math.atan2(-dy / (lean || 1), dx);
        const groundLen = Math.hypot(dx, dy / (lean || 1));
        const piece = (groundLen / count) * RIDGE_OVERLAP;
        const sx = piece / RIDGE_LENGTH;
        for (let i = 0; i < count; i++) {
          const u = (i + 0.5) / count;
          if ((passA && u < PASS_SADDLE) || (passB && u > 1 - PASS_SADDLE)) continue;
          const nearPass = (passA && u < 0.55) || (passB && u > 0.45);
          const jitter = (hash01(t * 7 + n, i) - 0.5) * 0.12;
          // a little off the line on either side, so a chain is not a fence
          const off = (hash01(t + 3 * i, n) - 0.5) * 0.18 * piece;
          const nx = -dy / (lenPx || 1); const nyy = dx / (lenPx || 1);
          ridges.push({
            x: a.x + dx * (u + jitter / count) + nx * off, y: a.y + dy * (u + jitter / count) + nyy * off * (lean || 1), yaw: yaw + (hash01(n, t + i) - 0.5) * 0.45,
            sx, sy: sx * hf * (nearPass ? 0.55 : 1) * (0.85 + 0.3 * hash01(t, n + i)), sz: sx * (0.9 + 0.3 * hash01(t + i, n)),
            variant: (t + n + i) % 3, snow: snow && !nearPass, visible: isVisible(t) || isVisible(n), lenPx
          });
        }
      }
    }
    // foothills: a hills tile beside a range, two or three mounds hashed round its centre
    if (hills.length < MAX_HILLS && tiles.reliefOf(t) === 'hills' && isExplored(t) && tiles.neighbors[t].some((n) => tiles.range && tiles.range[n] >= 0)) {
      const c = pt(t);
      if (!inView(c)) continue;
      const near = tiles.neighbors[t].map(pt).filter(Boolean);
      const r = near.length ? near.reduce((s, p) => s + Math.hypot(p.x - c.x, p.y - c.y), 0) / near.length : 0;
      const count = 2 + Math.floor(hash01(t, 41) * 2);
      for (let i = 0; i < count; i++) {
        const a = hash01(t, 50 + i) * Math.PI * 2; const d = r * (0.12 + 0.28 * hash01(t, 60 + i));
        const s = r * (0.09 + 0.05 * hash01(t, 70 + i));
        hills.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * lean, yaw: a, sx: s, sy: s, sz: s, visible: isVisible(t) });
      }
    }
  }
  // drawn back to front is the depth buffer's job; north first keeps equal depths stable
  ridges.sort((p, q) => p.y - q.y);
  return { ridges, hills };
};

// ------------------------------------------------------------------ rivers
/**
 * The river bands on screen as discs { x, y, r } (screen px) along every river edge in view: the
 * footprint's band (RIVER_BAND_KM by size) or the drawn river, whichever is wider. `halfPx(size)`:
 * the drawn river's half width.
 */
export const riverDiscsOnScreen = ({ project, width, height, area, pxPerKm, halfPx, tiles = getTiles(), margin = 40 }) => {
  const out = [];
  if (!area) return out;
  const seen = new Set();
  for (const t of tilesInWindow(area)) {
    if (!tiles.rivers[t]) continue;
    for (const { k, neighbour, size } of riverEdgesOf(t, tiles)) {
      const key = t < neighbour ? `${t}-${neighbour}` : `${neighbour}-${t}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const c = edgeCorners(t, k, tiles);
      const a = project(c.from.lat, c.from.lon); const b = project(c.to.lat, c.to.lon);
      if (!a || !b || Math.abs(b.x - a.x) > width) continue;
      if ((a.x < -margin && b.x < -margin) || (a.y < -margin && b.y < -margin) || (a.x > width + margin && b.x > width + margin) || (a.y > height + margin && b.y > height + margin)) continue;
      const r = Math.max(halfPx(size) + 1, RIVER_BAND_KM[size] * pxPerKm);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / Math.max(2, r)));
      for (let i = 0; i <= steps; i++) out.push({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps, r });
    }
  }
  return out;
};
