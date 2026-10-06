// scripts/geo/build-tile-terrain.mjs
// Phase F, the data half (plans/MASTER-PLAN.md 6.9 and 14; world art plan sections 3 to 6): adds
// terrain columns to src/data/geo/tiles.json that the maps and battles read through
// src/data/geo/terrainData.js. Runs after build-tiles.mjs and before build-tiles-bin.mjs (the
// `npm run build:tiles` chain does both); every column build-tiles.mjs wrote stays byte-identical.
//
//   riverSize  Uint16, per tile: 2 bits per edge (bits 2k..2k+1 = the edge to neighbors[k]), the
//              size class of the river on that edge: 0 none, 1 stream, 2 river, 3 great river.
//              Only edges the `rivers` mask already marks get a size (the mask is unchanged), from
//              the Natural Earth 1:10M river that crosses them: scalerank 0 to 2 is great, 3 to 5
//              a river, 6 to 8 a stream (RIVER_CLASS_BY_SCALERANK).
//   range      Int16, per tile: the mountain range a mountain tile belongs to (a connected group of
//              mountain tiles), -1 elsewhere. `rangeNames[r]` is its Natural Earth name or null,
//              `rangeSizes[r]` its tile count.
//   ridge      Uint8, per tile: bit k = a ridge line runs from this tile to neighbors[k]. The
//              ridges of a range are its maximum spanning forest by the lower end's elevation, so
//              every range is one connected chain that follows its high ground.
//   pass       Uint8, per tile: 1 on a mountain pass, a mountain tile with passable lowland on two
//              separate sides that is lower than its mountain neighbours (PASS_RULES; see the
//              passes section). Armies cross a pass at the hills cost instead of the mountain cost.
//
// Inputs: src/data/geo/tiles.json, scripts/geo/.raw/ne/ne_10m_rivers_lake_centerlines.geojson and
// ne_10m_geography_regions_polys.geojson (fetch with `npm run fetch:tiles`).
// Run: node scripts/geo/build-tile-terrain.mjs   (a few seconds). Deterministic.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tilesFromRaw } from '../../src/data/geo/tiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '.raw');
const TILES = path.join(__dirname, '../../src/data/geo/tiles.json');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const log = (...a) => console.log(...a);

export const RIVER_CLASS_BY_SCALERANK = (rank) => (rank <= 2 ? 3 : rank <= 5 ? 2 : 1);
export const PASS_RULES = { minLowlandGroups: 2, minHigherNeighbours: 2 };

const raw = readJson(TILES);
const tiles = tilesFromRaw(raw);
const n = raw.count;
const { neighbors } = tiles;
const isMountain = (i) => raw.land[i] === 1 && raw.reliefNames[raw.relief[i]] === 'mountains';
const passable = (i) => raw.land[i] === 1 && raw.terrainNames[raw.terrain[i]] !== 'snow' && raw.featureNames[raw.feature[i]] !== 'ice';

// ---- rivers: the size class of every marked edge -----------------------------------------------
const riverSize = new Uint16Array(n);
const setSize = (a, b, size) => {
  const ka = neighbors[a].indexOf(b); const kb = neighbors[b].indexOf(a);
  if (ka < 0 || kb < 0) return false;
  if (!(raw.rivers[a] & (1 << ka)) || !(raw.rivers[b] & (1 << kb))) return false;
  const cur = (riverSize[a] >> (2 * ka)) & 3;
  if (size <= cur) return true;
  riverSize[a] = (riverSize[a] & ~(3 << (2 * ka))) | (size << (2 * ka));
  riverSize[b] = (riverSize[b] & ~(3 << (2 * kb))) | (size << (2 * kb));
  return true;
};
const rivers = readJson(path.join(RAW, 'ne', 'ne_10m_rivers_lake_centerlines.geojson'));
let matched = 0;
// The same walk as build-tiles.mjs (samples every 0.15 degrees, the nearest two cells share the
// edge), largest rivers last so the biggest class wins where two rivers share an edge.
rivers.features
  .filter((f) => (f.properties.scalerank ?? 12) <= 8 && !(f.properties.featurecla && /lake/i.test(f.properties.featurecla)))
  .forEach((f) => {
    const size = RIVER_CLASS_BY_SCALERANK(f.properties.scalerank ?? 12);
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
    lines.forEach((line) => {
      for (let s = 0; s < line.length - 1; s++) {
        const [x0, y0] = line[s]; const [x1, y1] = line[s + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot((x1 - x0) * Math.cos((y0 * Math.PI) / 180), y1 - y0) / 0.15));
        for (let t = 0; t < steps; t++) {
          const lon = x0 + ((x1 - x0) * t) / steps; const lat = y0 + ((y1 - y0) * t) / steps;
          const [a, b] = tiles.nearest(lat, lon, 2);
          if (a >= 0 && b >= 0 && setSize(a, b, size)) matched++;
        }
      }
    });
  });
