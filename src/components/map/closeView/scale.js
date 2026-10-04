// src/components/map/closeView/scale.js
// The close view's sizes, shared with the banner overlay (kept free of three.js so the overlay
// does not pull the 3D engine into the main bundle).
// Pixels per model unit at zoom k.
// Linear up to the super zoom, then slower (power SUPER_GROWTH), so in the super zoom a town
// stays inside its hex and the land around it shows (plans/playtest-1.md P1.1).
export const SUPER_FROM_K = 40;
export const SUPER_GROWTH = 0.7;
export const unitPx = (k) => (k <= SUPER_FROM_K ? Math.max(2, k * 0.55) : SUPER_FROM_K * 0.55 * (k / SUPER_FROM_K) ** SUPER_GROWTH);
// Bigger towns read bigger: a medium town is drawn 12% and a big one 25% above its model's size.
export const TIER_SCALE = { small: 1, medium: 1.12, big: 1.25 };
// A town never reaches into the sea: its pixels per model unit are capped so its radius (with its
// wall ring) stays within ROOM_FILL of its `room`, the distance from its centre to the nearest
// coast (half way to the nearest water hex), at most ROOM_MAX_HEXES hex spacings over land.
export const ROOM_FILL = 0.95;
export const ROOM_MAX_HEXES = 1.5;
export const townUnitPx = (k, radiusUnits, roomPx, tierScale = 1) => {
  const natural = unitPx(k) * tierScale;
  return roomPx > 0 && radiusUnits > 0 ? Math.min(natural, (ROOM_FILL * roomPx) / radiusUnits) : natural;
};
/** A town's room in projection units (multiply by the zoom k for pixels): from its tile's centre
 * to the nearest coast, or ROOM_MAX_HEXES spacings inland. Cached per projection. */
const roomCache = new WeakMap();
export const townRoomUnits = (projection, tiles, tile) => {
  if (!projection || tile == null) return 0;
  let m = roomCache.get(projection);
  if (!m) { m = new Map(); roomCache.set(projection, m); }
  if (m.has(tile)) return m.get(tile);
  const at = (t) => { const { lat, lon } = tiles.latLonOf(t); return projection([lon, lat]); };
  const c = at(tile);
  const dist = (t) => { const p = at(t); return c && p && Math.abs(p[0] - c[0]) < 50 ? Math.hypot(p[0] - c[0], p[1] - c[1]) : Infinity; };
  const spacing = Math.min(...(tiles.neighbors[tile] || []).map(dist));
  if (!Number.isFinite(spacing)) { m.set(tile, 0); return 0; }
  let room = ROOM_MAX_HEXES * spacing;
  // water within two rings: the coast lies about half a spacing short of a water hex's centre
  const ring1 = tiles.neighbors[tile] || [];
  const near = new Set([...ring1, ...ring1.flatMap((n) => tiles.neighbors[n] || [])]);
  near.forEach((t) => { if (t !== tile && tiles.land[t] !== 1) room = Math.min(room, dist(t) - spacing / 2); });
  room = Math.max(room, spacing / 4);
  m.set(tile, room);
  return room;
};

// Where an army's soldiers stand, in model units from the province centre (screen x, screen y).
export const ARMY_SPOT = { x: 2.4, y: 1.6 };
// How far the models lean toward the viewer (radians about the screen x axis): the three-quarter
// look of the close view, lower still in the super zoom (plans/playtest-1.md P1.1), from k 40 to 200.
export const TILT_CLOSE = 0.95;
export const TILT_SUPER = 1.2;
export const tiltFor = (k) => {
  const t = Math.max(0, Math.min(1, Math.log(Math.max(1, k) / SUPER_FROM_K) / Math.log(5)));
  return TILT_CLOSE + (TILT_SUPER - TILT_CLOSE) * t;
};

// The lights turn with the tilt so they keep one direction in the models' own space (glTF: y up,
// +z the south side that faces the viewer): the sky straight above, the sun high in the south-west
// as on the art sheets and the Blender previews. Fixed screen-space lights left every south face,
// the side the camera sees, in the dark half of the sky light.
const MODEL_SUN = (() => { const v = [-0.5, 0.7, 0.5]; const l = Math.hypot(...v); return v.map((c) => c / l); })();
const tiltVector = ([x, y, z], tilt) => [x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
/** Screen-space directions for the sky (hemisphere up) and the sun at a tilt. */
export const lightRig = (tilt) => ({ sky: tiltVector([0, 1, 0], tilt), sun: tiltVector(MODEL_SUN, tilt) });
