// src/data/geo/worldRaster.js
// The realistic shaded-relief Earth (plans/civ-map-rework.md, B4b), built by
// scripts/geo/build-world-raster.mjs into public/map/. Equirectangular, so one file serves as
// the flat map background and as the globe texture. Phones get the 2048 version (a 4096 texture
// is over the limit of some mobile GPUs and four times the download).
export const WORLD_RASTER_SIZES = [2048, 4096];

const baseUrl = () => {
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return base.endsWith('/') ? base : `${base}/`;
};

export const worldRasterUrl = (size = 4096) => `${baseUrl()}map/world-${WORLD_RASTER_SIZES.includes(size) ? size : 4096}.webp`;

// Phones and small tablets take the small texture; everything else the big one.
export const worldRasterSizeFor = (width, height) => (Math.max(width || 0, height || 0) <= 1100 ? 2048 : 4096);

// Hex colour -> rgba string with the given alpha, for political fills drawn over the terrain.
export const withAlpha = (hex, alpha) => {
  if (typeof hex !== 'string' || !hex.startsWith('#') || hex.length !== 7) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};
