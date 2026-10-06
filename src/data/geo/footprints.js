// src/data/geo/footprints.js
// Phase F footprints (world art plan section 4): what may stand where inside one hex, as data in
// LOCAL KILOMETRES, never pixels, so screen projection can never change containment.
//
//   Frame      x km east and y km north of the tile centre, on the plane touching the globe there
//              (gnomonic: straight great-circle edges stay straight). Every tile has its own frame.
//   Cell       the real cell polygon (6 corners, 5 beside the 12 pentagons), corner k between
//              neighbours k and k+1, so edge k (shared with neighbors[k]) runs corner k-1 -> k.
//   Safe area  the cell inset by SAFE_INSET of its local width (world plan: 5 to 10%): ordinary
//              town and improvement bases must stay inside it.
//   Reserved   placed in the plan's order: water and steep ground, rivers and crossings, roads,
//              the town (centre and defences), then fields; vegetation fills what is left. A
//              river is a band along its edge (RIVER_BAND_KM by size); a road a strip from the
//              town to the middle of each road edge, a bridge where it meets a river edge.
//   Town       a disk at the centre, TOWN radius by city size, never past TOWN_MAX_SHARE of the
//              distance to the nearest edge (a town is not inflated beyond its cell).
//   Fields     rectangles (FIELD_KM) around the town of a city tile (hugging it) or spread over a
//              farm tile, placed by a seeded walk of candidate points, each fully inside the safe area and clear of the
//              town, the roads, the river bands and each other.
// Pure and deterministic (a hash of the tile id seeds the fields; trigonometry through
// exactMath.js), cheap enough to call per visible tile; cache by (tile, state revision) upstream.
import { getTiles } from './tiles';
import { riverEdgesOf } from './terrainData';
import { sinCosDeg } from '../../utils/exactMath';
import { EARTH_RADIUS_KM } from './geodesic';

export const SAFE_INSET = 0.08;
export const RIVER_BAND_KM = Object.freeze([0, 1.5, 3, 5]); // half-widths of the reserved band by size
export const ROAD_KM = 0.8;                                 // reserved road strip width
export const TOWN = Object.freeze({ baseKm: 4, perSqrtSizeKm: 2.2 });
export const TOWN_MAX_SHARE = 0.4;
export const FIELD_KM = Object.freeze({ long: 6, short: 3, gap: 0.6 });
export const MAX_FIELDS = 28;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => { const l = Math.sqrt(dot(v, v)) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** The tile's local frame: toLocal(unitVector) -> [x km east, y km north]. */
export const localFrame = (tile, tiles = getTiles()) => {
  const c = tiles.centres[tile];
  let east = [-c[1], c[0], 0];
  if (dot(east, east) < 1e-12) east = [1, 0, 0]; // a pole
  east = unit(east);
  const north = cross(c, east);
  return {
    toLocal: (p) => { const d = dot(p, c) || 1e-9; return [(EARTH_RADIUS_KM * dot(p, east)) / d, (EARTH_RADIUS_KM * dot(p, north)) / d]; }
  };
};

/** The cell polygon in local km, corner k between neighbours k and k+1. */
export const cellPolygonKm = (tile, tiles = getTiles()) => {
  const { toLocal } = localFrame(tile, tiles);
  const c = tiles.centres[tile]; const ns = tiles.neighbors[tile];
  return ns.map((n, k) => {
    const a = tiles.centres[n]; const b = tiles.centres[ns[(k + 1) % ns.length]];
    return toLocal(unit([c[0] + a[0] + b[0], c[1] + a[1] + b[1], c[2] + a[2] + b[2]]));
  });
};

/** Edge k of a polygon from cellPolygonKm: [corner k-1, corner k]. */
export const edgeOf = (poly, k) => [poly[(k + poly.length - 1) % poly.length], poly[k]];

const signedArea = (poly) => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const ccw = (poly) => (signedArea(poly) >= 0 ? poly : poly.slice().reverse());

/** Distance from the point to the nearest polygon edge (positive inside a convex polygon). */
export const insideDistance = (poly, p) => {
  const P = ccw(poly); let best = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i]; const b = P[(i + 1) % P.length];
    const ex = b[0] - a[0]; const ey = b[1] - a[1]; const len = Math.sqrt(ex * ex + ey * ey) || 1e-9;
    const d = ((p[0] - a[0]) * ey - (p[1] - a[1]) * ex) / -len; // left of a ccw edge = inside
    if (d < best) best = d;
  }
  return best;
};
export const pointInPolygon = (poly, p) => insideDistance(poly, p) >= 0;

/** A convex polygon moved inward by `km` on every edge (corners where the moved edges meet). */
export const insetPolygon = (poly, km) => {
  const P = ccw(poly); const n = P.length;
  const lines = P.map((a, i) => {
    const b = P[(i + 1) % n]; const ex = b[0] - a[0]; const ey = b[1] - a[1]; const len = Math.sqrt(ex * ex + ey * ey) || 1e-9;
    const nx = -ey / len; const ny = ex / len; // inward normal of a ccw edge
    return { p: [a[0] + nx * km, a[1] + ny * km], d: [ex, ey] };
  });
  return lines.map((l, i) => {
    const m = lines[(i + n - 1) % n];
    const den = m.d[0] * l.d[1] - m.d[1] * l.d[0];
    if (Math.abs(den) < 1e-12) return l.p;
    const t = ((l.p[0] - m.p[0]) * l.d[1] - (l.p[1] - m.p[1]) * l.d[0]) / den;
    return [m.p[0] + m.d[0] * t, m.p[1] + m.d[1] * t];
  });
};

