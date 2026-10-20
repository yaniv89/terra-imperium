// src/components/map/gl/mapView.js
// The WebGL map's camera in plain numbers (no three.js), shared by the renderer, picking and tests.
// World units are the d3 equirectangular projection's pixels at zoom 1 (as the old SVG map), the
// d3-zoom transform { x, y, k } maps them to the screen: screen = world * k + (x, y). The world
// repeats every `worldW` units east and west, so x is free: the view is wrapped back to the copy
// whose centre is nearest, and every anchor is drawn at its copy nearest the view's centre.

/** The world rectangle of the projection: { x, y, width, height } in world units. */
export const worldRect = (projection) => {
  const [x0, y0] = projection([-180, 90]); const [x1, y1] = projection([180, -90]);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
};

/** `x` moved by whole worlds to the copy nearest `centre`. */
export const wrapNear = (x, centre, worldW) => x + worldW * Math.round((centre - x) / worldW);

/**
 * The view for the layers: the world's top-left on screen, the zoom, the screen size, the device
 * pixel ratio, the world width and the view centre (wrapped into the world's own copy), the
 * projection's centre and scale for the territory shader.
 */
export const viewFor = ({ transform, width, height, dpr, projection, raster }) => {
  const k = transform.k;
  const worldW = raster.width;
  const cx = (width / 2 - transform.x) / k;
  const camX = wrapNear(cx, raster.x + worldW / 2, worldW);
  const shift = camX - cx; // whole worlds
  const [pcx, pcy] = projection.translate();
  return {
    k, width, height, dpr, worldW,
    worldLeft: -transform.x / k + shift, worldTop: -transform.y / k,
    camX, copyShift: 0, raster,
    proj: { cx: pcx, cy: pcy, s: projection.scale() }
  };
};

/** The world point under a screen point, wrapped into the world's own copy. */
export const screenToWorld = (view, sx, sy) => {
  const x = view.worldLeft + sx / view.k; const y = view.worldTop + sy / view.k;
  return [wrapNear(x, view.raster.x + view.worldW / 2, view.worldW), y];
};

/** The screen point of a world point (at its copy nearest the view's centre). */
export const worldToScreen = (view, wx, wy) => [(wrapNear(wx, view.camX, view.worldW) - view.worldLeft) * view.k, (wy - view.worldTop) * view.k];

/** The smallest zoom with no empty band east or west: the screen never shows more than one world. */
export const minZoomFor = (width, raster) => Math.max(1, width / raster.width);

/**
 * The hit a screen point picks among `hits` (sceneModel.js), last first, or null. A hit's box is
 * centred at its anchor's screen point plus its offset; `round` hits are discs.
 * A round hit may ask for a finger-sized disc with `minR` (CSS px: its radius is never smaller,
 * whatever the zoom) and for `nearest`: among the `nearest` hits a point falls in, the one whose
 * centre is closest wins, not the last drawn (city badges at the strategic zoom are a few pixels
 * across and stand close together: playtest audit I074). A hit that is not `nearest` still wins
 * over every hit before it in the list, as before.
 */
export const pickHit = (view, hits, sx, sy) => {
  const k = view.k;
  let best = null; let bestD = Infinity;
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    const [ax, ay] = worldToScreen(view, h.anchor[0], h.anchor[1]);
    const o = h.offset || [0, 0, 0, 0]; const e = h.exp || [0, 0];
    const cx = ax + o[0] + o[2] * k ** e[1]; const cy = ay + o[1] + o[3] * k ** e[1];
    const w = h.size[0] * k ** e[0]; const hh = h.size[1] * k ** e[0];
    const [px, py] = Array.isArray(h.pad) ? h.pad : [h.pad || 0, h.pad || 0];
    if (h.round) {
      const d = Math.hypot(sx - cx, sy - cy);
      if (d > Math.max(w / 2 + px, h.minR || 0)) continue;
      if (!h.nearest) return best || h;
      if (d < bestD) { best = h; bestD = d; }
      continue;
    }
    if (Math.abs(sx - cx) <= w / 2 + px && Math.abs(sy - cy) <= hh / 2 + py) return best || h;
  }
  return best;
};

