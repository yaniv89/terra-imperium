// src/data/geo/rasterDetail.js
// Phase F: the finer raster levels and the land cover channel (scripts/geo/build-raster-detail.mjs)
// for the close view of the WebGL map. Pure helpers plus one fetch; nothing here draws.
//
//   Level 6 colour  public/map/tiles/6/{x}-{y}.webp, LAND TILES ONLY (the manifest lists them).
//                   Where a level 6 tile is missing (open sea, the poles) draw level 5 instead:
//                   `bestColourTile` gives the tile to use and the sub-rectangle of it.
//   Land cover      public/map/cover/{z}/{x}-{y}.png at levels 5 and 6, one class byte a pixel
//                   (read the red channel): LAND_COVER[value]. Tiles without land are not stored
//                   (all water).
//   Manifest        public/map/tiles/detail.json { version, tile, detail: { 6: ['x-y', ...] },
//                   cover: { classes, levels: { 5: [...], 6: [...] } }, sources }.
// Same equirectangular layout as the pyramid (rasterTiles.js): level z is 2^(z+1) x 2^z tiles.
import { RASTER_MAX_Z } from './rasterTiles';

// The order is the contract with the build script (LAND_COVER there); rasterDetail.test.js checks it.
export const LAND_COVER = Object.freeze(['water', 'ice', 'rock', 'desert', 'steppe', 'grassland', 'forest', 'rainforest', 'tundra', 'wetland', 'irrigated']);
export const DETAIL_MAX_Z = 6;

const baseUrl = () => {
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return base.endsWith('/') ? base : `${base}/`;
};
export const detailManifestUrl = () => `${baseUrl()}map/tiles/detail.json`;
export const colourTileUrl = (z, x, y) => `${baseUrl()}map/tiles/${z}/${x}-${y}.webp`;
export const coverTileUrl = (z, x, y) => `${baseUrl()}map/cover/${z}/${x}-${y}.png`;

/** An index over the manifest: which colour and cover tiles exist above the pyramid. */
export const makeDetailIndex = (manifest) => {
  const colour = new Map(); const cover = new Map();
  Object.entries(manifest?.detail || {}).forEach(([z, keys]) => colour.set(Number(z), new Set(keys)));
  Object.entries(manifest?.cover?.levels || {}).forEach(([z, keys]) => cover.set(Number(z), new Set(keys)));
  const maxZ = Math.max(RASTER_MAX_Z, ...colour.keys());
  return {
    maxZ,
    classes: manifest?.cover?.classes || LAND_COVER,
    /** True when the colour tile exists: every pyramid level is complete, above it land only. */
    hasColour: (z, x, y) => z <= RASTER_MAX_Z || !!colour.get(z)?.has(`${x}-${y}`),
    /** True when a land cover tile exists (no tile = all water). */
    hasCover: (z, x, y) => !!cover.get(z)?.has(`${x}-${y}`),
    coverLevels: [...cover.keys()].sort((a, b) => a - b)
  };
};

/**
 * The colour tile to draw for tile (z, x, y): itself when it exists, else the nearest ancestor
 * that does, with the part of it that covers (z, x, y) as fractions { u0, v0, u1, v1 }.
 */
export const bestColourTile = (index, z, x, y) => {
  let zz = Math.min(z, index.maxZ); let xx = x >> (z - zz); let yy = y >> (z - zz);
  while (zz > 0 && !index.hasColour(zz, xx, yy)) { zz--; xx >>= 1; yy >>= 1; }
  const span = 2 ** (z - zz);
  const u0 = (x - xx * span) / span; const v0 = (y - yy * span) / span;
  return { z: zz, x: xx, y: yy, url: colourTileUrl(zz, xx, yy), u0, v0, u1: u0 + 1 / span, v1: v0 + 1 / span };
};

/** The land cover class name of a byte read from a cover tile. */
export const coverClassOf = (value) => LAND_COVER[value] ?? 'water';

let loading = null;
/** Fetches the manifest once (null when it is missing: draw the pyramid only). */
export const loadDetailIndex = () => {
  loading ||= fetch(detailManifestUrl()).then((r) => (r.ok ? r.json() : null)).then((m) => (m ? makeDetailIndex(m) : null)).catch(() => null);
  return loading;
};