const segDistance = (p, a, b) => {
  const ex = b[0] - a[0]; const ey = b[1] - a[1]; const l2 = ex * ex + ey * ey || 1e-12;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / l2));
  const dx = p[0] - a[0] - ex * t; const dy = p[1] - a[1] - ey * t;
  return Math.sqrt(dx * dx + dy * dy);
};

/** The town disk radius in km for a city of `size` in a cell whose centre is `apothemKm` from its nearest edge. */
export const townRadiusKm = (size, apothemKm) => Math.min(apothemKm * TOWN_MAX_SHARE, TOWN.baseKm + TOWN.perSqrtSizeKm * Math.sqrt(Math.max(1, size)));

// A small integer hash -> [0, 1).
const hash01 = (a, b) => { let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// A rectangle centred at (cx, cy) with its long side along the unit direction (c, s).
const rectCorners = ([cx, cy], long, short, [c, s]) => {
  const hl = long / 2; const hs = short / 2;
  return [[-hl, -hs], [hl, -hs], [hl, hs], [-hl, hs]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
};

const hasRoad = (state, t) => { const ts = state?.world?.tileState?.[t]; return !!ts?.road && !ts.pillaged; };

/**
 * The footprint of one tile: { tileId, cell, safe, apothemKm, rivers, roads, town, fields }.
 * `state` (optional) gives roads, the tile's improvement and its city (a city centred here).
 */
export const tileFootprint = (tile, state = null, tiles = getTiles()) => {
  const cell = cellPolygonKm(tile, tiles);
  const apothemKm = insideDistance(cell, [0, 0]);
  const safe = insetPolygon(cell, apothemKm * 2 * SAFE_INSET);
  const ns = tiles.neighbors[tile];
  const mid = (k) => { const [a, b] = edgeOf(cell, k); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };

  const rivers = riverEdgesOf(tile, tiles).map(({ k, neighbour, size }) => { const [a, b] = edgeOf(cell, k); return { k, neighbour, size, a, b, bandKm: RIVER_BAND_KM[size] }; });
  const riverK = new Set(rivers.map((r) => r.k));
  const roadHere = hasRoad(state, tile);
  const roads = roadHere ? ns.map((n, k) => (hasRoad(state, n) ? { k, neighbour: n, from: [0, 0], to: mid(k), widthKm: ROAD_KM, bridge: riverK.has(k) } : null)).filter(Boolean) : [];

  const cityId = state?.world?.tileOwner?.[tile];
  const city = cityId != null ? state?.regions?.[cityId] : null;
  const isCentre = !!city && city.tile === tile;
  const town = isCentre ? { centre: [0, 0], radiusKm: townRadiusKm(city.size || 1, apothemKm), cityId } : null;

  const improvement = state?.world?.tileState?.[tile]?.pillaged ? null : state?.world?.tileState?.[tile]?.improvement;
  const wantFields = isCentre ? Math.min(MAX_FIELDS, 6 + 2 * (city.size || 1)) : improvement === 'farm' ? MAX_FIELDS : 0;
  const fields = [];
  if (wantFields && tiles.land[tile] === 1) {
    const clearOf = (p, r) => {
      if (insideDistance(safe, p) < r) return false;
      if (town && Math.sqrt(p[0] * p[0] + p[1] * p[1]) < town.radiusKm + r + FIELD_KM.gap) return false;
      if (rivers.some((rv) => segDistance(p, rv.a, rv.b) < rv.bandKm + r)) return false;
      if (roads.some((rd) => segDistance(p, rd.from, rd.to) < rd.widthKm / 2 + r + FIELD_KM.gap)) return false;
      return true;
    };
    const r = Math.sqrt(FIELD_KM.long * FIELD_KM.long + FIELD_KM.short * FIELD_KM.short) / 2; // a plot's circumradius
    const reach = (apothemKm * 2) / Math.sqrt(3); // the corner distance of a regular hex
    for (let i = 0; i < 400 && fields.length < wantFields; i++) {
      // a direction and a distance that favours the land next to the town (fields hug it)
      const d0 = [hash01(tile, 2 * i) * 2 - 1, hash01(tile, 2 * i + 1) * 2 - 1];
      const dl = Math.sqrt(d0[0] * d0[0] + d0[1] * d0[1]);
      if (dl < 0.05 || dl > 1) continue;
      const inner = town ? town.radiusKm + FIELD_KM.gap + r : 0;
      const u = hash01(tile, 3000 + i);
      const dist = inner + (reach - inner) * (town ? u * u : Math.sqrt(u));
      const p = [(d0[0] / dl) * dist, (d0[1] / dl) * dist];
      if (!clearOf(p, r)) continue;
      if (fields.some((f) => Math.sqrt((f.centre[0] - p[0]) ** 2 + (f.centre[1] - p[1]) ** 2) < 2 * r + FIELD_KM.gap)) continue;
      // fields line up roughly with the town (a radial or tangential strip), with a little jitter
      const len = Math.sqrt(p[0] * p[0] + p[1] * p[1]) || 1;
      const radial = [p[0] / len, p[1] / len];
      const along = hash01(tile, 1000 + i) < 0.5 ? radial : [-radial[1], radial[0]];
      const [js, jc] = sinCosDeg((hash01(tile, 2000 + i) - 0.5) * 20);
      const dir = [along[0] * jc - along[1] * js, along[0] * js + along[1] * jc];
      const poly = rectCorners(p, FIELD_KM.long, FIELD_KM.short, dir);
      if (!poly.every((q) => pointInPolygon(safe, q))) continue;
      fields.push({ id: `${tile}:${fields.length}`, centre: p, poly, dir });
    }
  }
  return { tileId: tile, cell, safe, apothemKm, rivers, roads, town, fields, improvement: improvement || null };
};
