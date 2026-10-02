// scripts/geo/build-tiles.mjs
// Builds the Civ-style world grid (plans/civ-map-rework.md, Part B and workstream 1):
// src/data/geo/tiles.json, one record per cell of a frequency-53 geodesic grid (28,092 cells of
// about 18,000 km²), with land/sea, country, elevation, climate, terrain, relief, feature, river
// edges, a place name and the 240 capitals, plus a preview PNG for eyeballing.
//
// Inputs (all regenerable, gitignored under scripts/geo/.raw/; see fetch-tiles-raw.mjs):
//   .raw/ne/ne_50m_land.geojson                      land polygons           Natural Earth, public domain
//   .raw/ne/ne_10m_geography_regions_polys.geojson   named ranges, deserts…  Natural Earth
//   .raw/ne/ne_10m_glaciated_areas.geojson           ice                     Natural Earth
//   .raw/ne/ne_10m_lakes.geojson                     lakes                   Natural Earth
//   .raw/ne/ne_10m_rivers_lake_centerlines.geojson   rivers                  Natural Earth
//   .raw/ne/ne_10m_populated_places_simple.geojson   place names             Natural Earth
//   .raw/terrarium4/{x}-{y}.png                      elevation, zoom 4       Mapzen/Tilezen terrain tiles
//                                                    (see CREDITS.md for the required attribution)
//   node_modules/koppen-climate-lookup               Köppen climate, 0.5°
//   src/data/geo/countries.topo.json, countries-meta.json, countryCapitals.json  (already in the repo)
//
// Run: node scripts/geo/build-tiles.mjs            (about a minute)
// Deterministic: same inputs, byte-identical output (no randomness; the only "noise" is a hash of
// the cell id).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { buildGrid, toLatLon, fromLatLon, buildLatLonIndex, distanceKm, icosahedronVertices } from '../../src/data/geo/geodesic.js';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const KoppenModule = require('koppen-climate-lookup');
const KoppenLookup = KoppenModule.default || KoppenModule.KoppenLookup || KoppenModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '.raw');
const GEO = path.join(__dirname, '../../src/data/geo');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export const FREQUENCY = 53;
export const GRID_VERSION = 1;

// ---------------------------------------------------------------------------------------------
// Point in polygon with a bbox bucket index, for GeoJSON Polygon / MultiPolygon features.
const ringContains = (ring, x, y) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const polygonContains = (coords, x, y) => {
  if (!ringContains(coords[0], x, y)) return false;
  for (let h = 1; h < coords.length; h++) if (ringContains(coords[h], x, y)) return false;
  return true;
};
const bboxOf = (coords) => {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  coords[0].forEach(([x, y]) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; });
  return [minX, minY, maxX, maxY];
};
const polygonIndex = (features, step = 4) => {
  const polys = [];
  features.forEach((f, fi) => {
    const g = f.geometry; if (!g) return;
    const list = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    list.forEach((coords) => polys.push({ fi, coords, bbox: bboxOf(coords) }));
  });
  const buckets = new Map();
  const key = (x, y) => `${Math.floor((x + 180) / step)},${Math.floor((y + 90) / step)}`;
  polys.forEach((p, pi) => {
    const [minX, minY, maxX, maxY] = p.bbox;
    for (let x = Math.floor((minX + 180) / step); x <= Math.floor((maxX + 180) / step); x++) {
      for (let y = Math.floor((minY + 90) / step); y <= Math.floor((maxY + 90) / step); y++) {
        const k = `${x},${y}`;
        (buckets.get(k) || buckets.set(k, []).get(k)).push(pi);
      }
    }
  });
  const find = (lon, lat) => {
    const list = buckets.get(key(lon, lat));
    if (!list) return [];
    const out = [];
    list.forEach((pi) => {
      const p = polys[pi];
      if (lon < p.bbox[0] || lon > p.bbox[2] || lat < p.bbox[1] || lat > p.bbox[3]) return;
      if (polygonContains(p.coords, lon, lat)) out.push(features[p.fi]);
    });
    return out;
  };
  return { find, polys };
};