/**
 * How far one wheel event zooms, as d3-zoom's wheelDelta (the zoom is multiplied by 2^delta).
 * d3's own rule is -deltaY x 0.002 (x 10 for a pinch on a trackpad, which arrives as ctrl+wheel),
 * with no upper limit: one notch of a fast wheel, or one "scroll" of a remote tool, could send
 * 500 or more and zoom several times over (playtest audit I075). Here one event never changes the
 * zoom by more than `maxStep` (2^0.3 = 1.23 times), so the place under the cursor stays there.
 */
export const WHEEL_MAX_STEP = 0.3;
export const wheelZoomDelta = (event, maxStep = WHEEL_MAX_STEP) => {
  const raw = -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * (event.ctrlKey ? 10 : 1);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(-maxStep, Math.min(maxStep, raw));
};

/**
 * The view after the screen changed size. d3's `fitSize` rescales the world to the new screen, so
 * the old { x, y, k } would point at another place, far away at a close zoom (an iPhone's Safari
 * toolbar showing or hiding moved the camera to the fog or the open sea). This keeps the place at
 * the screen's centre and the ground's scale (pixels per degree): `from` and `to` are
 * { projection, width, height }. null when the old view has no real centre.
 */
export const carryTransform = ({ transform, from, to, minK = 1, maxK = Infinity }) => {
  if (!transform || !from?.projection || !to?.projection || !(transform.k > 0)) return null;
  const cx = (from.width / 2 - transform.x) / transform.k; const cy = (from.height / 2 - transform.y) / transform.k;
  const ll = from.projection.invert([cx, cy]);
  if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;
  const k = Math.min(maxK, Math.max(minK, (transform.k * from.projection.scale()) / to.projection.scale()));
  const p = to.projection([ll[0], Math.max(-90, Math.min(90, ll[1]))]);
  if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(k)) return null;
  return { k, x: to.width / 2 - p[0] * k, y: to.height / 2 - p[1] * k };
};

/** A transform the camera may take: finite numbers and a positive zoom. */
export const isSaneTransform = (t) => !!t && Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.k) && t.k > 0;

/**
 * The zoom to centre a city at when its sheet opens (Manage, an event's city): the zoom the player
 * already chose, never pulled out below `minFocusK` (a sensible "this city and its land" zoom) nor
 * past `maxK`. Opening a city used to reset the zoom to `minFocusK` every time, a big zoom out on a
 * phone where players sit in the close view (plans/ui/fix-mobile).
 */
export const focusZoomFor = (currentK, minFocusK, maxK = Infinity) => {
  const k = Number.isFinite(currentK) && currentK > 0 ? currentK : minFocusK;
  return Math.min(maxK, Math.max(minFocusK, k));
};

/** Earth's mean radius in km: d3's equirectangular scale is pixels per radian at zoom 1. */
export const EARTH_RADIUS_KM = 6371;

/** The closest zoom shows this many hexes across the screen (Civilization-style: a unit never fills the screen). */
export const HEXES_ACROSS_AT_MAX_ZOOM = 3.5;
/**
 * The camera's closest zoom for a screen `width` px wide whose projection has d3 `scale`
 * (pixels per radian at zoom 1): HEXES_ACROSS_AT_MAX_ZOOM hex spacings (`hexKm`, 77 km) across the
 * width, at most `cap`, never short of `floorK` (a usable close view).
 */
export const maxZoomFor = ({ width, scale, hexKm = 77, cap = 200, floorK = 30 }) => {
  const k = (width * EARTH_RADIUS_KM) / (HEXES_ACROSS_AT_MAX_ZOOM * hexKm * scale);
  return Math.max(floorK, Math.min(cap, Number.isFinite(k) ? k : cap));
};

/**
 * The first view of a game (a new game, a loaded one with no camera remembered, plans/ui/start-zoom):
 * close on the capital, `viewKm` of ground over the screen's height (about twice the city's land,
 * so it fills about half the screen), never short of `minK` (the close view, where the town shows)
 * nor past `maxK`. The same ground on a phone and a desktop, whatever the screen size. null for no
 * real screen or projection.
 */
export const startZoomFor = ({ height, scale, viewKm, minK = 1, maxK = Infinity }) => {
  if (!(height > 0) || !(scale > 0) || !(viewKm > 0)) return null;
  const k = ((height / viewKm) * EARTH_RADIUS_KM) / scale;
  return Math.min(maxK, Math.max(minK, k));
};
