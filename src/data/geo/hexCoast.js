// src/data/geo/hexCoast.js
// The map's coastline follows the hexes (Civilization VI style): every hex is all land or all
// water, and the coast runs along hex edges with rounded corners and a gentle natural wobble, so
// no hex is drawn half sea. `buildHexLand(tiles)` turns the grid's land tiles into GeoJSON land
// polygons; scripts/geo/build-hex-coast.mjs writes them to hexLand.json, which the flat map and
// the globe clip territories to (loadWorldFeatures.loadLandFeatures), the close view masks its art
// with (groundBlend.js) and the Earth rasters are painted from (build-world-raster.mjs,
// build-raster-pyramid.mjs). Pure and deterministic.
import polygonClipping from 'polygon-clipping';
import { boundaryEdges, chainRings } from './tileGeometry';

// Corner cutting rounds the hex corners; two passes leave the coast reading as hexes, softened.
export const SMOOTH_PASSES = 2;
// The wobble, in degrees of arc (about 4 km): a little life along the coast, far below a hex
// (about 106 km), so a hex never looks part land.
export const WOBBLE_DEG = 0.035;
const PRECISION = 100; // coordinates rounded to 0.01 degrees (about 1 km)

// Smooth value noise in [-1, 1] over lon/lat, about one swell every 0.6 degrees.
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (t) => t * t * (3 - 2 * t);
export const coastNoise = (lon, lat) => {
  const f = 1 / 0.6;
  const x = lon * f; const y = lat * f;
  const x0 = Math.floor(x); const y0 = Math.floor(y);
  const sx = smooth(x - x0); const sy = smooth(y - y0);
  const a = hash(x0, y0); const b = hash(x0 + 1, y0); const c = hash(x0, y0 + 1); const d = hash(x0 + 1, y0 + 1);
  return ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy) * 2 - 1;
};

const cut = (p, q) => [[p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]];
/** One pass of Chaikin corner cutting on a closed ring (first point repeated at the end). */
export const chaikin = (ring) => {
  const pts = ring.slice(0, -1);
  const out = pts.flatMap((p, i) => cut(p, pts[(i + 1) % pts.length]));
  out.push(out[0]);
  return out;
};
// The same on an open line, its two ends kept.
const chaikinOpen = (line) => [line[0], ...line.slice(0, -1).flatMap((p, i) => cut(p, line[i + 1])), line[line.length - 1]];

// Each point pushed along the line's normal by the coast noise (`closed`: the last point repeats
// the first; an open line keeps its ends).
const wobble = (line, amount, closed = true) => {
  const pts = closed ? line.slice(0, -1) : line;
  const out = pts.map((p, i) => {
    if (!closed && (i === 0 || i === pts.length - 1)) return p;
    const prev = pts[(i - 1 + pts.length) % pts.length]; const next = pts[(i + 1) % pts.length];
    const dx = next[0] - prev[0]; const dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    const n = coastNoise(p[0], p[1]) * amount;
    return [p[0] + (dy / len) * n, p[1] - (dx / len) * n];
  });
  if (closed) out.push(out[0]);
  return out;
};

// Consecutive points the short way round (a ring across the antimeridian runs past +-180).
const unwrap = (ring) => {
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
};

const round = (ring) => {
  const out = [];
  ring.forEach(([x, y]) => {
    const p = [Math.round(x * PRECISION) / PRECISION, Math.round(y * PRECISION) / PRECISION];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  });
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0]);
  return out;
};

// buildTerritories unwraps a ring across the antimeridian (longitudes past +-180); planar clipping
// against the two world copies splits it back into pieces inside [-180, 180].
const WORLD = [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]];
const shift = (multi, dx) => multi.map((poly) => poly.map((ring) => ring.map(([x, y]) => [x + dx, y])));
const splitAtAntimeridian = (multi) => {
  const lons = multi.flat(2).map((p) => p[0]);
  if (Math.min(...lons) >= -180 && Math.max(...lons) <= 180) return multi;
  return [...polygonClipping.intersection(multi, WORLD), ...polygonClipping.intersection(shift(multi, -360), WORLD), ...polygonClipping.intersection(shift(multi, 360), WORLD)];
};

