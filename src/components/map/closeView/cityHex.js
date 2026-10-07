// src/components/map/closeView/cityHex.js
// A town fills its own hex (user decision D10, plans/ART-MODELS-PLAN.md section 1): the city's size
// shows in its tier's art (small, medium, big), and every tier's model is scaled so its ground
// covers the hex it stands on, with a small inset, never reaching into a neighbouring hex or the sea.
//   The hex      the tile's real cell (geodesic.js cellPolygon) as the map projects it, in
//                projection units round the projected tile centre (so the same numbers hold for
//                every wrapped copy of the world); edge k, from corner k-1 to corner k, is shared
//                with neighbors[k] (water beyond it when that neighbour is sea). Cached per
//                projection and tile, so a frame never searches the grid.
//   The fit      the models lean toward the viewer (scale.js tiltFor): a ground disc of radius a
//                reads on the flat map as an ellipse a wide and a x sin(tilt) tall. The fit is the
//                largest a whose ellipse stays inside the hex moved in by HEX_INSET of its apothem
//                (centre to nearest edge) on every edge, and by COAST_INSET more on an edge with
//                water beyond (the coast wobbles a few km along the hex edge and rounds its corners).
// Three.js free (the banner overlay and the WebGL map's sprites read it too); unit tested.
import { cellPolygon, toLatLon } from '../../../data/geo/geodesic';
import { unitPx, townUnitPx, townRoomUnits, townGapUnits } from './scale';

// The share of the hex's apothem left free round a town's ground: about 7% of the hex's width.
export const HEX_INSET = 0.14;
// The extra share on an edge facing the sea (the hexLand coast's wobble is about 4 km, a tenth of
// the apothem, and its corner rounding cuts a little deeper).
export const COAST_INSET = 0.12;
// A hex whose corners land this far apart (projection units) is split by the map's wrap: no fit.
const WRAP_LIMIT = 50;

const hexCache = new WeakMap(); // projection -> Map(tile -> hex | null)

/**
 * The tile's hex on the map: { edges: [{ nx, ny, d, water }], corners: [[x, y]], apothem } in
 * projection units round the projected tile centre. (nx, ny) is an edge's inward unit normal and
 * d its distance from the centre, so a point p is inside where nx p.x + ny p.y + d >= 0 on every
 * edge. Null when the hex cannot be projected whole (behind the map's wrap).
 */
export const cityHexOf = (projection, tiles, tile) => {
  if (!projection || !tiles || tile == null || !tiles.centres?.[tile]) return null;
  let m = hexCache.get(projection);
  if (!m) { m = new Map(); hexCache.set(projection, m); }
  if (m.has(tile)) return m.get(tile);
  const hex = projectHex(projection, tiles, tile);
  m.set(tile, hex);
  return hex;
};

const projectHex = (projection, tiles, tile) => {
  const at = (v) => { const { lat, lon } = toLatLon(v); return projection([lon, lat]); };
  const c = at(tiles.centres[tile]);
  if (!c) return null;
  const corners = [];
  for (const v of cellPolygon(tiles.centres, tiles.neighbors, tile)) {
    const p = at(v);
    if (!p || Math.abs(p[0] - c[0]) > WRAP_LIMIT || Math.abs(p[1] - c[1]) > WRAP_LIMIT) return null;
    corners.push([p[0] - c[0], p[1] - c[1]]);
  }
  const ns = tiles.neighbors[tile];
  const edges = ns.map((n, k) => {
    const a = corners[(k + ns.length - 1) % ns.length]; const b = corners[k];
    const ex = b[0] - a[0]; const ey = b[1] - a[1]; const len = Math.hypot(ex, ey) || 1e-12;
    let nx = -ey / len; let ny = ex / len;
    if (-(nx * a[0] + ny * a[1]) < 0) { nx = -nx; ny = -ny; } // point it toward the centre
    return { nx, ny, d: -(nx * a[0] + ny * a[1]), water: tiles.land?.[n] !== 1 };
  });
  return { edges, corners, apothem: Math.min(...edges.map((e) => e.d)) };
};

// How far (projection units) an edge stands in from the hex for a town's ground.
const insetOf = (hex, e) => hex.apothem * (HEX_INSET + (e.water ? COAST_INSET : 0));
// The reach of a ground ellipse (radius 1, squashed by `lean` on screen y) toward an edge.
const reach = (e, lean) => Math.sqrt(e.nx * e.nx + lean * lean * e.ny * e.ny);

/**
 * The largest ground radius (projection units; times the zoom k for pixels) whose ellipse, squashed
 * by `lean` = sin(tilt) on screen y, stays inside the inset hex. Cached on the hex per lean.
 */
export const hexFitUnits = (hex, lean) => {
  if (!hex) return 0;
  if (hex.fitLean === lean) return hex.fit;
  let a = Infinity;
  hex.edges.forEach((e) => { a = Math.min(a, (e.d - insetOf(hex, e)) / reach(e, lean)); });
  hex.fitLean = lean;
  hex.fit = Math.max(0, a);
  return hex.fit;
};

/**
 * Whether a ground disc of radius r (projection units, squashed by `lean`) at (x, y) from the hex's
 * centre lies inside the hex, moved in as for a town's ground unless `inset` is false: a landmark
 * set outside the town's wall stays on its own hex.
 */
export const insideHex = (hex, x, y, r, lean, inset = true) => !!hex && hex.edges.every((e) => e.nx * x + e.ny * y + e.d - (inset ? insetOf(hex, e) : 0) >= r * reach(e, lean));

/**
 * Pixels per model unit for the thing standing on `tile` whose ground is `radius` model units
 * (with its wall ring) at zoom k. A town (`fill`) fills its hex whatever its tier: the tier's art
 * shows the city's size. Anything else (`fill` false: an outpost's camp) keeps its natural size,
 * capped by the hex. Without a hex (the map's wrap) the old room rule: the coast and the gap to
 * the next town (`isTown`), with `tierScale`.
 */
export const hexTownPx = ({ projection, tiles, tile, k, radius, lean, fill = true, isTown = null, tierScale = 1 }) => {
  const hex = cityHexOf(projection, tiles, tile);
  if (hex && radius > 0) {
    const px = (hexFitUnits(hex, lean) * k) / radius;
    return fill ? px : Math.min(unitPx(k), px);
  }
  const room = Math.min(townRoomUnits(projection, tiles, tile), isTown ? townGapUnits(projection, tiles, tile, isTown) : Infinity);
  return townUnitPx(k, radius, Number.isFinite(room) ? room * k : 0, fill ? tierScale : 1);
};
