// scripts/geo/build-tiles.mjs
// Builds the Civ-style world grid (plans/civ-map-rework.md, Part B and workstream 1):
// src/data/geo/tiles.json, one record per cell of a frequency-100 geodesic grid (100,002 cells of
// about 5,100 km², about 77 km between neighbours; frequency 75 and 102 km until 2026-10-04,
// frequency 53 and 150 km hexes until 2026-10-03), with land/sea, country, elevation, climate, terrain, relief, feature, river
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
import { TERRAIN, RELIEF, FEATURE, hash01, classify, scatterResource } from '../../src/data/geo/classifyTile.js';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const KoppenModule = require('koppen-climate-lookup');
const KoppenLookup = KoppenModule.default || KoppenModule.KoppenLookup || KoppenModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '.raw');
const GEO = path.join(__dirname, '../../src/data/geo');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export const FREQUENCY = 100;
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
// Terrain classification and the resource scatter live in src/data/geo/classifyTile.js (shared with
// the world generator, plans/MAP-VARIATIONS-PLAN.md 3.4). Codes are small integers; the names live
// in tiles-meta.
export { TERRAIN, RELIEF, FEATURE };
const code = (list, name) => { const i = list.indexOf(name); if (i < 0) throw new Error(`unknown ${name}`); return i; };

