// scripts/geo/fetch-raw.mjs
// Downloads the raw Natural Earth source files this pipeline builds from. Natural Earth data is
// public domain (no attribution required) — see https://www.naturalearthdata.com/about/terms-of-use/.
// Raw files are large (~40MB for the admin-1 layer) and fully regenerable, so they're gitignored
// rather than committed; only build.mjs's processed output under src/data/geo/ is checked in.

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '.raw');

const SOURCES = {
  'admin0.geojson': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
  'admin1.geojson': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson'
};

const fetchFile = async (name, url) => {
  const dest = path.join(RAW_DIR, name);
  if (existsSync(dest)) {
    console.log(`skip ${name} (already downloaded)`);
    return;
  }
  console.log(`fetching ${name} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`  wrote ${name} (${(buf.length / 1024 / 1024).toFixed(1)}MB)`);
};

await mkdir(RAW_DIR, { recursive: true });
for (const [name, url] of Object.entries(SOURCES)) {
  await fetchFile(name, url);
}
