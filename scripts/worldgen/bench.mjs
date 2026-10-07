// scripts/worldgen/bench.mjs
// Generates worlds in Node and prints the time per world, the quality report and the hash
// (plans/MAP-VARIATIONS-PLAN.md 8.3). Optional preview PNGs (terrain colours, rivers) with --png.
//   node scripts/worldgen/bench.mjs [--seeds 1,2,3] [--land 30] [--continents 0] [--climate temperate] [--png dir]
// The game modules use extensionless imports, so they are loaded through Vite's SSR loader.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : dflt; };
const seeds = arg('seeds', '1,2,3').split(',').map(Number);
const params = { land: Number(arg('land', 30)), continents: Number(arg('continents', 0)), climate: arg('climate', 'temperate'), rainfall: arg('rainfall', 'normal') };
const pngDir = arg('png', null);
const version = Number(arg('version', 0)) || undefined;
const paint = process.argv.includes('--paint'); // the realistic look (painter.js, 2048 x 1024) instead of tile colours
const shape = arg('shape', null);
if (shape) params.shape = shape;

const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { getTiles } = await server.ssrLoadModule('/src/data/geo/tiles.js');
  const { generateWorld, gridOf } = await server.ssrLoadModule('/src/worldgen/index.js');
  const { worldPreviewRgba } = await server.ssrLoadModule('/src/worldgen/preview.js');
  const { tilesFromRaw } = await server.ssrLoadModule('/src/data/geo/tiles.js');
  const { paintWorld } = await server.ssrLoadModule('/src/worldgen/painter.js');
  const grid = gridOf(getTiles());
  for (const seed of seeds) {
    const t0 = performance.now();
    const { raw, report } = generateWorld({ kind: 'generated', seed, params, generatorVersion: version }, grid);
    const ms = performance.now() - t0;
    const r = Object.fromEntries(Object.entries(report).map(([k, v]) => [k, typeof v === 'number' && !Number.isInteger(v) ? Number(v.toFixed(3)) : v]));
    console.log(`seed ${seed}: ${ms.toFixed(0)} ms ${JSON.stringify(r)}`);
    if (pngDir) {
      const { PNG } = require('pngjs');
      const W = paint ? 2048 : 1024; const H = W / 2;
      const png = new PNG({ width: W, height: H });
      png.data.set(paint ? paintWorld(tilesFromRaw(raw), W, H) : worldPreviewRgba(tilesFromRaw(raw), W, H));
      mkdirSync(pngDir, { recursive: true });
      writeFileSync(path.join(pngDir, `world-v${raw.world.generatorVersion}-${seed}${shape ? '-' + shape : ''}.png`), PNG.sync.write(png));
    }
  }
} finally {
  await server.close();
}