// d3-geo wants exterior rings clockwise in lon/lat (the countries topology's winding).
const signedArea = (ring) => { let a = 0; for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]; return a / 2; };
const d3Winding = (poly) => poly.map((ring, i) => ((i === 0) === (signedArea(ring) > 0) ? ring.slice().reverse() : ring));

export const CHUNK_DEG = 10;
const chunk = (poly) => {
  const xs = poly[0].map((p) => p[0]); const ys = poly[0].map((p) => p[1]);
  const out = [];
  for (let x = Math.floor(Math.min(...xs) / CHUNK_DEG) * CHUNK_DEG; x < Math.max(...xs); x += CHUNK_DEG) {
    for (let y = Math.floor(Math.min(...ys) / CHUNK_DEG) * CHUNK_DEG; y < Math.max(...ys); y += CHUNK_DEG) {
      const box = [[[x, y], [x + CHUNK_DEG, y], [x + CHUNK_DEG, y + CHUNK_DEG], [x, y + CHUNK_DEG], [x, y]]];
      polygonClipping.intersection([poly], box).forEach((p) => out.push(p));
    }
  }
  return out;
};

const pointInRing = (ring, x, y) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// The polar cap round the South Pole counts as land, so Antarctica is one landmass whose coast
// circles the pole instead of a ring round a hole at the pole cell.
const POLAR_CAP_LAT = -85;

/** The land as GeoJSON features (one per landmass piece), coast along hex edges, softened. */
export const buildHexLand = (tiles, { passes = SMOOTH_PASSES, wobbleDeg = WOBBLE_DEG, chunked = true } = {}) => {
  const isLand = (i) => tiles.land[i] === 1 || tiles.latLonOf(i).lat < POLAR_CAP_LAT;
  const segments = boundaryEdges(tiles, (i) => (isLand(i) ? 'land' : null)).filter((e) => e.owner === 'land');
  const exteriors = []; const holes = [];
  chainRings(segments).map(unwrap).forEach((ring) => {
    const span = ring[ring.length - 1][0] - ring[0][0];
    if (Math.abs(span) > 180) {
      // A coast that circles the South Pole: smooth it as a line, then close it over the pole.
      let line = ring;
      for (let k = 0; k < passes; k++) line = chaikinOpen(line);
      line = wobble(line, wobbleDeg, false);
      const last = line[line.length - 1];
      exteriors.push(round([...line, [last[0], -90], [line[0][0], -90], line[0]]));
      return;
    }
    let r = ring;
    for (let k = 0; k < passes; k++) r = chaikin(r);
    r = round(wobble(r, wobbleDeg));
    if (r.length < 4) return;
    (signedArea(ring) > 0 ? exteriors : holes).push(r);
  });
  // Each hole belongs to the exterior that contains its first point.
  const polygons = exteriors.map((ext) => [ext]);
  holes.forEach((hole) => {
    const [x, y] = hole[0];
    const idx = exteriors.findIndex((ext) => pointInRing(ext, x, y));
    if (idx >= 0) polygons[idx].push(hole);
  });
  // Cut into CHUNK_DEG squares, so clipping a territory (cityFeatures.js) only meets small pieces.
  // `chunked: false` (generated worlds, built at load time): whole landmasses, which skips most of
  // the clipping cost (seconds); only the legacy SVG map clips territories against them.
  const split = splitAtAntimeridian(polygons);
  const pieces = chunked ? split.flatMap((poly) => chunk(poly)) : split;
  return pieces.map((poly, i) => ({ type: 'Feature', id: `land-${i}`, properties: {}, geometry: { type: 'Polygon', coordinates: d3Winding(poly.map(round)) } }));
};
