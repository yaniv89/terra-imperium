// src/components/map/gl/terrainModel.js
// Phase F, the rendering half (plans/MASTER-PLAN.md 5.4 and 7 row 14; world art plan 3 to 6):
// mountain chains for the WebGL map as plain lists (no three.js), from the terrain columns of the
// grid (src/data/geo/terrainData.js). GLMapView.jsx draws them in the terrain pass, between the
// Earth and the territories, so the fog mask hides them where nothing is explored and the grey
// wash greys them where the land is explored but out of sight. The rivers are vector lines from
// Natural Earth (riverModel.js, riverLayer.js), no longer the grid's hex edges (phase F2 drew
// those and they zigzagged): the river edges stay the rules only.
//
//   Mountains  chains along the ridge lines (ridgeEdgesOf): peaks spaced along each ridge edge in
//              screen pixels, the highest kept where two would overlap, lower and gapped on a pass
//              (isPass) so the saddle reads as a way through; a pass mark on each pass tile from
//              the region zoom. Up to the close zoom, where the close view's 3D ridges take over.
// World units are the map projection's (mapView.js); every list is cached per projection.
// Art (ART-PRODUCTION-PLAN batch 14, spec S11): these lines and sprites are the placeholders for
// the `map-terrain/rivers` kit (src/assets/map/terrain/rivers.glb, banks and fords for the close
// view) and `map-terrain/mountain-ridges` (src/assets/map/terrain/mountain-ridges.glb).
import { getTiles } from '../../../data/geo/tiles';

export const MOUNTAIN_SPRITES_FROM_K = 1;
export const PASS_MARK_FROM_K = 2.5;

const cacheBy = () => new WeakMap(); // projection -> value (a resize makes a new projection)

// A world point for a lat/lon, unwrapped next to `near` (an x in world units) so a line never
// spans the whole world at the date line.
const unwrapX = (x, near, worldW) => (near == null ? x : x + worldW * Math.round((near - x) / worldW));

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
