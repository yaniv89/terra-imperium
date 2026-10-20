// src/components/map/closeView/scale.js
// The close view's sizes, shared with the banner overlay (kept free of three.js so the overlay
// does not pull the 3D engine into the main bundle).
import { hexSizeVsF75, kmPerRing } from '../../../data/geo/gridScale';
import { EARTH_RADIUS_KM } from '../../../data/geo/geodesic';

// Pixels per model unit at zoom k. Every 3D model on the map has ONE world size (user rule
// 2026-10-20): pixels per unit are exactly proportional to the zoom, at every zoom, so a model only
// looks bigger because the camera is closer. The constant is the size at the zoom where the close
// view opens (CLOSE_K): 5.5 px per unit there. No floor, no slower growth in the super zoom.
// Model sizes follow the hex: HEX (0.75 at frequency 100, hexSizeVsF75) shrinks every model so a
// hex stays HEX_UNITS model units across on any grid; the close view opens HEX times later
// (CLOSE_ZOOM_K in Map2DView), so at its first zoom a town looks as it did on the 106 km grid.
export const HEX = hexSizeVsF75();
export const CLOSE_K = 10 / HEX;
export const SUPER_FROM_K = 40; // only the tilt and the tree density change from here, never a size
export const unitPx = (k) => HEX * 0.55 * k;
// A town fills its own hex (cityHex.js, decision D10): the tier's art shows the city's size. The
// rules below are the fallback where a hex cannot be projected whole (the map's wrap), and the cap
// for wonders and improvements: there a medium town is drawn 12% and a big one 25% above its size.
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

/** Half the distance (projection units) from a town to the nearest other town within three rings,
 * or Infinity: two towns never grow into each other. `isTown(tile)` says whether a tile holds a
 * town (the close view and the banners build it once a frame from the cities). */
// Cached per (isTown, projection, tile) like townRoomUnits: callers that keep `isTown` stable while
// the towns stay the same (a memoised function) pay the three-ring search once per town, not per frame.
const gapCache = new WeakMap(); // isTown -> WeakMap(projection -> Map(tile -> gap))
export const townGapUnits = (projection, tiles, tile, isTown) => {
  if (!projection || tile == null) return Infinity;
  let byProjection = gapCache.get(isTown);
  if (!byProjection) { byProjection = new WeakMap(); gapCache.set(isTown, byProjection); }
  let m = byProjection.get(projection);
  if (!m) { m = new Map(); byProjection.set(projection, m); }
  if (m.has(tile)) return m.get(tile);
  const gap = townGapSearch(projection, tiles, tile, isTown);
  m.set(tile, gap);
  return gap;
};
const townGapSearch = (projection, tiles, tile, isTown) => {
  const at = (t) => { const { lat, lon } = tiles.latLonOf(t); return projection([lon, lat]); };
  const c = at(tile);
  let best = Infinity;
  const seen = new Set([tile]);
  let frontier = [tile];
  for (let ring = 0; ring < 3; ring++) {
    const next = [];
    frontier.forEach((f) => (tiles.neighbors[f] || []).forEach((n) => {
      if (seen.has(n)) return;
      seen.add(n); next.push(n);
      if (!isTown(n)) return;
      const p = at(n);
      if (c && p && Math.abs(p[0] - c[0]) < 50) best = Math.min(best, Math.hypot(p[0] - c[0], p[1] - c[1]) / 2);
    }));
    frontier = next;
  }
  return best;
};

// Army figures and settler parties (closeViewScene.js placeArmies), as Civilization draws units:
// they are scaled up against the land on purpose, but always fit inside their hex. A figure is
// FIGURE_HEIGHT_HEX of a hex spacing tall (hex-relative world size: it grows in proportion to the
// zoom, no pixel floor), a group of one to three stands in at most GROUP_WIDTH_HEX of the hex, and
// the group's spot is a small step off the hex centre so the group never leaves the hex.
// Readability when the hex is small comes from the army's banner, a flat sprite of one screen size.
export const FIGURE_HEIGHT_HEX = 0.45;
export const FIGURE_WIDTH_RATIO = 0.45; // a figure's width (spear and shield) over its height
export const GROUP_WIDTH_HEX = 0.65;
export const SETTLER_FIGURE_SHARE = 0.6;
// ONE unit model is drawn per tile (tileStack.js), standing on its hex: at the centre of a plain hex
// (a small step toward the viewer so the feet are on the ground), and on a city's hex a little
// further forward, at the front edge of the town (not behind its houses) and still inside the hex.
export const ARMY_SPOT_HEX = { x: 0, y: 0.1 };
export const CITY_SPOT_HEX = { x: 0, y: 0.42 };
/** Where the tile's unit stands, in pixels from the tile's centre (screen x, y down). */
export const armySpotPx = (hexPx, inCity = false) => { const s = inCity ? CITY_SPOT_HEX : ARMY_SPOT_HEX; return [s.x * hexPx, s.y * hexPx]; };
/** One hex spacing (neighbour to neighbour) in screen pixels at zoom k, measured north-south. */
export const hexPxOf = (projection, k, tiles) => (projection.scale() * k * kmPerRing(tiles)) / EARTH_RADIUS_KM;
/** The scale of a figure whose model is `modelHeight` units tall, in a hex of `hexPx`. `classFactor`: MODEL_SCALE of its class. */
export const figureScale = (hexPx, modelHeight, classFactor = 0.88) => (FIGURE_HEIGHT_HEX * hexPx * Math.min(1.15, classFactor / 0.88)) / Math.max(1e-6, modelHeight);
/** The gap between the figures of a group of n (side: 1.1 men, 2.8 elephants) so the group is at most GROUP_WIDTH_HEX wide. */
export const figureGap = (hexPx, figureHeightPx, n, side = 1.1) => {
  const w = FIGURE_WIDTH_RATIO * figureHeightPx;
  return n < 2 ? w : Math.min(w, (GROUP_WIDTH_HEX * hexPx - w) / ((n - 1) * side));
};
/** The most a thing standing in one hex may be (pixels per model unit) so its ground radius `radiusUnits` stays inside the hex (HEX_FIT of the half spacing). Proportional to the zoom, like every model. */
export const HEX_FIT = 0.95;
export const hexCapPx = (hexPx, radiusUnits) => (radiusUnits > 0 ? (HEX_FIT * 0.5 * hexPx) / radiusUnits : Infinity);
/** A fleet's ships (n of them, SHIP_HALF_LENGTH units of ship, spaced SHIP_SPACING ship scales): pixels per unit that keep the fleet inside its hex. */
export const SHIP_HALF_LENGTH = 1.9;
export const SHIP_SPACING = 2.2;
export const fleetCapPx = (hexPx, n) => hexCapPx(hexPx, ((n - 1) / 2) * SHIP_SPACING + SHIP_HALF_LENGTH);
/** Where an army's banner hangs over its soldiers, in pixels from its tile (one rule for the WebGL map and the SVG map). */
export const armyBannerOffset = (hexPx, inCity = false) => { const [x, y] = armySpotPx(hexPx, inCity); return [x, y - FIGURE_HEIGHT_HEX * hexPx * 0.85 - 10]; };

// How far the models lean toward the viewer (radians about the screen x axis, 0 = seen from the
// side, pi/2 = straight down). About 35 degrees: a low three-quarter look, so towers, walls and
// roofs show their sides and read as 3D models; a touch lower still in the super zoom (from k 40
// to 200). The old values (0.95 and 1.2) looked near top-down, almost 2D.
export const TILT_CLOSE = 0.62;
export const TILT_SUPER = 0.58;
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
