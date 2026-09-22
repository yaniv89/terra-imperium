// scripts/build-edge-engine.test.mjs
// Proves the Deno-bound bundle (supabase/functions/resolve-turn/_engine.bundle.js) is a faithful
// transformation of src/engine/gameReducer.js, not just "esbuild didn't error" — same inputs
// through both must produce byte-identical output, since the whole point of a server-authoritative
// resolver (plan §10) is that it computes exactly what the client already computed locally.
//
// Builds a FRESH bundle rather than trusting whatever's on disk (it's gitignored, regenerable,
// and may be stale or absent in a clean checkout) — this test is what actually exercises the
// bundling step in CI, not just a human remembering to run `npm run build:edge` first.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildEdgeEngine } from './build-edge-engine.mjs';
import { createInitialState as sourceCreateInitialState, gameReducer as sourceGameReducer } from '../src/engine/gameReducer.js';
import { ActionTypes } from '../src/data/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = path.resolve(__dirname, '../supabase/functions/resolve-turn/_engine.bundle.js');

let bundled;

describe('the Deno-bound engine bundle behaves identically to its source', () => {
  beforeAll(async () => {
    await buildEdgeEngine();
    // Cache-bust: re-importing the same path across test files/runs would otherwise hit Node's
    // ESM module cache and silently return a stale bundle from a previous run.
    bundled = await import(`${pathToFileURL(BUNDLE_PATH).href}?t=${Date.now()}`);
  });

  it('produces a real, non-empty ESM file', async () => {
    const contents = await readFile(BUNDLE_PATH, 'utf8');
    expect(contents.length).toBeGreaterThan(1000);
  });

  it('exports the same functions the source module does', () => {
    expect(typeof bundled.createInitialState).toBe('function');
    expect(typeof bundled.gameReducer).toBe('function');
  });

  // createInitialState draws a fresh random rngSeed each call (src/utils/rng.js's randomSeed()) —
  // real, deliberate randomness, not something bundling should collapse. Pinning it to the same
  // fixed value on both sides isolates the comparison to "does everything else match" without
  // masking a genuine divergence anywhere else in the (38-key) state shape.
  const withFixedSeed = (state) => ({ ...state, rngSeed: 0 });

  it('createInitialState produces identical state to the source, for the same inputs', () => {
    const sourceState = sourceCreateInitialState({ playerNationId: 'fr' });
    const bundledState = bundled.createInitialState({ playerNationId: 'fr' });
    expect(typeof bundledState.rngSeed).toBe('number');
    expect(withFixedSeed(bundledState)).toEqual(withFixedSeed(sourceState));
  });

  it('gameReducer resolves a real sequence of actions identically to the source', () => {
    const actions = [
      { type: ActionTypes.ADVANCE_TURN },
      { type: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: 'fr' } },
      { type: ActionTypes.ADVANCE_TURN }
    ];

    // Both sides start from the identical fixed-seed state — resolveTurn.js only ever advances
    // rngSeed deterministically from whatever it's handed (createRng/getSeed, src/utils/rng.js),
    // so this is a real determinism check, not one papering over the seed difference above.
    let sourceState = withFixedSeed(sourceCreateInitialState({ playerNationId: 'fr' }));
    let bundledState = withFixedSeed(bundled.createInitialState({ playerNationId: 'fr' }));
    actions.forEach((action) => {
      sourceState = sourceGameReducer(sourceState, action);
      bundledState = bundled.gameReducer(bundledState, action);
    });

    expect(bundledState).toEqual(sourceState);
  });

  it('the bundle never imports anything unresolved (esbuild would have failed the build already, but confirm no bare import survived)', async () => {
    const contents = await readFile(BUNDLE_PATH, 'utf8');
    expect(contents).not.toMatch(/^\s*import\s/m);
  });
});
