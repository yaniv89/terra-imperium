// scripts/geo/build-sea-lanes.mjs
// Derives which of the 240 countries are coastal, and the great-circle distance between every
// pair of coastal countries, from data already committed — no new source data (plan §7.5).
//
// Coastline for free: the adjacency scripts already use the fact that in TopoJSON, an arc shared
// by two polygons is a land border (see build.mjs's topojson.neighbors() call). The inverse is
// equally exact — an arc referenced by only ONE country's geometry is coastline. A country is
// coastal if it has at least one such arc. Sea-lane distance between two coastal countries is the
// closest approach between their actual coastline points (not a single average "coast point" per
// country, which would blur a narrow strait like Dover or Gibraltar into a much larger number —
// exactly the chokepoints this data needs to get right).
//
// Sea lanes themselves are NOT age-gated here — this just computes the full pairwise distance
// graph among coastal nations once; src/data/navalReach.js filters it by the age-appropriate
// range at read time, the same way techTree.js's yearAvailable gates content by year rather than
// baking "is this available" into the data file itself.
//
// Run with: node scripts/geo/build-sea-lanes.mjs (after build-world-regions.mjs's inputs exist).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const geoDir = path.join(__dirname, '../../src/data/geo');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const countriesTopo = readJson(path.join(geoDir, 'countries.topo.json'));
const countryKey = Object.keys(countriesTopo.objects)[0];
const geometries = countriesTopo.objects[countryKey].geometries;
const { scale, translate } = countriesTopo.transform;

// Every integer appearing (at any nesting depth) in a geometry's `arcs` field is an arc reference
// — Polygon rings are flat arrays of them, MultiPolygon nests one more level for multiple parts.
// Negative codes are topojson's bitwise-NOT encoding for "traverse this arc in reverse"; ~code
// recovers the real arc index (the direction doesn't matter for usage-counting or point extraction).
const collectArcIds = (node, out) => {
  if (typeof node === 'number') { out.add(node < 0 ? ~node : node); return; }
  if (Array.isArray(node)) node.forEach((child) => collectArcIds(child, out));
};

const arcIdsByCountry = geometries.map((g) => {
  const ids = new Set();
  collectArcIds(g.arcs, ids);
  return ids;
});

// Which countries (by index) reference each arc — size 1 means coastline, size 2 means land border
// (a shared arc is never referenced by more than 2 countries: it's the edge between exactly two
// polygons, or one polygon and open sea).
const countriesByArc = new Map();
arcIdsByCountry.forEach((ids, countryIdx) => {
  ids.forEach((arcId) => {
    if (!countriesByArc.has(arcId)) countriesByArc.set(arcId, []);
    countriesByArc.get(arcId).push(countryIdx);
  });
});

// Decodes one arc's quantized delta-encoded points into real [lon, lat] pairs.
const decodeArc = (arcId) => {
  let x = 0;
  let y = 0;
  return countriesTopo.arcs[arcId].map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
};

const toRad = (deg) => (deg * Math.PI) / 180;
const EARTH_RADIUS_KM = 6371;
const haversineKm = (a, b) => {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

// A degree of longitude shrinks toward the poles (by cos(latitude)); converting to a flat
// equirectangular approximation in km lets a cheap squared-distance bounding-box prefilter (below)
// reject far-apart point pairs without a full haversine call, which is what makes brute-force
// nearest-point-pair tractable across ~33k total coastline points.
const KM_PER_DEG_LAT = 111.32;
const kmPerDegLonAt = (lat) => Math.cos(toRad(lat)) * 111.32;

const isCoastal = {};
const coastlinePoints = {};
geometries.forEach((g, i) => {
  const coastlineArcIds = [...arcIdsByCountry[i]].filter((arcId) => countriesByArc.get(arcId).length === 1);
  isCoastal[g.id] = coastlineArcIds.length > 0;
  if (coastlineArcIds.length > 0) {
    coastlinePoints[g.id] = coastlineArcIds.flatMap(decodeArc);
  }
});

const coastalIds = Object.keys(isCoastal).filter((id) => isCoastal[id]);

// Closest approach between two countries' coastline point sets, in km — a coarse flat-projection
// squared-distance prefilter skips the (rare) genuinely-far point pairs without a trig call each;
// the kept candidates still get an exact haversine distance.
const closestApproachKm = (pointsA, pointsB) => {
  let best = Infinity;
  for (const a of pointsA) {
    const kmPerLon = kmPerDegLonAt(a[1]);
    for (const b of pointsB) {
      const dLat = (b[1] - a[1]) * KM_PER_DEG_LAT;
      const dLon = (b[0] - a[0]) * kmPerLon;
      const flatKmSq = dLat * dLat + dLon * dLon;
      if (flatKmSq < best * best) {
        const km = haversineKm(a, b);
        if (km < best) best = km;
      }
    }
  }
  return Math.round(best);
};

const seaLanes = {};
for (let i = 0; i < coastalIds.length; i += 1) {
  for (let j = i + 1; j < coastalIds.length; j += 1) {
    const a = coastalIds[i];
    const b = coastalIds[j];
    const km = closestApproachKm(coastlinePoints[a], coastlinePoints[b]);
    (seaLanes[a] ||= []).push({ to: b, km });
    (seaLanes[b] ||= []).push({ to: a, km });
  }
}
Object.values(seaLanes).forEach((lanes) => lanes.sort((x, y) => x.km - y.km));

writeFileSync(path.join(geoDir, 'coastal.json'), JSON.stringify(isCoastal));
writeFileSync(path.join(geoDir, 'sea-lanes.json'), JSON.stringify(seaLanes));

console.log(`Wrote coastal.json: ${coastalIds.length}/${geometries.length} nations are coastal.`);
console.log(`Wrote sea-lanes.json: ${coastalIds.length} coastal nations, ${coastalIds.length * (coastalIds.length - 1)} directed lanes.`);