// Any marked edge the walk above missed (rounding of the stored centres) is a stream.
let defaulted = 0;
for (let i = 0; i < n; i++) {
  for (let k = 0; k < neighbors[i].length; k++) {
    if (!(raw.rivers[i] & (1 << k)) || ((riverSize[i] >> (2 * k)) & 3)) continue;
    const j = neighbors[i][k];
    setSize(i, j, 1);
    if (!((riverSize[i] >> (2 * k)) & 3)) { riverSize[i] |= 1 << (2 * k); }
    defaulted++;
  }
}
const sizeCounts = [0, 0, 0, 0];
for (let i = 0; i < n; i++) for (let k = 0; k < 6; k++) { const s = (riverSize[i] >> (2 * k)) & 3; if (s && i < (neighbors[i][k] ?? -1)) sizeCounts[s]++; }
log(`rivers: ${matched} samples matched, ${defaulted} edge sides defaulted to streams; edges by class: stream ${sizeCounts[1]}, river ${sizeCounts[2]}, great ${sizeCounts[3]}`);

// ---- mountain ranges: connected mountain tiles, split by Natural Earth's named ranges ---------
// A connected mass of mountain tiles (the Himalaya, Karakoram and Hindu Kush touch on this grid)
// is split by name: each tile inside a named range polygon takes that name, the unnamed tiles of
// the mass take the nearest named tile's (a breadth-first flood from all of them, in tile order),
// and every (mass, name) pair is one range. A mass with no named tile is one unnamed range.
// Natural Earth's named ranges (featurecla Range/mtn): each range takes the name most of its tiles
// fall inside (a tile counts for the smallest polygon holding it, so a sub-range beats its parent).
const ringContains = (ring, x, y) => {
  let inside = false;
  for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const [xa, ya] = ring[a]; const [xb, yb] = ring[b];
    if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
};
const regions = readJson(path.join(RAW, 'ne', 'ne_10m_geography_regions_polys.geojson')).features
  .map((f) => ({ ...f, properties: { cla: f.properties.FEATURECLA ?? f.properties.featurecla ?? '', name: f.properties.NAME_EN ?? f.properties.name_en ?? f.properties.NAME ?? f.properties.name ?? null } }))
  .filter((f) => /range|mtn|plateau|foothills/i.test(f.properties.cla) && f.properties.name)
  .map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity; let area = 0;
    polys.forEach((p) => p[0].forEach(([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }));
    area = (maxX - minX) * (maxY - minY);
    const isRange = /range|mtn/i.test(f.properties.cla);
    return { name: f.properties.name, polys, minX, minY, maxX, maxY, area, isRange };
  })
  .sort((a, b) => (a.isRange === b.isRange ? a.area - b.area : a.isRange ? -1 : 1));
const nameAt = (i) => {
  const lat = raw.lat[i] / 1000; const lon = raw.lon[i] / 1000;
  for (const r of regions) {
    if (lon < r.minX || lon > r.maxX || lat < r.minY || lat > r.maxY) continue;
    if (r.polys.some((p) => ringContains(p[0], lon, lat) && !p.slice(1).some((h) => ringContains(h, lon, lat)))) return r.name;
  }
  return null;
};
const comp = new Int32Array(n).fill(-1);
const label = new Array(n).fill(null);
const range = new Int16Array(n).fill(-1);
const rangeTiles = []; const rangeNames = [];
let comps = 0;
for (let i = 0; i < n; i++) {
  if (!isMountain(i) || comp[i] >= 0) continue;
  const list = [i]; comp[i] = comps;
  for (let q = 0; q < list.length; q++) for (const j of neighbors[list[q]]) if (isMountain(j) && comp[j] < 0) { comp[j] = comps; list.push(j); }
  list.sort((x, y) => x - y);
  let frontier = list.filter((t) => (label[t] = nameAt(t)) != null);
  while (frontier.length) {
    const next = [];
    frontier.forEach((t) => neighbors[t].forEach((j) => { if (comp[j] === comps && label[j] == null && !next.includes(j)) { label[j] = label[t]; next.push(j); } }));
    frontier = next.sort((x, y) => x - y);
  }
  const byName = new Map();
  list.forEach((t) => { const key = label[t] ?? ''; if (!byName.has(key)) byName.set(key, []); byName.get(key).push(t); });
  [...byName.keys()].sort().forEach((key) => {
    const id = rangeTiles.length;
    byName.get(key).forEach((t) => { range[t] = id; });
    rangeTiles.push(byName.get(key)); rangeNames.push(key || null);
  });
  comps++;
}
if (rangeTiles.length > 32767) throw new Error('too many ranges for Int16');
const rangeSizes = rangeTiles.map((l) => l.length);