// Real straits (plans/math/straits.md). A strait narrower than a cell (14 km at Gibraltar, 1 km
// at the Bosphorus) falls on cells the land polygons call land, which seals the Mediterranean, the
// Black Sea, the Sea of Azov and others off from the ocean. Each strait is a polyline of
// [lat, lon] points that runs from open water on one side to open water on the other, along the
// real channel; every cell the line passes through becomes water. Nearest-cell regions along a line
// are contiguous, so the carved cells always form a connected channel, at any grid frequency.
// Keep the end points in water that is wide at every frequency (the line carves nothing there).
// A line carves only when its two ends are not already joined by sea: where the grid keeps a
// strait open by itself (the Danish straits at frequency 75 and 100), no land is lost to it.
export const STRAIT_LINES = [
  { name: 'Gibraltar', line: [[35.9, -6.6], [35.95, -5.75], [35.97, -5.45], [36.1, -4.8], [36.3, -4.0]] },
  { name: 'Dardanelles', line: [[39.85, 25.9], [40.05, 26.2], [40.2, 26.4], [40.4, 26.7], [40.6, 27.2]] },
  { name: 'Sea of Marmara', line: [[40.6, 27.2], [40.75, 28.0], [40.85, 28.7], [41.0, 29.0]] },
  { name: 'Bosphorus', line: [[40.85, 28.9], [41.0, 29.0], [41.1, 29.05], [41.2, 29.1], [41.3, 29.2], [41.7, 29.5]] },
  { name: 'Kerch', line: [[44.8, 36.3], [45.1, 36.5], [45.3, 36.6], [45.6, 36.8], [46.0, 36.9]] },
  { name: 'Oresund', line: [[54.7, 13.1], [55.0, 12.9], [55.4, 12.85], [55.7, 12.7], [56.0, 12.65], [56.3, 12.3], [56.7, 12.0]] },
  { name: 'Great Belt', line: [[54.6, 11.0], [55.0, 10.95], [55.3, 11.0], [55.7, 11.0], [56.1, 11.2]] },
  { name: 'Gulf of Finland', line: [[59.3, 21.5], [59.55, 23.0], [59.75, 24.5], [59.9, 26.0], [60.0, 27.5], [59.95, 29.0], [59.95, 30.1]] },
  { name: 'White Sea throat', line: [[65.3, 38.5], [65.9, 39.5], [66.4, 40.4], [66.9, 41.0], [67.8, 41.5]] },
  { name: 'Bab-el-Mandeb', line: [[12.0, 44.2], [12.4, 43.6], [12.6, 43.35], [12.9, 43.1], [13.4, 42.7]] },
  { name: 'Hormuz', line: [[25.6, 57.4], [26.2, 56.8], [26.55, 56.4], [26.5, 56.0], [26.3, 55.5]] },
  { name: 'Malacca', line: [[5.5, 98.5], [4.0, 99.8], [2.6, 101.0], [1.8, 102.2], [1.25, 103.4], [1.2, 103.8], [1.3, 104.3]] },
  { name: 'Bass', line: [[-38.5, 141.5], [-39.4, 144.0], [-39.6, 146.5], [-39.5, 148.5]] },
  { name: 'Gulf of California midriff', line: [[27.5, -111.5], [28.6, -112.7], [29.5, -113.3], [30.4, -113.9], [31.0, -114.4]] },
  { name: 'St Lawrence estuary', line: [[49.9, -64.0], [49.4, -66.5], [49.0, -68.0], [48.4, -69.3], [47.6, -70.1]] },
  { name: 'Juan de Fuca and Georgia', line: [[48.45, -124.8], [48.25, -123.6], [48.5, -123.2], [48.9, -123.3], [49.4, -123.9]] },
  { name: 'Lake Maracaibo outlet', line: [[11.6, -71.2], [11.0, -71.5], [10.6, -71.6], [10.0, -71.6]] },
  { name: 'Gulf of Khambhat', line: [[20.7, 71.9], [21.3, 72.4], [21.8, 72.5], [22.2, 72.4]] },
  { name: 'Gulf of Ob', line: [[72.8, 73.8], [71.6, 73.0], [70.2, 73.4], [69.0, 73.6], [67.8, 73.6], [67.0, 72.5], [66.5, 71.4]] },
  { name: 'Taz estuary', line: [[69.0, 73.6], [68.6, 75.3], [68.0, 76.8], [67.5, 78.0]] },
  { name: 'Gydan Bay', line: [[72.3, 75.8], [71.8, 76.8], [71.2, 77.8], [70.9, 78.6]] }
];
// Water the ocean must NOT reach: real landlocked seas. A sea pocket holding one of these points is
// left alone by the inlet pass below (and is the only kind of pocket the build accepts).
export const LANDLOCKED_SEAS = [
  { name: 'Caspian Sea', lat: 42.0, lon: 51.0 },
  // Not a sea: the polygon test misses the pole itself, so the South Pole cell reads as water. Left
  // as it is: a territory around the pole breaks the border geometry (tileGeometry.js).
  { name: 'South Pole cell', lat: -90, lon: 0 }
];
// A sea pocket that is not landlocked and lies within this much land of the open ocean is an inlet
// the grid closed (a fjord, a sound between Arctic islands): the build opens the shortest land path.
// In kilometres, converted with the grid's measured spacing, so it scales with the frequency.
export const MAX_INLET_GAP_KM = 230;
// The longest sea path, in cells, that still counts as the strait being open for a line crossing
// `lineCells` cells: the channel itself with a little room to wind, never the way round an island.
export const straitDetour = (lineCells) => 2 * lineCells + 2;

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
  const lakeIndex = polygonIndex(lakesFc.features.filter((f) => (f.properties.scalerank ?? 10) <= 6));
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

  // Open the real straits (STRAIT_LINES), then any small inlet the grid closed (see MAX_INLET_GAP_KM).
  const opened = new Set();
  const openCell = (id) => {
    land[id] = 0; country[id] = -1; climate[id] = null; lake[id] = 0; glaciated[id] = 0;
    elevMean[id] = Math.min(elevMean[id], -20); // shelf water for the classifier
    opened.add(id);
  };
  const seaCell = (i) => !land[i] && !lake[i];
  const seaComponents = () => {
    const comp = new Int32Array(n).fill(-1); const sizes = [];
    for (let s = 0; s < n; s++) {
      if (!seaCell(s) || comp[s] >= 0) continue;
      const c = sizes.length; let size = 0; const stack = [s]; comp[s] = c;
      while (stack.length) { const i = stack.pop(); size++; grid.neighbors[i].forEach((j) => { if (comp[j] < 0 && seaCell(j)) { comp[j] = c; stack.push(j); } }); }
      sizes.push(size);
    }
    let main = 0; sizes.forEach((sz, c) => { if (sz > sizes[main]) main = c; });
    return { comp, sizes, main };
  };
  // Sea steps from a to b, or -1 when b is more than maxSteps away by sea. A strait counts as open
  // only through a short local path: the Strait of Malacca is not open because Sumatra can be
  // sailed around.
  const seaSteps = (a, b, maxSteps) => {
    const dist = new Map([[a, 0]]); let frontier = [a];
    for (let d = 1; d <= maxSteps && frontier.length; d++) {
      const next = [];
      for (const i of frontier) for (const j of grid.neighbors[i]) {
        if (dist.has(j) || !seaCell(j)) continue;
        if (j === b) return d;
        dist.set(j, d); next.push(j);
      }
      frontier = next;
    }
    return -1;
  };
  const STEP_DEG = 0.05; // about 5 km between samples, far finer than any planned grid
  const lineCells = (line) => {
    const cells = [];
    for (let s = 0; s < line.length - 1; s++) {
      const [la0, lo0] = line[s]; const [la1, lo1] = line[s + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(la1 - la0, lo1 - lo0) / STEP_DEG));
      for (let t = 0; t <= steps; t++) {
        const id = cellIndex.nearest(la0 + ((la1 - la0) * t) / steps, lo0 + ((lo1 - lo0) * t) / steps);
        if (cells[cells.length - 1] !== id) cells.push(id);
      }
    }
    return cells;
  };
  STRAIT_LINES.forEach(({ name, line }) => {
    const cells = lineCells(line);
    // The water at the two ends of the line: its first and last sea cells.
    const first = cells.find(seaCell); const last = cells.slice().reverse().find(seaCell);
    if (first != null && last != null && first !== last && seaSteps(first, last, straitDetour(cells.length)) >= 0) {
      log(`  strait ${name}: already open`); return;
    }
    const cut = [...new Set(cells.filter((id) => land[id] || lake[id]))];
    cut.forEach(openCell);
    log(`  strait ${name}: opened ${cut.join(', ') || 'nothing'}`);
  });
  let spacingSum = 0; let spacingCount = 0;
  for (let i = 0; i < n; i += 97) grid.neighbors[i].forEach((j) => { spacingSum += distanceKm(grid.centres[i], grid.centres[j]); spacingCount++; });
  const maxGapCells = Math.max(1, Math.floor(MAX_INLET_GAP_KM / (spacingSum / spacingCount)));
  const landlockedCells = new Set(LANDLOCKED_SEAS.map(({ lat, lon }) => cellIndex.nearest(lat, lon)));
  for (let round = 0; round < 50; round++) {
    const { comp, main } = seaComponents();
    const keep = new Set([main, ...[...landlockedCells].filter(seaCell).map((i) => comp[i])]);
    let carved = 0;
    const pocketsSeen = new Set();
    for (let s = 0; s < n; s++) {
      if (!seaCell(s) || comp[s] < 0 || keep.has(comp[s]) || pocketsSeen.has(comp[s])) continue; // < 0: opened this round
      const pocket = comp[s]; pocketsSeen.add(pocket);
      // Breadth-first over land from the whole pocket to the nearest cell of the main ocean.
      const prev = new Map(); let frontier = [];
      for (let i = s; i < n; i++) if (comp[i] === pocket) { prev.set(i, -1); frontier.push(i); }
      let goal = -1;
      for (let depth = 0; depth <= maxGapCells && goal < 0; depth++) {
        const next = [];
        for (const i of frontier) {
          for (const j of grid.neighbors[i]) {
            if (prev.has(j)) continue;
            if (seaCell(j) && comp[j] === main) { prev.set(j, i); goal = j; break; }
            if (land[j] && depth < maxGapCells) { prev.set(j, i); next.push(j); }
          }
          if (goal >= 0) break;
        }
        frontier = next;
      }
      const where = `${latLon[s].lat.toFixed(1)}, ${latLon[s].lon.toFixed(1)}`;
      if (goal < 0) { log(`  sea pocket at ${where} stays closed (no ocean within ${maxGapCells} land cells)`); continue; }
      const path = [];
      for (let i = prev.get(goal); i >= 0 && land[i]; i = prev.get(i)) path.push(i);
      path.forEach(openCell); carved += path.length;
      log(`  inlet at ${where}: opened ${path.join(', ')}`);
    }
    if (!carved) break;
  }
  {
    const { comp, sizes, main } = seaComponents();
    const closed = sizes.map((sz, c) => c).filter((c) => c !== main);
    log(`  sea: ${sizes[main]} cells reach the ocean; closed pockets: ${closed.map((c) => {
      const i = comp.indexOf(c); return `${sizes[c]} at ${latLon[i].lat.toFixed(1)}, ${latLon[i].lon.toFixed(1)}`;
    }).join('; ') || 'none'}`);
  }

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
    let id = cellIndex.nearest(lat, lon);
    // A town on a strait (Istanbul, Tangier) or whose nearest cell is sea (a port: Mumbai,
    // Singapore, Çanakkale) keeps its name on the nearest land among its 7 nearest cells; a name
    // with no land that close stays on its sea cell (never on a cell a strait opened).
    if (opened.has(id) || !land[id]) {
      const bank = cellIndex.nearest(lat, lon, 7).find((j) => land[j] && !lake[j]);
      id = bank ?? (opened.has(id) ? -1 : id);
    }
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

  // Resources (plans/civ-map-rework.md C1): a deterministic scatter by terrain, relief and feature,
  // with the curated country deposits (src/data/deposits.js) guaranteeing copper, iron and oil
  // where history put them. One resource per tile at most; amounts come later from improvements.
  const resourceOf = new Array(n).fill(null);
  const depositsByCountry = readJson(path.join(__dirname, '../../src/data/geo/deposits.json'));
  for (let i = 0; i < n; i++) {
    resourceOf[i] = scatterResource(i, { land: !!land[i], t: TERRAIN[terrain[i]], rel: RELIEF[relief[i]], feat: FEATURE[featureCode[i]], near: coastal[i] });
  }
  // Curated deposits: every listed country gets at least two tiles of each of its resources, on
  // its own land, chosen by the hash so the choice never moves between builds.
  Object.entries(depositsByCountry).forEach(([cid, list]) => {
    const ci = countryIds.indexOf(cid);
    if (ci < 0) return;
    const own = [];
    for (let i = 0; i < n; i++) if (land[i] && country[i] === ci && TERRAIN[terrain[i]] !== 'snow') own.push(i);
    if (!own.length) return;
    list.forEach((res, k) => {
      const have = own.filter((i) => resourceOf[i] === res).length;
      const ordered = own.slice().sort((a, b) => hash01(a, 50 + k) - hash01(b, 50 + k));
      for (let j = 0, placed = have; placed < Math.min(2, own.length) && j < ordered.length; j++) {
        const i = ordered[j];
        if (resourceOf[i] === res) continue;
        if (resourceOf[i] && hash01(i, 60) < 0.5) continue;
        resourceOf[i] = res; placed++;
      }
    });
  });
  const resourceList = [...new Set(resourceOf.filter(Boolean))].sort();

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
    resourceNames: resourceList,
    resource: resourceOf.map((r) => (r ? resourceList.indexOf(r) : -1)),
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
  console.log(`resources: ${out.resourceNames.map((name, k) => `${name} ${out.resource.filter((v) => v === k).length}`).join(', ')}`);
  console.log(`wrote src/data/geo/tiles.json (${(JSON.stringify(out).length / 1024).toFixed(0)} KB) in ${(result.ms / 1000).toFixed(1)} s`);
}