// ---------------------------------------------------------------------------------------------
// Elevation: 16 x 16 terrarium tiles at zoom 4 (web mercator, 4096 x 4096 px worldwide).
export const loadElevation = () => {
  const SIZE = 4096;
  const data = new Float32Array(SIZE * SIZE);
  for (let tx = 0; tx < 16; tx++) {
    for (let ty = 0; ty < 16; ty++) {
      const file = path.join(RAW, 'terrarium4', `${tx}-${ty}.png`);
      if (!existsSync(file)) throw new Error(`missing elevation tile ${file}; run scripts/geo/fetch-tiles-raw.mjs`);
      const png = PNG.sync.read(readFileSync(file));
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const o = (y * 256 + x) * 4;
          data[(ty * 256 + y) * SIZE + tx * 256 + x] = png.data[o] * 256 + png.data[o + 1] + png.data[o + 2] / 256 - 32768;
        }
      }
    }
  }
  const sample = (lat, lon) => {
    const clampedLat = Math.max(-85, Math.min(85, lat));
    const x = ((lon + 180) / 360) * SIZE;
    const la = (clampedLat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * SIZE;
    const xi = ((Math.floor(x) % SIZE) + SIZE) % SIZE; const yi = Math.max(0, Math.min(SIZE - 1, Math.floor(y)));
    return data[yi * SIZE + xi];
  };
  return { sample };
};

// ---------------------------------------------------------------------------------------------
// Orientation search (B2): keep the 12 pentagons off land where possible.
const chooseOrientation = (landIndex) => {
  let best = null;
  for (let tilt = -12; tilt <= 12; tilt += 3) {
    for (let rotation = 0; rotation < 72; rotation += 1) {
      const verts = icosahedronVertices({ rotation, tilt });
      let onLand = 0;
      verts.forEach((v) => {
        const { lat, lon } = toLatLon(v);
        if (lat < -60) return; // Antarctica does not count
        if (landIndex.find(lon, lat).length) onLand++;
      });
      const score = onLand * 100 + Math.abs(tilt) + rotation / 100;
      if (!best || score < best.score) best = { rotation, tilt, onLand, score };
    }
  }
  return best;
};

// ---------------------------------------------------------------------------------------------
// Terrain classification. Codes are small integers; the names live in tiles-meta.
export const TERRAIN = ['ocean', 'coast', 'lake', 'grassland', 'plains', 'desert', 'tundra', 'snow'];
export const RELIEF = ['flat', 'hills', 'mountains'];
export const FEATURE = ['none', 'forest', 'jungle', 'marsh', 'oasis', 'floodplain', 'ice', 'reef'];
const code = (list, name) => { const i = list.indexOf(name); if (i < 0) throw new Error(`unknown ${name}`); return i; };

