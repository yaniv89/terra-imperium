// scripts/geo/build-world-regions.mjs
// Generates src/data/geo/worldRegions.json: one record per real admin-1 province (4,482 of them),
// not one per country — every country splits into its actual sub-national provinces, so a nation
// is now the SET of regions sharing a startOwner, not a single region matching its own id. This is
// what lets Jordan show up as Amman/Irbid/Zarqa/... on the map and in gameplay, instead of one
// "Jordan" blob (the original Phase A simplification — see git history for the country-level
// version this replaces).
//
// Run with: node scripts/geo/build-world-regions.mjs
// Reads only already-committed data (no network fetch). Adjacency is the REAL province-level graph
// (subregions-adjacency.json) used directly — no more collapsing to country level, since a region
// now IS a province. That graph already includes both intra-country edges (Amman-Zarqa) and
// cross-border edges (Amman-a Saudi province), which is exactly what army movement/invasion needs.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { feature } from 'topojson-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const geoDir = path.join(__dirname, '../../src/data/geo');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const countriesMeta = readJson(path.join(geoDir, 'countries-meta.json'));
const subregionsMeta = readJson(path.join(geoDir, 'subregions-meta.json'));
const subregionsAdjacency = readJson(path.join(geoDir, 'subregions-adjacency.json'));
const subregionsTopo = readJson(path.join(geoDir, 'subregions.topo.json'));

const objectKey = Object.keys(subregionsTopo.objects)[0];
const topoObject = subregionsTopo.objects[objectKey];
const geometries = topoObject.geometries;
const subregionFeatures = feature(subregionsTopo, topoObject).features;

// A rough 0-10 development index from GDP-per-capita, used to seed infrastructure/strategicValue —
// richer nations score modestly higher, but this is flavor, not balance; every nation starts on
// equal footing (100% control of its own territory).
const developmentIndex = (population, gdpMillions) => {
  const gdpPerCapita = (gdpMillions * 1e6) / Math.max(population, 1);
  return Math.min(10, Math.max(1, Math.round(Math.log10(Math.max(gdpPerCapita, 100)) * 2.2)));
};

// Real GDP/population span many orders of magnitude — used linearly, per-turn gold income would
// range from single digits to hundreds of thousands, making the starting treasury meaningless
// within one turn for a superpower. Log-scaling compresses that into a playable band. Computed
// once per COUNTRY (not per province) and then split by population share below, so a nation's
// total income is unchanged by how many provinces it happens to have — splitting territory finer
// must not accidentally buff or nerf anyone.
const goldFromGdp = (gdpMillions) => Math.round(40 * Math.log10(Math.max(gdpMillions, 1)));
const hrFromPopulation = (population) => Math.round(25 * Math.log10(Math.max(population, 1)));

// Shoelace formula on raw lon/lat, corrected by cos(latitude) so a degree of longitude shrinks
// toward the poles the same way it really does — good enough for RELATIVE weighting between two
// provinces of the same country (which is all this is used for), not real cartographic area.
const ringArea = (ring) => {
  const meanLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const lonScale = Math.cos((meanLat * Math.PI) / 180);
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += (x1 * lonScale) * y2 - (x2 * lonScale) * y1;
  }
  return Math.abs(sum / 2);
};

const areaOf = (geometry) => {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  // Only the exterior ring of each polygon part — holes are a rounding-error-scale correction for
  // this purpose (relative population/gold weighting between provinces), not worth the complexity.
  return polygons.reduce((sum, rings) => sum + ringArea(rings[0]), 0);
};

const areaById = {};
subregionFeatures.forEach((f) => { areaById[f.id] = areaOf(f.geometry) || 1e-9; });

// Population/gold/HR are distributed by sqrt(area), not raw area — real population doesn't scale
// linearly with land area (a small dense capital district can easily outweigh a vast, empty
// frontier province), and sqrt compresses the gap between "huge desert province" and "tiny capital
// district" toward something less obviously wrong than a pure area split, without pretending to
// real per-province population data this build has none of.
const weightById = {};
subregionFeatures.forEach((f) => { weightById[f.id] = Math.sqrt(areaById[f.id]); });

