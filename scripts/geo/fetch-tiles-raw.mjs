// scripts/geo/fetch-tiles-raw.mjs
// Downloads the raw inputs of build-tiles.mjs into scripts/geo/.raw/ (gitignored, regenerable):
// Natural Earth vector layers (public domain) and the 256 zoom-4 terrarium elevation tiles
// (Mapzen/Tilezen, see CREDITS.md). Run once: node scripts/geo/fetch-tiles-raw.mjs
// With --pyramid it also fetches what build-raster-pyramid.mjs needs: the 1:10M land and the
// 1,024 zoom-5 elevation tiles (about 75 MB).
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
if (process.argv.includes('--pyramid')) {
  const got = await fetchTo(`${NE}/ne_10m_land.geojson`, path.join(RAW, 'ne', 'ne_10m_land.geojson'));
  console.log(`${got ? 'fetched' : 'have'} ne_10m_land.geojson`);
  await mkdir(path.join(RAW, 'terrarium5'), { recursive: true });
  const jobs = [];
  for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) jobs.push([x, y]);
  let got5 = 0;
  for (let i = 0; i < jobs.length; i += 16) {
    const done = await Promise.all(jobs.slice(i, i + 16).map(([x, y]) => fetchTo(`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/5/${x}/${y}.png`, path.join(RAW, 'terrarium5', `${x}-${y}.png`))));
    got5 += done.filter(Boolean).length;
  }
  console.log(`zoom-5 elevation tiles: fetched ${got5}, have 1024`);
}
// With --detail: the zoom-7 elevation tiles (about 1.2 km a pixel) under the game's land, for
// level 6 of the pyramid (build-raster-detail.mjs). Only tiles that touch a land hex (a land
// cell's centre, a corner or an edge middle of its polygon) within DETAIL_MAX_LAT of the equator:
// 3,931 of 16,384, about 85 kB each.
if (process.argv.includes('--detail')) {
  const { getTiles } = await import('../../src/data/geo/tiles.js');
  const { detailElevationTiles } = await import('./build-raster-detail.mjs');
  const wanted = detailElevationTiles(getTiles());
  await mkdir(path.join(RAW, 'terrarium7'), { recursive: true });
  let got7 = 0;
  for (let i = 0; i < wanted.length; i += 24) {
    const done = await Promise.all(wanted.slice(i, i + 24).map(([x, y]) => fetchTo(`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/7/${x}/${y}.png`, path.join(RAW, 'terrarium7', `${x}-${y}.png`))));
    got7 += done.filter(Boolean).length;
    if (i % 960 === 0) console.log(`zoom-7: ${i}/${wanted.length}`);
  }
  console.log(`zoom-7 elevation tiles: fetched ${got7}, have ${wanted.length}`);
}
