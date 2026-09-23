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
const countryCapitals = readJson(path.join(geoDir, 'countryCapitals.json'));

// Case/whitespace-normalized match between a country's real capital-city name and a province name
// — used only as a fallback tier (see resolveCapitalId below) for the handful of countries whose
// capital coordinates couldn't be resolved to a real point (countryCapitals.json's own build log
// lists them). A plain lowercase equality still catches many of those: several capitals genuinely
// ARE their own admin-1 entry (a federal district, a capital territory, a city-state province).
const normalize = (s) => s.toLowerCase().trim();

const objectKey = Object.keys(subregionsTopo.objects)[0];
const topoObject = subregionsTopo.objects[objectKey];
const geometries = topoObject.geometries;
const subregionFeatures = feature(subregionsTopo, topoObject).features;
const featuresById = {};
subregionFeatures.forEach((f) => { featuresById[f.id] = f; });

// Standard ray-casting point-in-polygon test — the PRIMARY capital-matching method (see
// resolveCapitalId below).
const pointInRing = (point, ring) => {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};
const pointInGeometry = (point, geometry) => {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  return polygons.some((rings) => pointInRing(point, rings[0]) && !rings.slice(1).some((hole) => pointInRing(point, hole)));
};

// Fallback tier for when containment finds nothing (see resolveCapitalId): nearest province
// CENTROID, not edge — a true area-weighted polygon centroid (shoelace-based, same family of math
// as ringArea() below), not a naive vertex average (which is skewed by wherever vertices happen to
// be denser along a ring). This reliably recovers small/simplified provinces where the real
// coordinate falls just outside their own simplified boundary (confirmed for Rome vs `it-rm`, and
// for several capitals that are small enclaves inside a much larger surrounding province — Beijing
// inside Hebei, Delhi inside Uttar Pradesh, Oslo inside Akershus): nearest-edge was tried instead
// and got these badly wrong the OTHER way, since a small enclave's own boundary IS largely its huge
// neighbor's boundary, so "nearest edge" kept picking the neighbor. Nearest-centroid's own failure
// mode (huge, off-center provinces like Ontario, whose capital sits in one corner far from its own
// centroid) is rare enough to handle with a one-off alias instead — see CAPITAL_PROVINCE_ALIASES.
const ringCentroid = (ring) => {
  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    const cross = x0 * y1 - x1 * y0;
    signedArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  signedArea /= 2;
  if (Math.abs(signedArea) < 1e-12) {
    const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return { lat, lng, area: 0 };
  }
  return { lng: cx / (6 * signedArea), lat: cy / (6 * signedArea), area: Math.abs(signedArea) };
};
const centroidOf = (f) => {
  const polygons = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
  const parts = polygons.map((p) => ringCentroid(p[0]));
  const largest = parts.reduce((a, b) => (b.area > a.area ? b : a), parts[0]);
  return { lat: largest.lat, lng: largest.lng };
};
const centroidById = {};
subregionFeatures.forEach((f) => { centroidById[f.id] = centroidOf(f); });
const degreeDistance = (a, b) => {
  const lonScale = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dLng = (a.lng - b.lng) * lonScale;
  const dLat = a.lat - b.lat;
  return Math.sqrt(dLng * dLng + dLat * dLat);
};

// One-off overrides for countries whose real capital sits in one corner of a huge, off-center
// province (nearest-centroid's specific failure mode — see the comment above) — found empirically
// by manually spot-checking this build's output against known real capitals, not by reviewing all
// 240 countries by hand. Ottawa sits right on the Ontario/Quebec border, and Ontario itself is so
// vast (mostly far-north wilderness) that its own area centroid lands nowhere near Ottawa in the
// southeast corner, letting a smaller, merely-nearby province win on raw centroid distance instead.
const CAPITAL_PROVINCE_ALIASES = {
  ca: 'Ontario'
};

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

const smallestAreaFallback = (provinceIds) =>
  provinceIds.reduce((smallest, id) => (areaById[id] < areaById[smallest] ? id : smallest), provinceIds[0]);

// Resolves a country's real capital to one of its provinces, four tiers deep:
//   1. CAPITAL_PROVINCE_ALIASES override, for the rare case a country needs one (see its comment).
//   2. Point-in-polygon containment against the capital's real [lat, lng] — the primary method for
//      everything else.
//   3. Nearest province CENTROID, for provinces small/simplified enough that the real coordinate
//      falls just outside their own simplified boundary (see the centroidOf comment above).
//   4. A case-insensitive name match against the real capital-city name, for the minority of
//      countries whose coordinates couldn't be resolved at all (countryCapitals.json's own build
//      log lists them) but whose capital genuinely IS its own admin-1 entry (a federal district, a
//      capital territory, a city-state province) — with the old smallest-area heuristic as the
//      absolute last resort, logged so that fallback list stays auditable rather than silent.
const capitalFallbacks = [];
const resolveCapitalId = (countryId, provinceIds) => {
  const alias = CAPITAL_PROVINCE_ALIASES[countryId];
  if (alias) {
    const aliasMatch = provinceIds.find((id) => normalize(subregionsMeta[id].name) === normalize(alias));
    if (aliasMatch) return aliasMatch;
  }
  const capitalInfo = countryCapitals[countryId];
  if (capitalInfo?.lat != null && capitalInfo?.lng != null) {
    const point = [capitalInfo.lng, capitalInfo.lat];
    const containing = provinceIds.find((id) => pointInGeometry(point, featuresById[id].geometry));
    if (containing) return containing;
    const target = { lat: capitalInfo.lat, lng: capitalInfo.lng };
    return provinceIds.reduce((best, id) =>
      (degreeDistance(centroidById[id], target) < degreeDistance(centroidById[best], target) ? id : best), provinceIds[0]);
  }
  const capitalName = capitalInfo?.name;
  if (capitalName) {
    const nameMatch = provinceIds.find((id) => normalize(subregionsMeta[id].name) === normalize(capitalName));
    if (nameMatch) return nameMatch;
  }
  capitalFallbacks.push({ countryId, capitalName: capitalName || '(none)' });
  return smallestAreaFallback(provinceIds);
};

const worldRegions = {};
Object.entries(countriesMeta).forEach(([countryId, meta]) => {
  const provinceIds = provincesByCountry[countryId] || [];
  if (provinceIds.length === 0) return; // shouldn't happen — every country has real subregion coverage
  const dev = developmentIndex(meta.population, meta.gdpMillions);
  const nationGold = goldFromGdp(meta.gdpMillions);
  const nationHr = hrFromPopulation(meta.population);
  const totalWeight = provinceIds.reduce((s, id) => s + weightById[id], 0);

  const capitalId = resolveCapitalId(countryId, provinceIds);

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
if (capitalFallbacks.length > 0) {
  console.log(`\n${capitalFallbacks.length} countries fell back to the smallest-area capital heuristic (no name match found):`);
  capitalFallbacks.forEach(({ countryId, capitalName }) => console.log(`  ${countryId}: real capital "${capitalName}" not found among its provinces`));
}
