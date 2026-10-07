// scripts/peoples/build-people-homes.mjs
// The home profile of every people (plans/MAP-VARIATIONS-PLAN.md 6.2): the facts of its real
// capital tile on Earth (Köppen class, terrain, relief, feature, coast, river, latitude), written to
// src/data/geo/peopleHomes.json. On a generated world (or any non-historical map) peoples are
// matched to start sites by affinity with this home (src/engine/worldgen/generatedPeoples.js),
// without loading Earth's grid. Run after build:peoples (it reads peopleCapitals.json):
//   node scripts/peoples/build-people-homes.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const geo = path.join(root, 'src/data/geo');
const tiles = JSON.parse(readFileSync(path.join(geo, 'tiles.json'), 'utf8'));
const built = JSON.parse(readFileSync(path.join(geo, 'peopleCapitals.json'), 'utf8'));
const nbOf = (i) => tiles.neighbors.slice(i * 6, i * 6 + 6).filter((j) => j >= 0);
// A capital on a tile without a class (a forced island) takes its nearest neighbour's class.
const climateAt = (i) => {
  if (tiles.climate[i] >= 0) return tiles.climateNames[tiles.climate[i]];
  const j = nbOf(i).find((x) => tiles.climate[x] >= 0);
  return j != null ? tiles.climateNames[tiles.climate[j]] : 'Cfb';
};
const out = {};
Object.keys(built.capitals).sort().forEach((id) => {
  const t = built.capitals[id];
  if (t == null) return;
  out[id] = {
    k: climateAt(t),
    t: tiles.terrainNames[tiles.terrain[t]],
    r: tiles.reliefNames[tiles.relief[t]],
    f: tiles.featureNames[tiles.feature[t]],
    c: tiles.coastal[t] === 1 ? 1 : 0,
    v: tiles.rivers[t] ? 1 : 0,
    lat: Math.round(tiles.lat[t] / 1000)
  };
});
writeFileSync(path.join(geo, 'peopleHomes.json'), `${JSON.stringify(out)}\n`);
console.log(`peopleHomes.json: ${Object.keys(out).length} peoples`);