// A stable 0..1 hash of (id, salt) for the seeded scatter of forests and so on.
const hash01 = (id, salt) => {
  let h = (id * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

const classify = ({ id, land, lat, elevMean, elevMax, rough, koppen, regionClasses, glaciated, lake, riverEdges, coastal, depth }) => {
  if (!land) {
    if (lake) return { terrain: 'lake', relief: 'flat', feature: 'none' };
    const terrain = coastal || depth > -200 ? 'coast' : 'ocean';
    return { terrain, relief: 'flat', feature: glaciated ? 'ice' : 'none' };
  }
  if (lake) return { terrain: 'lake', relief: 'flat', feature: 'none' };
  const k = koppen || 'Cfb';
  const group = k[0];
  // Relief from real elevation statistics (plus the named ranges as a tie-break).
  let relief = 'flat';
  const inRange = regionClasses.has('Range/mtn');
  const inPlateau = regionClasses.has('Plateau') || regionClasses.has('Foothills');
  if (glaciated) relief = rough > 550 ? 'mountains' : rough > 250 ? 'hills' : 'flat'; // an ice sheet is high but flat
  else if (elevMean > 2500 || (rough > 500 && elevMean > 700) || (inRange && rough > 300) || elevMax > 4000) relief = 'mountains';
  else if (rough > 220 || (elevMean > 900 && rough > 120) || (inPlateau && rough > 100) || (inRange && rough > 150)) relief = 'hills';
  // Base terrain from climate.
  let terrain;
  if (glaciated || k === 'EF') terrain = 'snow';
  else if (k === 'ET' || (group === 'D' && /[cd]$/.test(k) && lat > 60)) terrain = 'tundra';
  else if (k === 'BWh' || k === 'BWk') terrain = 'desert';
  else if (k === 'BSh' || k === 'BSk') terrain = 'plains';
  else if (group === 'A') terrain = k === 'Aw' || k === 'As' ? 'plains' : 'grassland';
  else if (group === 'C') terrain = /^Cs/.test(k) ? 'plains' : 'grassland';
  else if (group === 'D') terrain = /[ab]$/.test(k) ? 'grassland' : 'plains';
  else terrain = 'plains';
  if (relief === 'mountains' && elevMean > 3500) terrain = terrain === 'desert' ? 'desert' : 'tundra';
  // Features.
  let feature = 'none';
  const r = hash01(id, 7);
  if (glaciated && terrain === 'snow') feature = 'ice';
  else if (group === 'A' && terrain === 'grassland' && r < 0.85) feature = 'jungle';
  else if (regionClasses.has('Wetlands') || (regionClasses.has('Delta') && r < 0.6)) feature = 'marsh';
  else if (terrain === 'desert' && riverEdges) feature = 'floodplain';
  else if (terrain === 'desert' && r < 0.04) feature = 'oasis';
  else if (relief !== 'mountains') {
    const forestChance = group === 'D' ? (/[cd]$/.test(k) ? 0.65 : 0.4) : group === 'C' ? (/^Cs/.test(k) ? 0.2 : 0.4) : group === 'A' ? 0.5 : 0.05;
    if (r < forestChance) feature = 'forest';
  }
  return { terrain, relief, feature };
};

// Capitals countryCapitals.json could not resolve to coordinates (its own build log lists them).
const CAPITAL_FALLBACKS = {
  sm: { name: 'San Marino', lat: 43.94, lng: 12.45 }, hk: { name: 'Hong Kong', lat: 22.28, lng: 114.16 },
  xn: { name: 'North Nicosia', lat: 35.18, lng: 33.36 }, ki: { name: 'South Tarawa', lat: 1.33, lng: 172.98 },
  gd: { name: "St. George's", lat: 12.05, lng: -61.75 }, ag: { name: "St. John's", lat: 17.12, lng: -61.85 },
  hm: { name: 'Atlas Cove', lat: -53.1, lng: 73.5 }, gg: { name: 'St. Peter Port', lat: 49.45, lng: -2.54 },
  io: { name: 'Diego Garcia', lat: -7.3, lng: 72.4 }, to: { name: "Nuku'alofa", lat: -21.14, lng: -175.2 },
  gs: { name: 'King Edward Point', lat: -54.28, lng: -36.5 }, vu: { name: 'Port Vila', lat: -17.73, lng: 168.32 },
  mo: { name: 'Macao', lat: 22.19, lng: 113.54 }, aq: { name: 'McMurdo', lat: -77.85, lng: 166.67 }
};

// ---------------------------------------------------------------------------------------------
export const buildTiles = ({ log = console.log } = {}) => {
  const t0 = Date.now();
  const landFc = readJson(path.join(RAW, 'ne', 'ne_50m_land.geojson'));
  const landIndex = polygonIndex(landFc.features);
  const orientation = chooseOrientation(landIndex);
  log(`orientation rotation=${orientation.rotation} tilt=${orientation.tilt} pentagons on land=${orientation.onLand}`);
  const grid = buildGrid(FREQUENCY, orientation);
  const n = grid.centres.length;
  const latLon = grid.centres.map(toLatLon);
  const cellIndex = buildLatLonIndex(grid.centres);

  // Countries.
  const topo = readJson(path.join(GEO, 'countries.topo.json'));
  const countriesFc = feature(topo, topo.objects[Object.keys(topo.objects)[0]]);
  const countryIndex = polygonIndex(countriesFc.features);
  const countryIds = countriesFc.features.map((f) => f.id);
  const countryCentroids = countriesFc.features.map((f) => {
    // Mean of the largest ring's vertices, enough for a nearest-country fallback.
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let best = null;
    polys.forEach((p) => { if (!best || p[0].length > best[0].length) best = p; });
    const ring = best[0];
    const sum = ring.reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length, bboxOf(best)];
  });

  // Other layers.
  const regionsFc = readJson(path.join(RAW, 'ne', 'ne_10m_geography_regions_polys.geojson'));
  const regionIndex = polygonIndex(regionsFc.features);
  const glacierFc = readJson(path.join(RAW, 'ne', 'ne_10m_glaciated_areas.geojson'));
  const glacierIndex = polygonIndex(glacierFc.features);
  const lakesFc = readJson(path.join(RAW, 'ne', 'ne_10m_lakes.geojson'));
  const lakeIndex = polygonIndex(lakesFc.features.filter((f) => (f.properties.scalerank ?? 10) <= 3));
  const elevation = loadElevation();
  const koppen = KoppenLookup.getInstance();

  // Pass 1: land, country, elevation, climate, named regions, glaciers, lakes.
  const land = new Uint8Array(n);
  const country = new Int16Array(n).fill(-1);
  const elevMean = new Int16Array(n); const elevMax = new Int16Array(n); const rough = new Int16Array(n);
  const climate = new Array(n);
  const regionClasses = new Array(n);
  const glaciated = new Uint8Array(n); const lake = new Uint8Array(n);
  const spacingDeg = 1.3; // about half the cell spacing, in degrees of latitude
  for (let i = 0; i < n; i++) {
    const { lat, lon } = latLon[i];
    land[i] = landIndex.find(lon, lat).length ? 1 : 0;
    const samples = [];
    for (let a = -2; a <= 2; a++) {
      for (let b = -2; b <= 2; b++) {
        const sLat = lat + (a / 2) * spacingDeg * 0.5;
        const sLon = lon + ((b / 2) * spacingDeg * 0.5) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
        samples.push(elevation.sample(sLat, ((sLon + 540) % 360) - 180));
      }
    }
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
    const sd = Math.sqrt(samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length);
    elevMean[i] = Math.round(mean); elevMax[i] = Math.round(Math.max(...samples)); rough[i] = Math.round(sd);
    climate[i] = land[i] ? (koppen.findNearest(lat, lon, 150)?.koppenClass || null) : null;
    regionClasses[i] = new Set(regionIndex.find(lon, lat).map((f) => f.properties.featurecla || f.properties.FEATURECLA));
    glaciated[i] = glacierIndex.find(lon, lat).length ? 1 : 0;
    lake[i] = lakeIndex.find(lon, lat).length ? 1 : 0;
    if (land[i]) {
      const hits = countryIndex.find(lon, lat);
      if (hits.length) country[i] = countryIds.indexOf(hits[0].id);
      else {
        let best = -1; let bestD = Infinity;
        countryCentroids.forEach(([cx, cy, bbox], ci) => {
          if (lon < bbox[0] - 4 || lon > bbox[2] + 4 || lat < bbox[1] - 4 || lat > bbox[3] + 4) return;
          const d = distanceKm(fromLatLon(lat, lon), fromLatLon(cy, cx));
          if (d < bestD) { bestD = d; best = ci; }
        });
        country[i] = best;
      }
    }
  }
  log(`pass 1 done (${((Date.now() - t0) / 1000).toFixed(1)} s): land cells ${land.reduce((a, b) => a + b, 0)}`);

  // Coastal flags and sea distance.
  const coastal = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const ns = grid.neighbors[i];
    if (land[i]) coastal[i] = ns.some((j) => !land[j] && !lake[j]) ? 1 : 0;
    else coastal[i] = ns.some((j) => land[j]) ? 1 : 0;
  }

  // Rivers on edges: a river sample point marks the edge between its nearest two cells.
  const riversFc = readJson(path.join(RAW, 'ne', 'ne_10m_rivers_lake_centerlines.geojson'));
  const riverMask = new Uint8Array(n); // bit k = edge to neighbors[i][k]
  const riverNames = new Array(n);
  let riverSamples = 0;
  const markEdge = (a, b, name) => {
    const ka = grid.neighbors[a].indexOf(b); const kb = grid.neighbors[b].indexOf(a);
    if (ka < 0 || kb < 0) return;
    if (!land[a] && !land[b]) return;
    riverMask[a] |= 1 << ka; riverMask[b] |= 1 << kb;
    if (name) { riverNames[a] ||= name; riverNames[b] ||= name; }
  };
  riversFc.features.forEach((f) => {
    if ((f.properties.scalerank ?? 12) > 8) return;
    if (f.properties.featurecla && /lake/i.test(f.properties.featurecla)) return;
    const name = f.properties.name_en || f.properties.name || null;
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
    lines.forEach((line) => {
      for (let s = 0; s < line.length - 1; s++) {
        const [x0, y0] = line[s]; const [x1, y1] = line[s + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot((x1 - x0) * Math.cos((y0 * Math.PI) / 180), y1 - y0) / 0.15));
        for (let t = 0; t < steps; t++) {
          const lon = x0 + ((x1 - x0) * t) / steps; const lat = y0 + ((y1 - y0) * t) / steps;
          const [a, b] = cellIndex.nearest(lat, lon, 2);
          if (a >= 0 && b >= 0) { markEdge(a, b, name); riverSamples++; }
        }
      }
    });
  });
  log(`rivers: ${riverSamples} samples, ${riverMask.reduce((a, m) => a + (m ? 1 : 0), 0)} cells with a river edge`);

  // Names: the most populous Natural Earth place whose nearest cell is this one.
  const placesFc = readJson(path.join(RAW, 'ne', 'ne_10m_populated_places_simple.geojson'));
  const names = new Array(n).fill(null);
  const namePop = new Float64Array(n);
  placesFc.features.forEach((f) => {
    const [lon, lat] = f.geometry.coordinates;
    const id = cellIndex.nearest(lat, lon);
    const pop = f.properties.pop_max || 0;
    if (id >= 0 && pop >= namePop[id]) { namePop[id] = pop; names[id] = f.properties.name; }
  });

  // Capitals: each country's capital tile (nearest land tile to the capital coordinates; falls
  // back to the country's most central land tile; two capitals never share a tile).
  const caps = { ...CAPITAL_FALLBACKS, ...readJson(path.join(GEO, 'countryCapitals.json')) };
  Object.entries(CAPITAL_FALLBACKS).forEach(([cid, c]) => { if (caps[cid] && caps[cid].lat == null) caps[cid] = c; });
  const meta = readJson(path.join(GEO, 'countries-meta.json'));
  const capitalTile = {};
  const taken = new Set();
  const forcedIslands = [];
  const nearestLand = (lat, lon, preferCountry) => {
    const cands = cellIndex.nearest(lat, lon, 12);
    const ok = (id) => land[id] && !lake[id] && !taken.has(id);
    return cands.find((id) => ok(id) && (preferCountry < 0 || country[id] === preferCountry)) ?? cands.find(ok) ?? -1;
  };
  Object.keys(meta).forEach((cid) => {
    const ci = countryIds.indexOf(cid);
    let tile = -1;
    if (caps[cid]) tile = nearestLand(caps[cid].lat, caps[cid].lng, ci);
    if (tile < 0 && ci >= 0) {
      // The country's land tile closest to its centroid.
      const [cx, cy] = countryCentroids[ci];
      let best = -1; let bestD = Infinity;
      for (let i = 0; i < n; i++) {
        if (country[i] !== ci || !land[i] || taken.has(i)) continue;
        const d = distanceKm(grid.centres[i], fromLatLon(cy, cx));
        if (d < bestD) { bestD = d; best = i; }
      }
      tile = best;
    }
    if (tile < 0 && caps[cid]) {
      const cands = cellIndex.nearest(caps[cid].lat, caps[cid].lng, 10);
      // A microstate inside a bigger country's tile (San Marino, Hong Kong) takes the nearest
      // land tile that is nobody's capital, so every nation has a tile of its own (B6). An island
      // too small for the land polygons (Tuvalu, Tonga) turns the nearest free sea cell into a
      // one-tile island.
      tile = cands.find((id) => land[id] && !lake[id] && !taken.has(id)) ?? -1;
      if (tile < 0) {
        tile = cands.find((id) => !taken.has(id) && !land[id] && !lake[id]) ?? -1;
        if (tile >= 0) { land[tile] = 1; climate[tile] = koppen.findNearest(caps[cid].lat, caps[cid].lng, 400)?.koppenClass || 'Af'; forcedIslands.push(tile); }
      }
    }
    if (tile < 0) { log(`  no capital tile for ${cid} (${meta[cid].name})`); return; }
    taken.add(tile);
    capitalTile[cid] = tile;
    if (country[tile] !== ci && ci >= 0) country[tile] = ci; // the capital always belongs to its country
    if (caps[cid]?.name) names[tile] = caps[cid].name;
  });
  log(`capitals placed: ${Object.keys(capitalTile).length} of ${Object.keys(meta).length}, ${forcedIslands.length} as one-tile islands`);
  // Forced islands are coastal land with no river; their neighbours become coast.
  forcedIslands.forEach((i) => { coastal[i] = 1; grid.neighbors[i].forEach((j) => { if (!land[j]) coastal[j] = 1; }); });

  // Classification.
  const terrain = new Uint8Array(n); const relief = new Uint8Array(n); const featureCode = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const c = classify({
      id: i, land: !!land[i], lat: latLon[i].lat, elevMean: elevMean[i], elevMax: elevMax[i], rough: rough[i],
      koppen: climate[i], regionClasses: regionClasses[i], glaciated: !!glaciated[i], lake: !!lake[i],
      riverEdges: riverMask[i], coastal: !!coastal[i], depth: elevMean[i]
    });
    terrain[i] = code(TERRAIN, c.terrain); relief[i] = code(RELIEF, c.relief); featureCode[i] = code(FEATURE, c.feature);
  }

  const climateList = [...new Set(climate.filter(Boolean))].sort();
  const out = {
    version: GRID_VERSION,
    frequency: FREQUENCY,
    orientation: { rotation: orientation.rotation, tilt: orientation.tilt },
    count: n,
    terrainNames: TERRAIN, reliefNames: RELIEF, featureNames: FEATURE,
    climateNames: climateList,
    countryIds,
    // Flat arrays, one entry per cell (neighbors: 6 per cell, -1 pads a pentagon).
    lat: Array.from(latLon, (p) => Math.round(p.lat * 1000)),
    lon: Array.from(latLon, (p) => Math.round(p.lon * 1000)),
    neighbors: grid.neighbors.flatMap((ns) => (ns.length === 6 ? ns : [...ns, -1])),
    land: Array.from(land), coastal: Array.from(coastal),
    country: Array.from(country),
    elevation: Array.from(elevMean), roughness: Array.from(rough),
    climate: climate.map((k) => (k ? climateList.indexOf(k) : -1)),
    terrain: Array.from(terrain), relief: Array.from(relief), feature: Array.from(featureCode),
    rivers: Array.from(riverMask),
    riverNames: Object.fromEntries(riverNames.map((x, i) => [i, x]).filter(([, x]) => x)),
    names: Object.fromEntries(names.map((x, i) => [i, x]).filter(([, x]) => x)),
    capitals: capitalTile
  };
  return { out, grid, latLon, cellIndex, ms: Date.now() - t0 };
};

