// scripts/build-edge-engine.mjs
// Bundles src/engine/gameReducer.js (and everything it pulls in from src/data and src/utils) into
// a single, self-contained ESM file the Supabase Edge Function in supabase/functions/resolve-turn
// can import directly.
//
// Why bundle at all, when the whole point of Task 40 was making gameReducer.js import-clean: Deno
// (the Edge Function runtime) requires explicit file extensions on relative imports, and this
// project's entire src/ tree — like virtually every Vite/webpack/Node-bundler codebase — imports
// extensionlessly ('../data/types', not '../data/types.js'). That's a resolver convention
// difference, not an engine-purity violation (enginePurity.test.js already proves the import
// GRAPH itself never touches React/DOM/a rendering package); bundling is what bridges the two
// conventions without hand-rewriting every import in src/ just for one deploy target.
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.resolve(__dirname, '../src/engine/gameReducer.js');
const OUTFILE = path.resolve(__dirname, '../supabase/functions/resolve-turn/_engine.bundle.js');

export const buildEdgeEngine = () => build({
  entryPoints: [ENTRY],
  outfile: OUTFILE,
  bundle: true,
  format: 'esm',
  // 'neutral' rather than 'browser'/'node': the engine touches neither DOM nor Node built-ins
  // (that's the whole enginePurity guarantee), so no platform-specific shims should be injected —
  // if esbuild ever needed one, that would itself be a sign something impure crept in.
  platform: 'neutral',
  target: 'es2022',
  minify: false,
  sourcemap: false
});

// Run directly (npm run build:edge) as well as importable (the parity test below imports
// buildEdgeEngine to produce a fresh bundle rather than trusting a possibly-stale checked-in one).
if (import.meta.url === `file://${process.argv[1]}`) {
  buildEdgeEngine()
    .then(() => console.log(`Built ${path.relative(process.cwd(), OUTFILE)}`))
    .catch((err) => { console.error(err); process.exit(1); });
}
