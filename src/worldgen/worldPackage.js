// src/worldgen/worldPackage.js
// A generated world ready to install: the tiles binary (tilesCodec.js, the same format as Earth's
// tiles.bin), the coast (hexCoast.js buildHexLand, so the map clips territories to it as it does to
// hexLand.json on Earth), the quality report and the hash. Pure; runs in the worldgen worker, in
// the turn and battle workers when the cache is empty, and in Node.
import { generateWorld } from './index';
import { encodeTiles } from '../data/geo/tilesCodec';
import { tilesFromRaw } from '../data/geo/tiles';
import { buildHexLand } from '../data/geo/hexCoast';
import { paintWorld } from './painter';

// `paint`: also the painted base picture (painter.js), as RGBA bytes { width, height, rgba }; the
// worker encodes it to WebP (paintedPicture below). Off in Node and in the turn and battle workers.
export const buildWorldPackage = (spec, grid, { onProgress = () => {}, coast = true, paint = false, paintWidth = 2048 } = {}) => {
  const { raw, report } = generateWorld(spec, grid, { onProgress: (f, stage) => onProgress(f * (paint ? 0.5 : 0.85), stage) });
  const tiles = encodeTiles(raw);
  let land = null;
  const decorated = coast || paint ? tilesFromRaw(raw) : null;
  if (coast) {
    onProgress(paint ? 0.55 : 0.88, 'coast');
    land = buildHexLand(decorated, { chunked: false });
  }
  let painted = null;
  if (paint) {
    onProgress(0.65, 'painting');
    painted = { width: paintWidth, height: paintWidth / 2, rgba: paintWorld(decorated, paintWidth, paintWidth / 2, { onProgress: (f) => onProgress(0.65 + f * 0.33, 'painting') }) };
  }
  onProgress(1, 'done');
  return { tiles, land, report, worldHash: raw.world.worldHash, painted };
};

/** The painted RGBA as a WebP blob (OffscreenCanvas; null where it is missing). */
export const encodePicture = async (painted) => {
  if (!painted || typeof OffscreenCanvas === 'undefined') return null;
  const canvas = new OffscreenCanvas(painted.width, painted.height);
  canvas.getContext('2d').putImageData(new ImageData(painted.rgba, painted.width, painted.height), 0, 0);
  try { return await canvas.convertToBlob({ type: 'image/webp', quality: 0.9 }); } catch { return canvas.convertToBlob({ type: 'image/png' }); }
};
