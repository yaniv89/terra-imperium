// src/worldgen/index.js
// The generator by version (plans/MAP-VARIATIONS-PLAN.md 3.2: versions are frozen; an old save
// names the version that built its world, and that version stays in the code).
import { generateWorldV1 } from './v1/generate';
import { normalizeSpec } from './spec';

const GENERATORS = { 1: generateWorldV1 };

/** { raw, report } for a generated spec on `grid` (Earth's grid columns: count, lat, lon, neighbors). */
export const generateWorld = (spec, grid, options = {}) => {
  const s = normalizeSpec(spec);
  if (s.kind !== 'generated') throw new Error('generateWorld needs a generated spec');
  const gen = GENERATORS[s.generatorVersion];
  if (!gen) throw new Error(`Unknown world generator version ${s.generatorVersion}`);
  return gen(s, grid, options);
};

const flatCache = new WeakMap();
// The flat neighbour column (6 a cell, -1 pads a pentagon) of a raw grid or a decorated one.
const flatNeighbors = (tiles) => {
  const nbs = tiles.neighbors;
  if (!Array.isArray(nbs) || !Array.isArray(nbs[0])) return nbs;
  let flat = flatCache.get(nbs);
  if (flat) return flat;
  flat = new Int32Array(tiles.count * 6).fill(-1);
  for (let i = 0; i < tiles.count; i++) nbs[i].forEach((j, k) => { flat[i * 6 + k] = j; });
  flatCache.set(nbs, flat);
  return flat;
};

/** The grid part of a tiles raw or a decorated grid (what every world shares). */
export const gridOf = (tiles) => ({ count: tiles.count, lat: tiles.lat, lon: tiles.lon, neighbors: flatNeighbors(tiles), frequency: tiles.frequency, orientation: tiles.orientation });
