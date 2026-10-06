// src/components/map/closeView/improvementModels.js
// Artist models of the tile improvements (art spec section 6, Israelite theme section 6) that take
// the place of the procedural works (landscapeModels.js) in the close view. Pure (no three.js);
// unit tested. Drawn instanced by buildingLayer.js from CloseViewLayer.jsx.
//
// Files: src/assets/map/improvements/<kind>[-<age>][-<style>].glb
//   kind   the improvement id of src/data/tileYields.js IMPROVEMENTS (farm, fishing_boats, fort...)
//   age    the first game age the model stands in (bronze, classical, kingdoms, gunpowder, modern);
//          left out, it means bronze. It shows from that age on until a later age has a file. An
//          "ancient" sheet of the spec is bronze, a "modern" one modern; fort-<age> per age.
//   style  the architecture style (src/data/architecture.js) of a regional set; left out, the
//          base set every land falls back to.
//   farm-bronze.glb, farm-modern.glb (the base set); farm-bronze-israelite.glb, fort-modern-
//   israelite.glb (a region's). Each file holds one root object named after the file with LOD0..
//   LOD2 children (scripts/blender/import_improvement.py), materials Town, Team and
//   Ground, at the delivered size: the improvement on its round Ground patch inside a 50 m circle.
//
// Lookup (improvementModelUrl): the latest age at or below the owner's age that has any file for
// the kind wins; within that age the land's style chain (israelite, levant) comes first, then the
// base file. So a later base model beats an earlier regional one, as the towns pick their age's
// model before their style. No file: the procedural work (or the town fields) stays.
import { AGE_ORDER, getAgeIndex } from '../../../data/ages';
import { styleChain } from '../../../data/architecture';

/** Split a file name (no folder, no extension) into { kind, age, style }, or null. */
export const parseImprovementFile = (name) => {
  const m = /^([a-z_]+)((?:-[a-z]+)*)$/.exec(name || '');
  if (!m) return null;
  const rest = m[2].split('-').filter(Boolean);
  let age = 'bronze';
  if (rest.length && AGE_ORDER.includes(rest[0])) age = rest.shift();
  if (rest.length > 1) return null;
  return { kind: m[1], age, style: rest[0] || 'base' };
};

/** Index files by kind: { farm: [{ age, ageIndex, style, url, name }] }. `files` maps a path
 * (any folder, a hashed or plain .glb name) to its url, as import.meta.glob gives it. */
export const indexImprovementFiles = (files) => {
  const out = {};
  Object.entries(files).forEach(([path, url]) => {
    const name = path.match(/([^/]+)\.glb$/)?.[1];
    const p = parseImprovementFile(name);
    if (p) (out[p.kind] ||= []).push({ ...p, ageIndex: getAgeIndex(p.age), url, name });
  });
  return out;
};
const FILES = import.meta.glob('../../../assets/map/improvements/*.glb', { query: '?url', import: 'default', eager: true });
const BY_KIND = indexImprovementFiles(FILES);

/** The file for an improvement on land of this style, owned by a nation in this age, or null. */
export const improvementModel = (kind, ageId, style = null, index = BY_KIND) => {
  const files = index[kind];
  if (!files?.length) return null;
  const now = getAgeIndex(ageId) >= 0 ? getAgeIndex(ageId) : 0;
  const chain = [...styleChain(style), 'base'];
  let best = null; let bestRank = Infinity;
  files.forEach((f) => {
    if (f.ageIndex > now) return;
    const s = chain.indexOf(f.style);
    if (s < 0) return;
    // later age first, then the style chain
    const rank = (now - f.ageIndex) * 100 + s;
    if (rank < bestRank) { best = f; bestRank = rank; }
  });
  return best;
};
export const improvementModelUrl = (kind, ageId, style = null, index = BY_KIND) => improvementModel(kind, ageId, style, index)?.url || null;

/** The object to draw from a loaded file: the one named after the file, else its only object. */
export const improvementRoot = (objs, name) => (objs && ((name && objs[name]) || Object.values(objs)[0])) || null;

