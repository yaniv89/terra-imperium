// scripts/geo/build-balanced-regions.mjs
// Merges over-split countries into fewer, evenly sized regions (plan §3b, the CK3 approach).
// The real admin-1 layer is wildly uneven: the UK has 232 provinces, Slovenia 192 and Latvia 114,
// while the median country has 11 and China 32. The smallest 10% are under 33 km², too small to
// tap, slow to draw and tedious to manage.
//
// Rule, per country:
//   K = min(provinces, max(MIN_PER_COUNTRY, round(country area / AREA_PER_REGION_KM2)))
//   then repeatedly merge the smallest cluster into its smallest neighbouring cluster of the same
//   country until K remain. Islands with no same-country neighbour stay separate. Countries
//   already at or under K (the US's 51 states, China's provinces, Russia's subjects) are untouched.
// A merged region is the union of real provinces (topojson mergeArcs: real outer borders, inner
// lines gone). Its id and name come from the member holding the country's capital, else its
// largest member, so capitals and most references stay valid.
//
// Input (the detailed layer, kept so this is reproducible): scripts/geo/source/subregions-detailed*.
// Output: src/data/geo/subregions.topo.json, subregions-meta.json, subregions-adjacency.json (the
// same formats as before, fewer entries) and regionMerge.json ({ oldId: newId } for every merged
// province; read by the save migration). Then run build-world-regions.mjs and
// build-region-coordinates.mjs, which build the game regions from these files exactly as before.
//
// Run with: node scripts/geo/build-balanced-regions.mjs
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { feature, mergeArcs } from 'topojson-client';
import { geoArea } from 'd3-geo';

export const AREA_PER_REGION_KM2 = 30000;
export const MIN_PER_COUNTRY = 4;
const EARTH_RADIUS_KM = 6371;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(__dirname, 'source');
const geoDir = path.join(__dirname, '../../src/data/geo');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const topo = readJson(path.join(sourceDir, 'subregions-detailed.topo.json'));
const meta = readJson(path.join(sourceDir, 'subregions-detailed-meta.json'));
const adjacency = readJson(path.join(sourceDir, 'subregions-detailed-adjacency.json'));
const capitals = new Set(Object.values(readJson(path.join(sourceDir, 'capital-provinces.json'))));

const objectKey = Object.keys(topo.objects)[0];
const geometries = topo.objects[objectKey].geometries;
const geometryById = new Map(geometries.map((g) => [g.id, g]));
const areaById = {};
feature(topo, topo.objects[objectKey]).features.forEach((f) => { areaById[f.id] = geoArea(f) * EARTH_RADIUS_KM ** 2; });

const byCountry = {};
Object.keys(meta).sort().forEach((id) => { (byCountry[meta[id].countryId] ||= []).push(id); });

// Cluster bookkeeping: clusterOf[provinceId] = cluster key; clusters[key] = { members, area }.
const clusterOf = {};
const clusters = {};
Object.keys(meta).forEach((id) => { clusterOf[id] = id; clusters[id] = { members: [id], area: areaById[id] || 0 }; });

const sameCountryNeighbours = (key, countryId) => {
  const out = new Set();
  clusters[key].members.forEach((m) => (adjacency[m] || []).forEach((n) => {
    if (meta[n]?.countryId === countryId && clusterOf[n] !== key) out.add(clusterOf[n]);
  }));
  return [...out];
};
const byAreaThenId = (a, b) => clusters[a].area - clusters[b].area || (a < b ? -1 : 1);

const report = [];
Object.entries(byCountry).forEach(([countryId, ids]) => {
  const countryArea = ids.reduce((s, id) => s + (areaById[id] || 0), 0);
  const target = Math.min(ids.length, Math.max(MIN_PER_COUNTRY, Math.round(countryArea / AREA_PER_REGION_KM2)));
  const live = new Set(ids);
  while (live.size > target) {
    const smallest = [...live].sort(byAreaThenId).find((k) => sameCountryNeighbours(k, countryId).length > 0);
    if (!smallest) break; // only islands left
    const into = sameCountryNeighbours(smallest, countryId).sort(byAreaThenId)[0];
    clusters[into].members.push(...clusters[smallest].members);
    clusters[into].area += clusters[smallest].area;
    clusters[smallest].members.forEach((m) => { clusterOf[m] = into; });
    delete clusters[smallest];
    live.delete(smallest);
  }
  report.push({ countryId, before: ids.length, after: live.size });
});

// The id and name of each merged region: its capital member, else its largest member.
const representativeOf = (members) => members.find((m) => capitals.has(m))
  || [...members].sort((a, b) => (areaById[b] || 0) - (areaById[a] || 0) || (a < b ? -1 : 1))[0];

const newIdOf = {};
const finalClusters = Object.values(clusters).map((c) => ({ ...c, id: representativeOf(c.members) }));
finalClusters.forEach((c) => c.members.forEach((m) => { newIdOf[m] = c.id; }));
finalClusters.sort((a, b) => (a.id < b.id ? -1 : 1));

// Topology: the same arcs, one merged geometry per region.
const mergedGeometries = finalClusters.map((c) => {
  const geom = c.members.length === 1
    ? { ...geometryById.get(c.id) }
    : mergeArcs(topo, c.members.map((m) => geometryById.get(m)));
  return { ...geom, properties: { id: c.id }, id: c.id };
});
const mergedTopo = { ...topo, objects: { [objectKey]: { ...topo.objects[objectKey], geometries: mergedGeometries } } };

// Meta: the representative's name, plus the member place names (largest first) for the region card.
const mergedMeta = {};
finalClusters.forEach((c) => {
  const m = meta[c.id];
  const others = c.members.filter((x) => x !== c.id).sort((a, b) => (areaById[b] || 0) - (areaById[a] || 0) || (a < b ? -1 : 1));
  mergedMeta[c.id] = { name: m.name, countryId: m.countryId, countryName: m.countryName, ...(others.length ? { includes: others.map((x) => meta[x].name) } : {}) };
});

// Adjacency: the union of the members' neighbours, as merged ids.
const mergedAdjacency = {};
finalClusters.forEach((c) => {
  const out = new Set();
  c.members.forEach((m) => (adjacency[m] || []).forEach((n) => { if (newIdOf[n] && newIdOf[n] !== c.id) out.add(newIdOf[n]); }));
  mergedAdjacency[c.id] = [...out].sort();
});

const regionMerge = {};
Object.keys(newIdOf).sort().forEach((oldId) => { if (newIdOf[oldId] !== oldId) regionMerge[oldId] = newIdOf[oldId]; });

writeFileSync(path.join(geoDir, 'subregions.topo.json'), JSON.stringify(mergedTopo));
writeFileSync(path.join(geoDir, 'subregions-meta.json'), JSON.stringify(mergedMeta));
writeFileSync(path.join(geoDir, 'subregions-adjacency.json'), JSON.stringify(mergedAdjacency));
writeFileSync(path.join(geoDir, 'regionMerge.json'), JSON.stringify(regionMerge));

const changed = report.filter((r) => r.after < r.before).sort((a, b) => b.before - b.after - (a.before - a.after));
console.log(`Balanced regions: ${Object.keys(meta).length} -> ${finalClusters.length} (${Object.keys(regionMerge).length} provinces merged into others).`);
console.log(`Countries merged: ${changed.length}. Largest reductions: ${changed.slice(0, 12).map((r) => `${r.countryId} ${r.before}->${r.after}`).join(', ')}`);
