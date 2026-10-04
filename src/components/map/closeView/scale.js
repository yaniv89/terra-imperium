// src/components/map/closeView/scale.js
// The close view's sizes, shared with the banner overlay (kept free of three.js so the overlay
// does not pull the 3D engine into the main bundle).
// Pixels per model unit at zoom k.
// Linear up to the super zoom, then slower (power SUPER_GROWTH), so in the super zoom a town
// stays inside its hex and the land around it shows (plans/playtest-1.md P1.1).
export const SUPER_FROM_K = 40;
export const SUPER_GROWTH = 0.7;
export const unitPx = (k) => (k <= SUPER_FROM_K ? Math.max(2, k * 0.55) : SUPER_FROM_K * 0.55 * (k / SUPER_FROM_K) ** SUPER_GROWTH);
// A town never grows past its own hex: its pixels per model unit are capped so its radius (with
// its wall ring) stays within HEX_FILL of the hex's inner radius on screen. Big towns at the super
// zoom were drawn about twice as wide as their hex and spilled over the coast.
export const HEX_FILL = 0.9;
export const townUnitPx = (k, radiusUnits, hexInnerPx) =>
  (hexInnerPx > 0 && radiusUnits > 0 ? Math.min(unitPx(k), (HEX_FILL * hexInnerPx) / radiusUnits) : unitPx(k));
/** A tile's inner radius in projection units (multiply by the zoom k for pixels): half the
 * distance to its nearest neighbour's centre, cached per projection. */
const innerCache = new WeakMap();
export const hexInnerUnits = (projection, tiles, tile) => {
  if (!projection || tile == null) return 0;
  let m = innerCache.get(projection);
  if (!m) { m = new Map(); innerCache.set(projection, m); }
  if (m.has(tile)) return m.get(tile);
  const at = (t) => { const { lat, lon } = tiles.latLonOf(t); return projection([lon, lat]); };
  const c = at(tile);
  let best = Infinity;
  (tiles.neighbors[tile] || []).forEach((n) => {
    const p = at(n);
    // a neighbour across the map's edge projects to the far side: skip it
    if (c && p && Math.abs(p[0] - c[0]) < 50) best = Math.min(best, Math.hypot(p[0] - c[0], p[1] - c[1]) / 2);
  });
  const r = Number.isFinite(best) ? best : 0;
  m.set(tile, r);
  return r;
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
