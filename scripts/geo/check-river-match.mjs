// scripts/geo/check-river-match.mjs
// Do the drawn rivers follow the gameplay river edges (tiles.json)? The drawn rivers are the map's
// river lines (public/map/rivers.bin.gz, build-river-lines.mjs) or, with --painted, the raster
// painting's lines (river-paint.mjs, off since the vector lines). For each
// gameplay river edge in a box, the distance from the middle of the edge to the nearest painted
// river line; and the other way round, for the painted rivers of rank 0 to 6 (the ones that
// matter for crossings) the distance to the nearest gameplay edge. A hex is about 77 km across,
// so an edge within 45 km of a painted river is "the same river".
// Run: node scripts/geo/check-river-match.mjs [--box lon0,lat0,lon1,lat1] [--max-km 45] [--painted]
// Exit code 1 when fewer than 90 % of the gameplay edges are matched.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTiles } from '../../src/data/geo/tiles.js';
import { loadRiverLines, RIVER_MAX_RANK } from './river-paint.mjs';
import { riverLinesNow } from '../../src/data/geo/riverLines.js';

const RAW = path.join(path.dirname(fileURLToPath(import.meta.url)), '.raw');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const box = (arg('box', '-180,-90,180,90')).split(',').map(Number);
const MAX_KM = Number(arg('max-km', 45));

const km = (lat1, lon1, lat2, lon2) => {
  const dx = (lon2 - lon1) * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180); const dy = lat2 - lat1;
  return Math.hypot(dx, dy) * 111.2;
};
const inBox = (lat, lon) => lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];

const lines = process.argv.includes('--painted')
  ? loadRiverLines(RAW, { maxRank: RIVER_MAX_RANK[6] })
  : riverLinesNow().map((r) => ({ rank: r.rank, line: Array.from(r.lon, (lon, i) => [((lon + 540) % 360) - 180, r.lat[i]]) }));
// A spatial hash of densified painted-river points (0.1 degree cells).
const CELL = 0.1; const grid = new Map();
const put = (lat, lon, rank) => { const k = `${Math.floor(lon / CELL)},${Math.floor(lat / CELL)}`; (grid.get(k) || grid.set(k, []).get(k)).push([lat, lon, rank]); };
lines.forEach(({ line, rank }) => {
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i]; const [bx, by] = line[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.03));
    for (let s = 0; s <= n; s++) put(ay + ((by - ay) * s) / n, ax + ((bx - ax) * s) / n, rank);
  }
});
const nearestPainted = (lat, lon, maxRank = 99) => {
  let best = Infinity;
  const cx = Math.floor(lon / CELL); const cy = Math.floor(lat / CELL);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (const [la, lo, rank] of grid.get(`${cx + dx},${cy + dy}`) || []) {
    if (rank > maxRank) continue;
    const d = km(lat, lon, la, lo); if (d < best) best = d;
  }
  return best;
};

const tiles = getTiles();
// every river edge once (the same walk as terrainData.js riverEdgeList, which Node cannot import)
const edges = [];
for (let a = 0; a < tiles.count; a++) {
  if (!tiles.rivers[a]) continue;
  for (const b of tiles.neighbors[a]) { if (b <= a) continue; const size = tiles.riverSizeBetween(a, b); if (size) edges.push({ a, b, size }); }
}
const mid = ({ a, b }) => { const p = tiles.latLonOf(a); const q = tiles.latLonOf(b); return { lat: (p.lat + q.lat) / 2, lon: Math.abs(p.lon - q.lon) > 180 ? p.lon : (p.lon + q.lon) / 2 }; };
const bySize = { 1: [], 2: [], 3: [] };
const edgeMids = [];
edges.forEach((e) => {
  const m = mid(e);
  if (!inBox(m.lat, m.lon)) return;
  edgeMids.push(m);
  bySize[e.size].push(nearestPainted(m.lat, m.lon));
});
const pct = (arr) => (arr.length ? (100 * arr.filter((d) => d <= MAX_KM).length) / arr.length : 100);
const median = (arr) => (arr.length ? [...arr].sort((x, y) => x - y)[arr.length >> 1] : 0);
let total = 0; let ok = 0;
['stream', 'river', 'great'].forEach((name, i) => {
  const arr = bySize[i + 1]; total += arr.length; ok += arr.filter((d) => d <= MAX_KM).length;
  console.log(`gameplay ${name} edges: ${arr.length}, within ${MAX_KM} km of a drawn river: ${pct(arr).toFixed(1)} %, median ${median(arr).toFixed(1)} km`);
});
// painted -> gameplay (rank 0 to 6 reaches, sampled every 0.1 degree)
const eg = new Map();
edgeMids.forEach((m) => { const k = `${Math.floor(m.lon / CELL)},${Math.floor(m.lat / CELL)}`; (eg.get(k) || eg.set(k, []).get(k)).push(m); });
const nearestEdge = (lat, lon) => {
  let best = Infinity; const cx = Math.floor(lon / CELL); const cy = Math.floor(lat / CELL);
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) for (const m of eg.get(`${cx + dx},${cy + dy}`) || []) { const d = km(lat, lon, m.lat, m.lon); if (d < best) best = d; }
  return best;
};
const back = [];
lines.forEach(({ line, rank }) => {
  if (rank > 6) return;
  line.forEach(([lon, lat], i) => { if (i % 4 === 0 && inBox(lat, lon) && tiles.land[tiles.nearest(lat, lon, 1)] === 1) back.push(nearestEdge(lat, lon)); });
});
console.log(`drawn rank 0-6 river points on land: ${back.length}, within ${MAX_KM} km of a gameplay edge: ${pct(back).toFixed(1)} %, median ${median(back).toFixed(1)} km`);
const share = total ? (100 * ok) / total : 100;
console.log(`gameplay edges matched: ${share.toFixed(1)} %`);
if (share < 90) process.exitCode = 1;
