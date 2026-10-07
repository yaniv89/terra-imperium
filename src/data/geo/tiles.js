// src/data/geo/tiles.js
// The world grid (plans/civ-map-rework.md, Part B): a loader over tiles.json, built by
// scripts/geo/build-tiles.mjs. Static data, never part of game state: a tile's dynamic facts
// (owner city, improvement, road, pillaged, seen) live in state as sparse maps keyed by tile id.
//
// The engine is synchronous (createInitialState, resolveTurn, the reducer) but the grid is not in
// any bundle (it was an 8.2 MB JSON in the main chunk, plans/rts-world-review.md 6.4):
//   - in the browser (and the workers) `await loadTiles()` fetches public/map/tiles.bin.gz
//     (tilesCodec.js) before anything reads the grid; src/index.jsx, turn.worker.js and
//     battle.worker.js load the rest of the app only after it;
//   - in Node (tests, scripts) the first getTiles() reads tiles.json from disk;
//   - a bundle that must carry the grid itself (the edge function) imports tilesPreload.js first.
// The per-tile columns are typed arrays either way, decorated once on first use.
import { fromLatLonExact, buildLatLonIndex, cellPolygon, toLatLon } from './geodesic.js';
import { columnsFromJson, decodeTiles } from './tilesCodec.js';

let cached = null;
let rawTiles = null;

// One world per page load (plans/MAP-VARIATIONS-PLAN.md 3.1): the browser boots into a world and
// never switches. Node (tests, scripts) may switch with setRawTiles; modules that keep caches by
// tile id register here and are cleared on every switch.
const worldListeners = new Set();
/** Calls `fn` whenever the grid's columns are replaced (a module-level cache keyed by tile id). */
export const onWorldChange = (fn) => { worldListeners.add(fn); return () => worldListeners.delete(fn); };

/** Hands the grid over (tiles.json's shape; plain or typed-array columns). */
export const setRawTiles = (raw) => { rawTiles = columnsFromJson(raw); cached = null; worldListeners.forEach((fn) => fn()); };

/** The world descriptor of the loaded grid: a generated world's (raw.world) or the real Earth. */
export const loadedWorldSpec = () => (rawTiles?.world ? rawTiles.world : { kind: 'earth' });

// Node only: tiles.json from the working tree (tests and scripts run from the repo root).
const readFromDisk = () => {
  const proc = typeof globalThis.process !== 'undefined' ? globalThis.process : null;
  const fs = proc?.getBuiltinModule?.('fs');
  if (!fs) return null;
  const file = `${proc.cwd().replace(/\\/g, '/')}/src/data/geo/tiles.json`;
  return fs.existsSync(file) ? columnsFromJson(JSON.parse(fs.readFileSync(file, 'utf8'))) : null;
};

