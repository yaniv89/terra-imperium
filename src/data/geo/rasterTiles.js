// src/data/geo/rasterTiles.js
// The raster pyramid (plans/playtest-1.md P1.2; scripts/geo/build-raster-pyramid.mjs): the
// realistic Earth cut into 256-pixel tiles at levels 0 to RASTER_MAX_Z, equirectangular, level z
// being 2^(z+1) x 2^z tiles. The flat map draws, over its base picture, only the tiles of the
// level that matches the zoom and only those on screen, so the land stays sharp as you zoom in
// and nothing off screen is fetched. Pure.
export const RASTER_MAX_Z = 5;
export const RASTER_TILE = 256;

const baseUrl = () => {
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return base.endsWith('/') ? base : `${base}/`;
};
export const rasterTileUrl = (z, x, y) => `${baseUrl()}map/tiles/${z}/${x}-${y}.webp`;

/** The level whose pixels match the screen: the world drawn `worldScreenPx` wide (device pixels). */
export const rasterZoomFor = (worldScreenPx) => Math.max(0, Math.min(RASTER_MAX_Z, Math.ceil(Math.log2(Math.max(1, worldScreenPx) / (RASTER_TILE * 2)))));

/** The level the base picture already provides (2048 or 4096 wide). */
export const baseRasterZoom = (baseSize) => Math.round(Math.log2(baseSize / (RASTER_TILE * 2)));

/**
 * The tiles to draw: [{ key, z, x, y, rect: { x, y, width, height } }] in the map's projection
 * space, for the level matching the zoom, covering the screen plus `margin` tiles. Empty when the
 * base picture is already as sharp (level at or under `baseZ`).
 * `raster`: the world rectangle in projection space; `transform`: { x, y, k }; `dpr`: device
 * pixels per CSS pixel. `forceZ`: always this level (the close terrain layer reads level 5).
 */
export const visibleRasterTiles = ({ raster, transform, width, height, dpr = 1, baseZ = 3, margin = 1, forceZ = null }) => {
  if (!raster || !transform || width <= 0 || height <= 0) return [];
  const z = forceZ ?? rasterZoomFor(raster.width * transform.k * dpr);
  if (forceZ == null && z <= baseZ) return [];
  const cols = 2 ** (z + 1); const rows = 2 ** z;
  const tw = raster.width / cols; const th = raster.height / rows;
  const x0 = (-transform.x / transform.k - raster.x) / tw; const x1 = ((width - transform.x) / transform.k - raster.x) / tw;
  const y0 = (-transform.y / transform.k - raster.y) / th; const y1 = ((height - transform.y) / transform.k - raster.y) / th;
  const out = [];
  for (let ty = Math.max(0, Math.floor(y0) - margin); ty <= Math.min(rows - 1, Math.floor(y1) + margin); ty++) {
    for (let tx = Math.max(0, Math.floor(x0) - margin); tx <= Math.min(cols - 1, Math.floor(x1) + margin); tx++) {
      // A hair of overlap so the seams never show the ocean colour under them.
      out.push({ key: `${z}/${tx}-${ty}`, z, x: tx, y: ty, rect: { x: raster.x + tx * tw, y: raster.y + ty * th, width: tw * 1.003, height: th * 1.003 } });
    }
  }
  return out;
};
