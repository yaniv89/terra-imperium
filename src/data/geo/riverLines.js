// src/data/geo/riverLines.js
// The map's river lines (riverCodec.js; built by scripts/geo/build-river-lines.mjs): drawing only,
// never game state or rules (the river rules are the grid's river edges, terrainData.js).
//   - in the browser `loadRiverLines()` fetches public/map/rivers.bin.gz once;
//   - in Node (tests, scripts) the file is read from the working tree.
// Earth only: a generated world (worldPictures.proceduralRaster) has no river file.
import { decodeRivers } from './riverCodec.js';

let cached = null;
let loading = null;

const readFromDisk = () => {
  const proc = typeof globalThis.process !== 'undefined' ? globalThis.process : null;
  const fs = proc?.getBuiltinModule?.('fs');
  const zlib = proc?.getBuiltinModule?.('zlib');
  if (!fs || !zlib) return null;
  try { return decodeRivers(zlib.gunzipSync(fs.readFileSync(`${proc.cwd()}/public/map/rivers.bin.gz`))); } catch { return null; }
};

const fileUrl = () => {
  let base = '/';
  try { base = import.meta.env?.BASE_URL || '/'; } catch { /* not under Vite */ }
  return `${base}map/rivers.bin.gz`;
};

// Some servers hand the .gz over already decoded (Content-Encoding), others as the gzip file itself.
const gunzip = async (response) => {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  if (typeof DecompressionStream === 'undefined') return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/** The river reaches if they are in (decodeRivers' shape), else null; Node reads them from disk. */
export const riverLinesNow = () => {
  if (!cached) cached = readFromDisk();
  return cached;
};

/** Loads the river reaches once; resolves to [] when the file cannot be had (no rivers drawn). */
export const loadRiverLines = () => {
  if (riverLinesNow()) return Promise.resolve(cached);
  loading ||= (async () => {
    try {
      const res = await fetch(fileUrl());
      const bytes = res.ok ? await gunzip(res) : null;
      cached = bytes ? decodeRivers(bytes) : [];
    } catch { cached = []; }
    return cached;
  })();
  return loading;
};