// Coastline for free, the same trick build-sea-lanes.mjs uses for countries: in TopoJSON, an arc
// referenced by only ONE polygon is coastline (an arc shared by two polygons — same country or
// not — is a land border). Applying it at province granularity gives a REAL per-province coastal
// flag instead of inheriting the whole country's flag onto every inland province.
const collectArcIds = (node, out) => {
  if (typeof node === 'number') { out.add(node < 0 ? ~node : node); return; }
  if (Array.isArray(node)) node.forEach((child) => collectArcIds(child, out));
};
const arcIdsByProvince = geometries.map((g) => {
  const ids = new Set();
  collectArcIds(g.arcs, ids);
  return ids;
});
const provincesByArc = new Map();
arcIdsByProvince.forEach((ids, i) => {
  ids.forEach((arcId) => {
    if (!provincesByArc.has(arcId)) provincesByArc.set(arcId, []);
    provincesByArc.get(arcId).push(i);
  });
});
const isCoastalById = {};
geometries.forEach((g, i) => {
  const coastlineArcs = [...arcIdsByProvince[i]].filter((arcId) => provincesByArc.get(arcId).length === 1);
  isCoastalById[g.id] = coastlineArcs.length > 0;
});

// Group provinces by country, in subregionsMeta's own key order (stable, since it's a committed
// JSON file) — used both to distribute each country's population/gold/HR by area share and to pick
// a capital.
const provincesByCountry = {};
Object.entries(subregionsMeta).forEach(([id, meta]) => {
  (provincesByCountry[meta.countryId] ||= []).push(id);
});

const worldRegions = {};
Object.entries(countriesMeta).forEach(([countryId, meta]) => {
  const provinceIds = provincesByCountry[countryId] || [];
  if (provinceIds.length === 0) return; // shouldn't happen — every country has real subregion coverage
  const dev = developmentIndex(meta.population, meta.gdpMillions);
  const nationGold = goldFromGdp(meta.gdpMillions);
  const nationHr = hrFromPopulation(meta.population);
  const totalWeight = provinceIds.reduce((s, id) => s + weightById[id], 0);

  // No real per-province population/capital-city data is committed for this game, so the capital
  // is a heuristic, not a researched fact: the SMALLEST-area province, on the theory that a dense
  // urban capital district is usually smaller than the country's rural/frontier provinces (this is
  // literally true for the many countries whose capital has its own small admin-1 entry — a
  // federal district, a capital territory, a city-state province). It will be wrong for some
  // countries; getting it exactly right for all 240 would need a curated real-world table this
  // build reads none of. Being wrong here only affects flavor (which region shows a "Capital"
  // badge) and the overextension anchor point, not correctness.
  const capitalId = provinceIds.reduce((smallest, id) => (areaById[id] < areaById[smallest] ? id : smallest), provinceIds[0]);

  provinceIds.forEach((id) => {
    const provinceMeta = subregionsMeta[id];
    const areaShare = weightById[id] / totalWeight;
    worldRegions[id] = {
      id,
      name: provinceMeta.name,
      startOwner: countryId,
      startControl: 100,
      population: Math.round(meta.population * areaShare),
      // Real GDP (not the log-compressed gold yield below) — src/data/victoryConditions.js's
      // Economic Hegemony check needs an actual, linearly-summable GDP figure per region to
      // compute the player's real world-GDP share; gold/hr are deliberately log-scaled for
      // playable per-turn income and can't be summed back into a meaningful GDP percentage.
      gdpMillions: meta.gdpMillions * areaShare,
      infrastructure: dev,
      strategicValue: dev,
      terrain: 'mixed',
      resources: {
        gold: Math.round(nationGold * areaShare),
        hr: Math.round(nationHr * areaShare)
      },
      fortification: 1,
      isCapital: id === capitalId,
      isCoastal: !!isCoastalById[id],
      neighbors: subregionsAdjacency[id] || [],
      description: `${provinceMeta.name}, ${meta.name}`
    };
  });
});

writeFileSync(path.join(geoDir, 'worldRegions.json'), JSON.stringify(worldRegions));
const totalEdges = Object.values(worldRegions).reduce((s, r) => s + r.neighbors.length, 0);
const coastalCount = Object.values(worldRegions).filter(r => r.isCoastal).length;
console.log(`Wrote worldRegions.json: ${Object.keys(worldRegions).length} provinces across ${Object.keys(countriesMeta).length} nations, ${totalEdges} directed border edges, ${coastalCount} coastal provinces.`);