// ---------------------------------------------------------------------------------------------
// Preview PNG: equirectangular, one colour per terrain, rivers in blue, capitals in red.
const PREVIEW_COLORS = {
  ocean: [20, 50, 110], coast: [50, 100, 170], lake: [70, 130, 200],
  grassland: [92, 160, 70], plains: [170, 170, 90], desert: [225, 200, 130], tundra: [150, 160, 140], snow: [240, 240, 245]
};
export const writePreview = ({ out, cellIndex }, file) => {
  const W = 2048; const H = 1024;
  const png = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y / H) * 180;
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * 360 - 180;
      const id = cellIndex.nearest(lat, lon);
      let c = PREVIEW_COLORS[out.terrainNames[out.terrain[id]]] || [255, 0, 255];
      const relief = out.reliefNames[out.relief[id]]; const feat = out.featureNames[out.feature[id]];
      if (relief === 'hills') c = c.map((v) => Math.round(v * 0.8));
      if (relief === 'mountains') c = [110, 90, 80];
      if (feat === 'forest') c = [c[0] * 0.6, c[1] * 0.75, c[2] * 0.6].map(Math.round);
      if (feat === 'jungle') c = [30, 110, 40];
      if (feat === 'marsh') c = [90, 140, 120];
      if (feat === 'floodplain') c = [120, 190, 90];
      if (feat === 'ice') c = [220, 235, 250];
      if (out.rivers[id] && (x + y) % 3 === 0) c = [60, 120, 230];
      const o = (y * W + x) * 4;
      png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255;
    }
  }
  Object.values(out.capitals).forEach((id) => {
    const lat = out.lat[id] / 1000; const lon = out.lon[id] / 1000;
    const cx = Math.round(((lon + 180) / 360) * W); const cy = Math.round(((90 - lat) / 180) * H);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const o = (((cy + dy + H) % H) * W + ((cx + dx + W) % W)) * 4;
      png.data[o] = 230; png.data[o + 1] = 30; png.data[o + 2] = 30;
    }
  });
  writeFileSync(file, PNG.sync.write(png));
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = buildTiles();
  const { out } = result;
  writeFileSync(path.join(GEO, 'tiles.json'), JSON.stringify(out));
  const previewDir = path.join(__dirname, '.raw');
  mkdirSync(previewDir, { recursive: true });
  writePreview(result, path.join(previewDir, 'tiles-preview.png'));
  const count = (arr, namesList) => namesList.map((name, k) => `${name} ${arr.filter((v) => v === k).length}`).join(', ');
  console.log(`cells ${out.count}, land ${out.land.reduce((a, b) => a + b, 0)} (${((out.land.reduce((a, b) => a + b, 0) / out.count) * 100).toFixed(1)}%)`);
  console.log(`terrain: ${count(out.terrain, out.terrainNames)}`);
  console.log(`relief: ${count(out.relief, out.reliefNames)}`);
  console.log(`feature: ${count(out.feature, out.featureNames)}`);
  console.log(`named cells ${Object.keys(out.names).length}, capitals ${Object.keys(out.capitals).length}`);
  console.log(`wrote src/data/geo/tiles.json (${(JSON.stringify(out).length / 1024).toFixed(0)} KB) in ${(result.ms / 1000).toFixed(1)} s`);
}
