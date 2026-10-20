import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The slowest test files (measured 2026-10-20: these 17 take about 1,400 of the suite's 1,670
// seconds, endgameReachability alone about 580). `npm run test:quick` (vitest --mode quick) skips
// them for fast local checks; CI (.github/workflows/ci.yml) always runs the full suite.
export const SLOW_TESTS = [
  'src/engine/endgameReachability.test.js',
  'src/engine/longRun.test.js',
  'src/context/GameContext.test.js',
  'src/engine/resolveTurn.test.js',
  'src/worldgen/worldgen.test.js',
  'scripts/build-edge-engine.test.mjs',
  'src/battle/sim/replay.test.js',
  'src/engine/tacticalBattle.test.js',
  'src/engine/settlers.test.js',
  'src/engine/aiQualityBenchmark.test.js',
  'src/battle/render/unitScale.test.js',
  'src/battle/render/clipBake.test.js',
  'src/engine/worldgen/emergentWorld.test.js',
  'src/data/scenarios.spread.test.js',
  'src/battle/sim/kernel.test.js',
  'src/engine/world/cities.test.js',
  'src/engine/raids.test.js'
];

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  test: {
    environment: 'node',
    // scripts/**/*.test.mjs: build-tooling tests (e.g. the Supabase Edge Function's bundling
    // step) that test a script under scripts/, not app source — kept alongside their target
    // rather than moved into src/.
    include: ['src/**/*.test.js', 'scripts/**/*.test.mjs'],
    exclude: ['**/node_modules/**', '**/.claude/**', ...(mode === 'quick' ? SLOW_TESTS : [])]
  }
}));