// ---- size and placement ---------------------------------------------------------------------------
// The delivered patch is up to 50 m (5 units) across; drawn at IMPROVEMENT_SCALE of the towns'
// pixels per unit (scale.js unitPx, capped by the room to the coast and the next town like a
// town), so the 50 m circle is drawn as 40 m: a farm the size of a small town beside it.
export const IMPROVEMENT_SCALE = 0.8;
// Fishing boats lie on the sea tile with their Ground shoreline on the coast: the coast is found
// on the land mask along the line from the tile's centre to its land (coastShare), and the
// shoreline's middle goes just short of it (SHORE_BACK of that line), so the boats stay on the
// water. Without a coast found on the line it goes BOATS_SHORE of the way (the hex edge lies half
// way to a single land neighbour's centre).
export const BOATS_SHORE = 0.46;
export const SHORE_BACK = 0.03;

/** How far (0..1) along the screen line from `from` to `to` the land begins (`landAt(x, y)`),
 * sampled in `steps`, or null when the line meets no land. */
export const coastShare = (from, to, landAt, steps = 32) => {
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    if (landAt(from.x + (to.x - from.x) * f, from.y + (to.y - from.y) * f)) return f;
  }
  return null;
};

/** Which tiles may carry the model of this kind: boats only on water next to the coast, every
 * other kind only on land. */
export const modelAllowedOnTile = (tiles, tile, kind) => {
  const land = tiles.land[tile] === 1;
  if (kind === 'fishing_boats') return !land && (tiles.neighbors[tile] || []).some((n) => tiles.land[n] === 1);
  return land;
};

/** The coast boats on a water tile face: { lat, lon, toLat, toLon }, the tile's centre and the
 * mean centre of its land neighbours, or null when no land touches the tile. */
export const boatsSpot = (tiles, tile) => {
  const c = tiles.latLonOf(tile);
  const land = (tiles.neighbors[tile] || []).filter((n) => tiles.land[n] === 1).map((n) => tiles.latLonOf(n));
  if (!land.length) return null;
  const unwrap = (lon) => lon + (lon - c.lon > 180 ? -360 : lon - c.lon < -180 ? 360 : 0);
  const toLat = land.reduce((s, p) => s + p.lat, 0) / land.length;
  const toLon = land.reduce((s, p) => s + unwrap(p.lon), 0) / land.length;
  return { lat: c.lat, lon: c.lon, toLat, toLon };
};

/**
 * Where to stand a model (screen pixels) so its ground point `ground` ([x, z] model units, after
 * the turn yawToward gave it) lands `share` of the way from the tile centre `from` to the land
 * centre `to` (screen points); `px` pixels per model unit, `lean` as in yawToward.
 */
export const shoreAnchor = (from, to, ground, px, lean = 1, share = BOATS_SHORE) => {
  const tx = from.x + (to.x - from.x) * share; const ty = from.y + (to.y - from.y) * share;
  const len = ground ? Math.hypot(ground[0], ground[1]) * px : 0;
  const dx = to.x - from.x; const dy = (to.y - from.y) / (lean || 1);
  const d = Math.hypot(dx, dy);
  if (!(d > 1e-6) || !(len > 0)) return { x: tx, y: ty };
  return { x: tx - (dx / d) * len, y: ty - (dy / d) * len * (lean || 1) };
};

/**
 * The turn about the model's up axis (the yaw of an Object3D rotated (tilt, yaw, 0, 'XYZ')) that
 * points the model's ground direction (gx, gz) (glTF: x east, z south) toward a screen direction
 * (dx, dy) (pixels, y down; `lean` the sine of the tilt, as occupancy.js uses it).
 */
export const yawToward = (gx, gz, dx, dy, lean = 1) => {
  if (!(Math.hypot(gx, gz) > 1e-6) || !(Math.hypot(dx, dy) > 1e-6)) return 0;
  // a turn by yaw about y moves the angle atan2(z, x) by -yaw
  return Math.atan2(gz, gx) - Math.atan2(dy / (lean || 1), dx);
};

/**
 * May a model of radius `r` (screen pixels on the ground) stand at screen point `at`? Boats need
 * water under their middle; anything else land under its middle and four points round its rim.
 * Then it must win its disc in the frame's occupancy (occupancy.js: after the towns, the wonders
 * and the landmarks, before the town fields and the trees), so it never overlaps any of them.
 */
export const fitImprovement = ({ boats, at, r, landAt, occ, lean = 1 }) => {
  if (boats) {
    if (landAt(at.x, at.y)) return false;
  } else {
    const rim = r * 0.8;
    if (![[0, 0], [rim, 0], [-rim, 0], [0, rim * lean], [0, -rim * lean]].every(([dx, dy]) => landAt(at.x + dx, at.y + dy))) return false;
  }
  return occ.take(at.x, at.y, r);
};
