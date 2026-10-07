// src/worldgen/worldPackage.js
// A generated world ready to install: the tiles binary (tilesCodec.js, the same format as Earth's
// tiles.bin), the coast (hexCoast.js buildHexLand, so the map clips territories to it as it does to
// hexLand.json on Earth), the quality report and the hash. Pure; runs in the worldgen worker, in
// the turn and battle workers when the cache is empty, and in Node.
import { generateWorld } from './index';
import { encodeTiles } from '../data/geo/tilesCodec';
import { tilesFromRaw } from '../data/geo/tiles';
import { buildHexLand } from '../data/geo/hexCoast';

export const buildWorldPackage = (spec, grid, { onProgress = () => {}, coast = true } = {}) => {
  const { raw, report } = generateWorld(spec, grid, { onProgress: (f, stage) => onProgress(f * 0.85, stage) });
  const tiles = encodeTiles(raw);
  let land = null;
  if (coast) {
    onProgress(0.88, 'coast');
    land = buildHexLand(tilesFromRaw(raw), { chunked: false });
  }
  onProgress(1, 'done');
  return { tiles, land, report, worldHash: raw.world.worldHash };
};