// ---- ridges: per range, the maximum spanning forest by the lower end's elevation (Kruskal) ------
const ridge = new Uint8Array(n);
const parent = new Int32Array(n).map((_, i) => i);
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
const edges = [];
for (let i = 0; i < n; i++) {
  if (!isMountain(i)) continue;
  for (const j of neighbors[i]) if (j > i && isMountain(j)) edges.push([Math.min(raw.elevation[i], raw.elevation[j]), i, j]);
}
edges.sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2]);
edges.forEach(([, i, j]) => {
  const a = find(i); const b = find(j);
  if (a === b) return;
  parent[a] = b;
  ridge[i] |= 1 << neighbors[i].indexOf(j); ridge[j] |= 1 << neighbors[j].indexOf(i);
});

// ---- passes ------------------------------------------------------------------------------------
// A pass is a mountain tile that joins two lowlands across a chain: the passable non-mountain land
// around it falls into two or more separate groups (going round its neighbours in order), and it
// is a saddle, lower than at least two of its mountain neighbours. A range that has crossing
// tiles but no saddle among them gets its lowest crossing tile as its one pass, so every chain
// thin enough to cross in one tile has a way through.
const pass = new Uint8Array(n);
const lowlandGroups = (i) => {
  const ns = neighbors[i];
  const low = ns.map((j) => passable(j) && !isMountain(j));
  if (low.every(Boolean)) return 1;
  let groups = 0;
  for (let k = 0; k < ns.length; k++) if (low[k] && !low[(k + ns.length - 1) % ns.length]) groups++;
  return groups;
};
rangeTiles.forEach((list) => {
  const crossings = list.filter((i) => passable(i) && lowlandGroups(i) >= PASS_RULES.minLowlandGroups);
  let found = 0;
  crossings.forEach((i) => {
    const higher = neighbors[i].filter((j) => isMountain(j) && raw.elevation[j] > raw.elevation[i]).length;
    if (higher >= PASS_RULES.minHigherNeighbours) { pass[i] = 1; found++; }
  });
  if (!found && crossings.length) {
    const lowest = crossings.slice().sort((x, y) => raw.elevation[x] - raw.elevation[y] || x - y)[0];
    pass[lowest] = 1;
  }
});
const passCount = pass.reduce((a, b) => a + b, 0);
const mountainCount = rangeTiles.reduce((a, l) => a + l.length, 0);
log(`mountains: ${mountainCount} tiles in ${comps} masses, ${rangeTiles.length} ranges (${rangeNames.filter(Boolean).length} named), ${passCount} passes`);
const biggest = rangeTiles.map((l, r) => [l.length, r]).sort((a, b) => b[0] - a[0]).slice(0, 12);
log(`largest ranges: ${biggest.map(([s, r]) => `${rangeNames[r] || '?'} ${s} (${rangeTiles[r].filter((i) => pass[i]).length} passes)`).join(', ')}`);

// ---- write: new keys appended, the rest untouched -----------------------------------------------
const out = { ...raw };
out.riverSize = Array.from(riverSize);
out.range = Array.from(range);
out.rangeNames = rangeNames;
out.rangeSizes = rangeSizes;
out.ridge = Array.from(ridge);
out.pass = Array.from(pass);
out.terrainDataVersion = 1;
writeFileSync(TILES, JSON.stringify(out));
log(`wrote ${path.relative(process.cwd(), TILES)}`);
