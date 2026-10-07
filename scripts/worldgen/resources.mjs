// scripts/worldgen/resources.mjs
// Resource counts per land tile on generated worlds against the real Earth (plans/MAP-VARIATIONS-PLAN.md
// 4.3 step 9: each within 25% of Earth's). Prints a table and the resources outside the band.
//   node scripts/worldgen/resources.mjs [--seeds 1,2,3,4,5] [--shape continents] [--version 2]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : dflt; };
const seeds = arg('seeds', '1,2,3,4,5').split(',').map(Number);
const shape = arg('shape', 'continents');
const version = Number(arg('version', 2));

const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { getTiles } = await server.ssrLoadModule('/src/data/geo/tiles.js');
  const { generateWorld, gridOf } = await server.ssrLoadModule('/src/worldgen/index.js');
  const countsOf = (t) => {
    const lake = t.terrainNames.indexOf('lake');
    let land = 0; const c = {};
    for (let i = 0; i < t.count; i++) {
      const isLand = t.land[i] === 1 && t.terrain[i] !== lake;
      if (isLand) land++;
      const r = t.resource && t.resource[i] >= 0 ? t.resourceNames[t.resource[i]] : null;
      if (r) c[r] = (c[r] || 0) + 1;
    }
    return { land, c };
  };
  const earth = getTiles();
  const e = countsOf(earth);
  const gen = { land: 0, c: {} };
  for (const seed of seeds) {
    const { raw } = generateWorld({ kind: 'generated', generatorVersion: version, seed, params: { shape } }, gridOf(earth));
    const g = countsOf(raw);
    gen.land += g.land;
    Object.entries(g.c).forEach(([k, v]) => { gen.c[k] = (gen.c[k] || 0) + v; });
  }
  const names = [...new Set([...Object.keys(e.c), ...Object.keys(gen.c)])].sort();
  const out = []; const off = [];
  names.forEach((n) => {
    const er = (e.c[n] || 0) / e.land; const gr = (gen.c[n] || 0) / gen.land;
    const ratio = er ? gr / er : (gr ? Infinity : 1);
    out.push(`${n.padEnd(9)} earth ${(er * 1000).toFixed(2).padStart(6)} gen ${(gr * 1000).toFixed(2).padStart(6)} per 1000 land tiles  ratio ${ratio.toFixed(2)}`);
    if (Math.abs(ratio - 1) > 0.25) off.push(`${n} ${ratio.toFixed(2)}`);
  });
  console.log(out.join('\n'));
  console.log(`outside 25%: ${off.length ? off.join(', ') : 'none'} (${seeds.length} worlds, ${shape}, generator ${version})`);
} finally {
  await server.close();
}
