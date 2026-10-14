// scripts/geo/thin-resources.mjs
// Applies the resource thinning (src/data/geo/resourceDensity.js, playtest audit I098) to an
// existing src/data/geo/tiles.json, without the raw downloads build:tiles needs. Only the
// `resource` column changes (and the `resourceDensity` marker is added); every other column stays
// byte identical. A tiles.json already thinned is left alone. Then rebuild the binary:
//   node scripts/geo/thin-resources.mjs && npm run build:tiles-bin
// (npm run thin:resources does both). build-tiles.mjs runs the same pass on a fresh build.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { thinResources, resourceShares, startTilesOf, RESOURCE_DENSITY_VERSION } from '../../src/data/geo/resourceDensity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TILES = path.join(ROOT, 'src/data/geo/tiles.json');
const raw = JSON.parse(readFileSync(TILES, 'utf8'));
const pct = (s) => `all ${(s.all * 100).toFixed(1)}%, bonus ${(s.bonus * 100).toFixed(1)}%, luxury ${(s.luxury * 100).toFixed(1)}%, strategic ${(s.strategic * 100).toFixed(1)}%`;

if ((raw.resourceDensity || 0) >= RESOURCE_DENSITY_VERSION) {
  console.log(`tiles.json is already thinned (resourceDensity ${raw.resourceDensity}): ${pct(resourceShares(raw))} of the land`);
} else {
  const before = resourceShares(raw);
  const deposits = JSON.parse(readFileSync(path.join(ROOT, 'src/data/geo/deposits.json'), 'utf8'));
  const peoplesFile = path.join(ROOT, 'src/data/geo/peopleCapitals.json');
  const peoples = existsSync(peoplesFile) ? JSON.parse(readFileSync(peoplesFile, 'utf8')) : null;
  raw.resource = thinResources(raw, deposits, startTilesOf(raw, peoples));
  raw.resourceDensity = RESOURCE_DENSITY_VERSION;
  writeFileSync(TILES, JSON.stringify(raw));
  console.log(`resources on the land: before ${pct(before)}`);
  console.log(`                       after  ${pct(resourceShares(raw))}`);
}
