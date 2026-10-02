// scripts/geo/fetch-tiles-raw.mjs
// Downloads the raw inputs of build-tiles.mjs into scripts/geo/.raw/ (gitignored, regenerable):
// Natural Earth vector layers (public domain) and the 256 zoom-4 terrarium elevation tiles
// (Mapzen/Tilezen, see CREDITS.md). Run once: node scripts/geo/fetch-tiles-raw.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '.raw');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const NE_FILES = [
  'ne_50m_land', 'ne_10m_geography_regions_polys', 'ne_10m_glaciated_areas', 'ne_10m_lakes',
  'ne_10m_rivers_lake_centerlines', 'ne_10m_populated_places_simple'
];
const TERRARIUM = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/4';

const fetchTo = async (url, dest) => {
  if (existsSync(dest)) return false;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return true;
};

await mkdir(path.join(RAW, 'ne'), { recursive: true });
await mkdir(path.join(RAW, 'terrarium4'), { recursive: true });
for (const name of NE_FILES) {
  const got = await fetchTo(`${NE}/${name}.geojson`, path.join(RAW, 'ne', `${name}.geojson`));
  console.log(`${got ? 'fetched' : 'have'} ${name}.geojson`);
}
let fetched = 0;
for (let x = 0; x < 16; x++) {
  for (let y = 0; y < 16; y++) {
    if (await fetchTo(`${TERRARIUM}/${x}/${y}.png`, path.join(RAW, 'terrarium4', `${x}-${y}.png`))) fetched++;
  }
}
console.log(`elevation tiles: fetched ${fetched}, have 256`);
