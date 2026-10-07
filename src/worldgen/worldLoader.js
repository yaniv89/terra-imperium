// src/worldgen/worldLoader.js
// One world per page load (plans/MAP-VARIATIONS-PLAN.md 3.1). 92 modules read the grid and 33
// keep module caches, so the page never switches worlds while it runs: the world is decided
// before the engine loads, from a small descriptor in localStorage (WORLD_STORAGE_KEY), written
// whenever a game on another world starts or loads, followed by a reload.
//
//   boot (src/index.jsx):      await loadWorld(bootWorldSpec())    then import the app
//   turn and battle workers:   await loadWorld(workerWorldSpec(), { inline: true })
//
// Earth: tiles.bin.gz as before. A generated world: the IndexedDB cache (worldCache.js), else the
// generator in its worker (worldgen.worker.js) on Earth's grid columns, then cached. Workers get
// the descriptor through their name (workerName()), read the same cache, and regenerate inline
// when it is empty (private windows), which gives the same bytes: the generator is deterministic.
import { loadTiles, fetchEarthRaw, setRawTiles, getTiles, loadedWorldSpec } from '../data/geo/tiles';
import { decodeTiles } from '../data/geo/tilesCodec';
import { setLandFeatures } from '../data/geo/loadWorldFeatures';
import { EARTH_SPEC, normalizeSpec, specKey, sameWorld } from './spec';
import { cacheGet, cachePut } from './worldCache';
import { gridOf } from './index';

export const WORLD_STORAGE_KEY = 'terra-imperium-world';
// A new game waiting for the page to boot into its world (StartScreen -> reload -> App starts it).
export const PENDING_START_KEY = 'terra-imperium-pending-start';

/** The world the page should boot into (the last game's), Earth when none is stored. */
export const bootWorldSpec = () => {
  try {
    const s = globalThis.localStorage?.getItem(WORLD_STORAGE_KEY);
    return s ? normalizeSpec(JSON.parse(s)) : EARTH_SPEC;
  } catch { return EARTH_SPEC; }
};

/** Remembers the world for the next boot. */
export const rememberWorldSpec = (spec) => {
  try { globalThis.localStorage?.setItem(WORLD_STORAGE_KEY, JSON.stringify(normalizeSpec(spec))); } catch { /* storage unavailable */ }
};

/** The world this page runs (the loaded grid's descriptor). */
export const currentWorldSpec = () => normalizeSpec(loadedWorldSpec());
export const isCurrentWorld = (spec) => sameWorld(spec, currentWorldSpec());

/** The name a turn or battle worker is created with: it carries the world descriptor. */
export const workerName = () => `world:${JSON.stringify(currentWorldSpec())}`;
/** Inside a worker: the descriptor its creator named it with (Earth when absent). */
export const workerWorldSpec = () => {
  try {
    const name = globalThis.self?.name || '';
    return name.startsWith('world:') ? normalizeSpec(JSON.parse(name.slice(6))) : EARTH_SPEC;
  } catch { return EARTH_SPEC; }
};

let worker = null; let nextId = 1;
const pending = new Map();
/** Runs the generator in the worldgen worker: a promise of { tiles, land, report, worldHash }. */
export const generateInWorker = (spec, grid, { onProgress = () => {}, coast = true } = {}) => {
  if (typeof Worker === 'undefined') return Promise.reject(new Error('no workers'));
  if (!worker) {
    worker = new Worker(new URL('./worldgen.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, progress, stage, result, error } = e.data || {};
      const p = pending.get(id);
      if (!p) return;
      if (progress != null) { p.onProgress(progress, stage); return; }
      pending.delete(id);
      if (error) p.reject(new Error(error)); else p.resolve(result);
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, spec, grid, coast });
  });
};

const install = (pkg) => {
  setRawTiles(decodeTiles(pkg.tiles));
  if (pkg.land) setLandFeatures(pkg.land);
  return getTiles();
};

/**
 * Loads a world into this page (once, before the engine is imported). `inline`: generate on this
 * thread when the cache is empty (the workers); otherwise the worldgen worker runs it.
 * `onProgress(fraction, stage)` for a progress bar. Resolves to the decorated grid.
 */
export const loadWorld = async (spec, { inline = false, onProgress = () => {} } = {}) => {
  const s = normalizeSpec(spec);
  if (s.kind !== 'generated') return loadTiles();
  const key = specKey(s);
  const hit = await cacheGet(key);
  if (hit && (!s.worldHash || hit.worldHash === s.worldHash)) return install(hit);
  const grid = gridOf(await fetchEarthRaw());
  let pkg;
  if (inline) {
    const { buildWorldPackage } = await import('./worldPackage');
    pkg = buildWorldPackage(s, grid, { onProgress });
  } else {
    pkg = await generateInWorker(s, grid, { onProgress });
  }
  await cachePut(key, pkg);
  return install(pkg);
};

/** Earth's grid columns for the start screen preview (no install). */
export const earthGrid = async () => gridOf(await fetchEarthRaw());