const decorate = (raw) => {
  const n = raw.count;
  const centres = new Array(n);
  for (let i = 0; i < n; i++) centres[i] = fromLatLonExact(raw.lat[i] / 1000, raw.lon[i] / 1000);
  const neighbors = new Array(n);
  for (let i = 0; i < n; i++) {
    const ns = [];
    for (let k = 0; k < 6; k++) { const j = raw.neighbors[i * 6 + k]; if (j >= 0) ns.push(j); }
    neighbors[i] = ns;
  }
  const index = buildLatLonIndex(centres);
  const countryTiles = {};
  for (let i = 0; i < n; i++) {
    if (!raw.land[i] || raw.country[i] < 0) continue;
    const cid = raw.countryIds[raw.country[i]];
    (countryTiles[cid] ||= []).push(i);
  }
  return {
    ...raw,
    centres,
    neighbors,
    countryTiles,
    terrainOf: (id) => raw.terrainNames[raw.terrain[id]],
    reliefOf: (id) => raw.reliefNames[raw.relief[id]],
    featureOf: (id) => raw.featureNames[raw.feature[id]],
    countryOf: (id) => (raw.country[id] >= 0 ? raw.countryIds[raw.country[id]] : null),
    resourceOf: (id) => (raw.resource && raw.resource[id] >= 0 ? raw.resourceNames[raw.resource[id]] : null),
    isLand: (id) => raw.land[id] === 1,
    isWater: (id) => raw.land[id] !== 1,
    latLonOf: (id) => toLatLon(centres[id]),
    polygonOf: (id) => cellPolygon(centres, neighbors, id).map(toLatLon),
    nearest: (lat, lon, count = 1) => index.nearest(lat, lon, count),
    // True when the edge from `id` to its neighbour `other` carries a river.
    riverBetween: (id, other) => { const k = neighbors[id].indexOf(other); return k >= 0 && (raw.rivers[id] & (1 << k)) !== 0; },
    // The size class of the river on that edge (terrainData.js RIVER_SIZE): 0 none, 1 stream,
    // 2 river, 3 great river. A grid without the riverSize column calls every river a stream.
    riverSizeBetween: (id, other) => {
      const k = neighbors[id].indexOf(other);
      if (k < 0 || (raw.rivers[id] & (1 << k)) === 0) return 0;
      return raw.riverSize ? ((raw.riverSize[id] >> (2 * k)) & 3) || 1 : 1;
    },
    // A mountain pass (scripts/geo/build-tile-terrain.mjs): crossed at the hills cost.
    isPass: (id) => !!raw.pass && raw.pass[id] === 1
  };
};

export const getTiles = () => {
  if (!cached) {
    if (!rawTiles) rawTiles = readFromDisk();
    if (!rawTiles) throw new Error('The world grid is not loaded yet: await loadTiles() first.');
    cached = decorate(rawTiles);
  }
  return cached;
};

export const tilesLoaded = () => !!rawTiles;

// The binary's URL next to the app (Vite's base; /terra-imperium/ on GitHub Pages).
const binaryUrl = () => {
  let base = '/';
  try { base = import.meta.env?.BASE_URL || '/'; } catch { /* not under Vite */ }
  return `${base}map/tiles.bin.gz`;
};

// Some servers hand the .gz over already decoded (Content-Encoding), others as the gzip file
// itself: the first bytes say which.
const gunzip = async (response) => {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  if (typeof DecompressionStream === 'undefined') return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

let earthLoading = null;
/** Earth's grid as a raw (typed-array columns), fetched and decoded once, without installing it:
 * the world generator builds on its lat, lon and neighbours. */
export const fetchEarthRaw = () => {
  earthLoading ||= (async () => {
    const disk = readFromDisk();
    if (disk) return disk;
    let bytes = null;
    try {
      const res = await fetch(binaryUrl());
      if (res.ok) bytes = await gunzip(res);
    } catch { /* offline or blocked: the JSON below */ }
    let decoded = null;
    try { decoded = bytes ? decodeTiles(bytes) : null; } catch { /* not the binary: the JSON below */ }
    return decoded || columnsFromJson((await import('./tiles.json')).default);
  })();
  return earthLoading;
};

let loading = null;
/** Loads Earth's grid once (fetch and decode the binary; the JSON chunk where gzip streams are missing). */
export const loadTiles = async () => {
  if (rawTiles || readFromDiskOnce()) return getTiles();
  loading ||= fetchEarthRaw().then((raw) => { if (!rawTiles) setRawTiles(raw); });
  await loading;
  return getTiles();
};
let triedDisk = false;
const readFromDiskOnce = () => {
  if (triedDisk) return false;
  triedDisk = true;
  const r = readFromDisk();
  if (r) rawTiles = r;
  return !!r;
};

let earthDisk = null;
/** Node only: back to the real Earth from disk (tests that switched to a generated world). */
export const installEarthFromDisk = () => {
  earthDisk ||= readFromDisk();
  if (!earthDisk) throw new Error('tiles.json is not on disk');
  setRawTiles(earthDisk);
};

// For tests and scripts that already hold a raw JSON of their own.
export const tilesFromRaw = (raw) => decorate(raw);
