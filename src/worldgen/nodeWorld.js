// src/worldgen/nodeWorld.js
// Node (tests, scripts/simulate.mjs, the balance harness): switch the process to a generated world
// and back (plans/MAP-VARIATIONS-PLAN.md 3.1). The browser never does this: a page boots into one
// world (worldLoader.js). Every module cache keyed by tile id is cleared through onWorldChange.
import { getTiles, setRawTiles, installEarthFromDisk } from '../data/geo/tiles';
import { generateWorld, gridOf } from './index';
import { normalizeSpec, specKey } from './spec';

const generated = new Map(); // specKey -> { raw, report }

/** Generates (once per process) and installs a generated world; returns { spec, report }. */
export const installGeneratedWorld = (spec) => {
  const s = normalizeSpec({ kind: 'generated', ...spec });
  const key = specKey(s);
  let hit = generated.get(key);
  if (!hit) {
    hit = generateWorld(s, gridOf(getTiles()));
    generated.set(key, hit);
  }
  setRawTiles(hit.raw);
  return { spec: hit.raw.world, report: hit.report };
};

/** Back to the real Earth (tiles.json from disk). */
export const installEarth = () => installEarthFromDisk();
