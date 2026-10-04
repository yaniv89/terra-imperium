// scripts/geo/build-hex-coast.mjs
// Writes src/data/geo/hexLand.json: the land as GeoJSON with the coast along hex edges, softened
// (src/data/geo/hexCoast.js). Run after build:tiles and before build:raster / build:pyramid,
// which paint the Earth from it.
//   node scripts/geo/build-hex-coast.mjs
// The game modules use extensionless imports, so they are loaded through Vite's SSR loader.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { getTiles } = await server.ssrLoadModule('/src/data/geo/tiles.js');
  const { buildHexLand } = await server.ssrLoadModule('/src/data/geo/hexCoast.js');
  const t0 = Date.now();
  const features = buildHexLand(getTiles());
  const out = path.join(root, 'src/data/geo/hexLand.json');
  writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }));
  const points = features.reduce((n, f) => n + f.geometry.coordinates.reduce((m, r) => m + r.length, 0), 0);
  console.log(`hexLand.json: ${features.length} landmasses, ${points} points, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
} finally {
  await server.close();
}
