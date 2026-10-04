// scripts/perf/cellScaling.mjs
// How the per-cell loops of a turn scale with the grid (plans/math/perf.md): builds the frequency-75
// and frequency-100 geodesic grids, claims the same share of land around cities spaced the same
// distance apart in km, and times the loops the engine runs over claimed tiles each turn.
//   node scripts/perf/cellScaling.mjs [frequencies=75,100]
import { buildGrid, distanceKm } from '../../src/data/geo/geodesic.js';
import { ownerSlots } from '../../src/engine/world/tileIndex.js';

const FREQS = (process.argv[2] || '75,100').split(',').map(Number);
const LAND_SHARE = 0.29; const CITY_SPACING_KM = 320; const CITY_RADIUS_KM = 230; const SEARCH_KM = 1150;
const time = (fn, n = 100) => { fn(); const t = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t) / n; };

const rows = FREQS.map((f) => {
  const g = buildGrid(f);
  const count = g.centres.length;
  let sum = 0; let pairs = 0;
  for (let i = 0; i < count; i += 7) for (const n of g.neighbors[i]) { sum += distanceKm(g.centres[i], g.centres[n]); pairs += 1; }
  const spacing = sum / pairs; // the mean distance between neighbouring centres
  // "Land": the cells with the lowest z band covering LAND_SHARE of the sphere (a cap), deterministic.
  const land = new Uint8Array(count); for (let i = 0; i < count; i++) if (g.centres[i][2] > 1 - 2 * LAND_SHARE) land[i] = 1;
  // Cities: greedy, at least CITY_SPACING_KM apart, in id order; each claims land within CITY_RADIUS_KM.
  const cities = [];
  for (let i = 0; i < count; i++) if (land[i] && cities.every((c) => distanceKm(g.centres[c], g.centres[i]) >= CITY_SPACING_KM)) cities.push(i);
  const tileOwner = {}; const cityTiles = cities.map(() => []);
  cities.forEach((c, ci) => {
    let frontier = [c]; const seen = new Set(frontier);
    while (frontier.length) {
      const next = [];
      for (const t of frontier) { if (tileOwner[t] == null) { tileOwner[t] = `c${c}`; cityTiles[ci].push(t); } for (const n of g.neighbors[t]) if (!seen.has(n) && land[n] && distanceKm(g.centres[c], g.centres[n]) <= CITY_RADIUS_KM) { seen.add(n); next.push(n); } }
      frontier = next;
    }
  });
  const owned = Object.keys(tileOwner).length;
  const copy = time(() => ({ ...tileOwner }));
  const copies = Array.from({ length: 41 }, () => ({ ...tileOwner })); let ci = 0;
  const index = time(() => ownerSlots(copies[ci++], count), 40);
  const { slot } = ownerSlots(tileOwner, count);
  const borderDict = time(() => { let s = 0; cityTiles.forEach((list, ci) => list.forEach((t) => g.neighbors[t].forEach((n) => { const o = tileOwner[n]; if (o && o !== `c${cities[ci]}`) s += 1; }))); return s; });
  const borderTyped = time(() => { let s = 0; cityTiles.forEach((list, ci) => list.forEach((t) => { const ns = g.neighbors[t]; for (let k = 0; k < ns.length; k++) { const o = slot[ns[k]]; if (o >= 0 && o !== ci) s += 1; } })); return s; });
  const rings = Math.round(SEARCH_KM / spacing);
  const search = time(() => { let frontier = [cities[0]]; const seen = new Set(frontier); for (let d = 0; d < rings; d++) { const next = []; for (const t of frontier) for (const n of g.neighbors[t]) if (!seen.has(n)) { seen.add(n); next.push(n); } frontier = next; } return seen.size; }, 50);
  return { f, cells: count, spacingKm: +spacing.toFixed(0), cities: cities.length, ownedTiles: owned, copyMs: +copy.toFixed(3), typedIndexMs: +index.toFixed(3), borderScanDictMs: +borderDict.toFixed(3), borderScanTypedMs: +borderTyped.toFixed(3), searchRings: rings, siteSearchMs: +search.toFixed(3) };
});
console.table(rows);
if (rows.length > 1) {
  const [a, b] = rows;
  console.log(`ratio f${b.f}/f${a.f}: cells ${(b.cells / a.cells).toFixed(2)}, owned ${(b.ownedTiles / a.ownedTiles).toFixed(2)}, copy ${(b.copyMs / a.copyMs).toFixed(2)}, border dict ${(b.borderScanDictMs / a.borderScanDictMs).toFixed(2)}, border typed ${(b.borderScanTypedMs / a.borderScanTypedMs).toFixed(2)}, site search ${(b.siteSearchMs / a.siteSearchMs).toFixed(2)}`);
}
