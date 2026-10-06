// scripts/geo/build-raster-pyramid.mjs
// The realistic Earth as a tile pyramid (plans/playtest-1.md P1.2), so the flat map stays sharp
// when you zoom in: the same look as build-world-raster.mjs (climate colours, hypsometric tints,
// snow line, hillshade, bathymetry, rivers), rendered at 16,384 x 8,192 (about 2.4 km a pixel,
// 44 pixels a hex) from finer sources, then cut into 256-pixel WebP tiles and halved down to the
// whole world in two tiles.
//   level z has 2^(z+1) x 2^z tiles of 256 px (equirectangular, so it lines up with the map's
//   own projection); MAX_Z = 5 is the full resolution.
//   public/map/tiles/{z}/{x}-{y}.webp, plus public/map/tiles/meta.json { maxZ, tile }.
// Sources (scripts/geo/.raw): terrarium elevation at zoom 5 (1,024 tiles, terrarium5/), the land
// from src/data/geo/hexLand.json (the hex coast; run build-hex-coast.mjs first), the Natural Earth
// 1:10M glaciers and rivers.
// Fetch them with: node scripts/geo/fetch-tiles-raw.mjs --pyramid
// Memory stays small: the full level is rendered one 256-pixel band at a time.
// Run: node scripts/geo/build-raster-pyramid.mjs   (a few minutes)
import { readFileSync, mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { climateColorGrid } from './build-world-raster.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { PNG } = require('pngjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '.raw');
const HEX_LAND = path.join(__dirname, '../../src/data/geo/hexLand.json');
const OUT = path.join(__dirname, '../../public/map/tiles');
export const MAX_Z = 5;
export const TILE = 256;
const W = TILE * 2 ** (MAX_Z + 1); const H = TILE * 2 ** MAX_Z;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const log = (...a) => console.log(...a);

// ---- elevation: terrarium zoom 5 (web mercator), bilinear --------------------------------------
const loadElevation5 = () => {
  const N = 32; const SIZE = N * 256;
  const data = new Float32Array(SIZE * SIZE);
  for (let tx = 0; tx < N; tx++) for (let ty = 0; ty < N; ty++) {
    const file = path.join(RAW, 'terrarium5', `${tx}-${ty}.png`);
    if (!existsSync(file)) throw new Error(`missing ${file}: run node scripts/geo/fetch-tiles-raw.mjs --pyramid`);
    const png = PNG.sync.read(readFileSync(file));
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const o = (y * 256 + x) * 4;
      data[(ty * 256 + y) * SIZE + tx * 256 + x] = png.data[o] * 256 + png.data[o + 1] + png.data[o + 2] / 256 - 32768;
    }
  }
  const at = (xi, yi) => data[Math.max(0, Math.min(SIZE - 1, yi)) * SIZE + (((xi % SIZE) + SIZE) % SIZE)];
  const sample = (lat, lon) => {
    const la = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
    const x = ((lon + 180) / 360) * SIZE - 0.5;
    const y = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * SIZE - 0.5;
    const x0 = Math.floor(x); const y0 = Math.floor(y); const fx = x - x0; const fy = y - y0;
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };
  return { sample };
};

// ---- vector layers as SVG path data in full-level pixels ---------------------------------------
const toPaths = (features, filter = () => true) => {
  const parts = [];
  features.forEach((f) => {
    if (!filter(f) || !f.geometry) return;
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    polys.forEach((rings) => rings.forEach((ring) => {
      parts.push(ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${(((lon + 180) / 360) * W).toFixed(1)} ${(((90 - lat) / 180) * H).toFixed(1)}`).join('') + 'Z');
    }));
  });
  return parts.join('');
};
const toRiverStrokes = (features) => {
  const strokes = [];
  features.forEach((f) => {
    const rank = f.properties.scalerank ?? 12;
    if (rank > 9 || /lake/i.test(f.properties.featurecla || '')) return;
    const width = rank <= 3 ? 4.5 : rank <= 6 ? 3 : 1.8;
    const lines = f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : [];
    lines.forEach((line) => {
      const d = line.map(([lon, lat], i) => `${i ? 'L' : 'M'}${(((lon + 180) / 360) * W).toFixed(1)} ${(((90 - lat) / 180) * H).toFixed(1)}`).join('');
      strokes.push(`<path d="${d}" stroke="rgb(96,156,214)" stroke-opacity="0.75" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    });
  });
  return strokes.join('');
};
// A band of the full level, `rows` tall from `y0`, as a 0/1 mask.
const bandMask = async (pathData, y0, rows) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${rows}" viewBox="0 ${y0} ${W} ${rows}"><path d="${pathData}" fill="white" fill-rule="evenodd"/></svg>`;
  const { data } = await sharp(Buffer.from(svg), { limitInputPixels: false }).raw().toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(W * rows);
  for (let i = 0; i < W * rows; i++) mask[i] = data[i * 4] > 127 ? 1 : 0;
  return mask;
};
// Land stays at least 2 m up, the sea at least 80 m down (see the band loop): sunk real islands
// would otherwise show as pale ghosts of land.
export const clampToCoast = (e, isLand) => (isLand ? Math.max(e, 2) : Math.min(e, -80));
// A river overlay (PNG with alpha) with its alpha cleared off the land mask.
const landOnly = async (png, land, rows) => {
  const { data } = await sharp(png, { limitInputPixels: false }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < W * rows; i++) if (!land[i]) data[i * 4 + 3] = 0;
  return sharp(data, { raw: { width: W, height: rows, channels: 4 }, limitInputPixels: false }).png().toBuffer();
};
const bandRivers = (strokes, y0, rows) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${rows}" viewBox="0 ${y0} ${W} ${rows}">${strokes}</svg>`), { limitInputPixels: false }).png().toBuffer();

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// One pixel's colour: the same rules as build-world-raster.mjs, at this resolution.
const LIGHT = [-0.5, -0.6, 0.62];
// makeShadePixel(width, height) gives the same rules for another level (build-raster-detail.mjs
// renders level 6 with it); `relief` scales the hillshade's exaggeration (9 at level 5).
export const makeShadePixel = (W, H, relief = 9) => (ctx, x, y, eC, eL, eR, eU, eD) => {
  const { climate, isLand, isLake, isIce } = ctx;
  const lat = 90 - ((y + 0.5) / H) * 180; const lon = ((x + 0.5) / W) * 360 - 180;
  const kmLat = (180 / H) * 111; const kmLon = Math.max(0.2, kmLat * Math.cos((lat * Math.PI) / 180));
  const gx = ((eR - eL) / (2 * kmLon * 1000)) * relief; const gy = ((eD - eU) / (2 * kmLat * 1000)) * relief;
  const nl = Math.hypot(gx, gy, 1);
  const dot = (-gx / nl) * LIGHT[0] + (-gy / nl) * LIGHT[1] + (1 / nl) * LIGHT[2];
  let shade = 0.62 + 0.5 * Math.max(0, dot);
  let color;
  const ice = isIce || lat < -84;
  if (isLand && !isLake) {
    if (ice) { color = [232, 238, 244]; shade = 0.8 + 0.3 * Math.max(0, dot); }
    else {
      color = climate.sample(lat, lon);
      color = mix(color, [152, 128, 102], clamp01((eC - 700) / 2400) * 0.75);
      color = mix(color, [168, 160, 152], clamp01((eC - 2600) / 1800) * 0.8);
      color = mix(color, [240, 243, 246], clamp01((eC - (5400 - Math.abs(lat) * 40)) / 600));
      if (eC < 50) color = mix(color, [color[0] * 0.92, color[1] * 0.98, color[2] * 0.9], 0.5);
    }
  } else if (isLake) { color = [58, 118, 170]; shade = 0.9 + 0.1 * Math.max(0, dot); }
  else {
    const depth = Math.max(0, -eC);
    color = mix([92, 160, 205], [48, 104, 165], clamp01(depth / 220));
    color = mix(color, [18, 42, 92], clamp01((depth - 220) / 3800));
    shade = 0.88 + 0.2 * Math.max(0, dot);
    if (lat < -62 && ice) { color = [226, 234, 242]; shade = 0.95; }
  }
  const grain = 1 + (hash(x, y) - 0.5) * 0.04;
  return [color[0] * shade * grain, color[1] * shade * grain, color[2] * shade * grain];
};
const shadePixel = makeShadePixel(W, H);

export const buildRasterPyramid = async () => {
  const t0 = Date.now();
  const elevation = loadElevation5();
  const climate = climateColorGrid();
  // The coast follows the hexes (src/data/geo/hexCoast.js): every hex all land or all water, so
  // lakes too are whole water hexes and the land paths are the game's own hexLand.json.
  const landPaths = toPaths(readJson(HEX_LAND).features);
  const icePaths = toPaths(readJson(path.join(RAW, 'ne', 'ne_10m_glaciated_areas.geojson')).features);
  const riverStrokes = toRiverStrokes(readJson(path.join(RAW, 'ne', 'ne_10m_rivers_lake_centerlines.geojson')).features);
  log(`sources ready (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  rmSync(OUT, { recursive: true, force: true });
  for (let z = 0; z <= MAX_Z; z++) mkdirSync(path.join(OUT, String(z)), { recursive: true });

  const cols = 2 ** (MAX_Z + 1); const rowsOfTiles = 2 ** MAX_Z;
  for (let ty = 0; ty < rowsOfTiles; ty++) {
    const y0 = ty * TILE;
    // The land for the band and one row above and below (the elevation gradient needs them).
    const [landExt, ice, riversRaw] = await Promise.all([bandMask(landPaths, y0 - 1, TILE + 2), bandMask(icePaths, y0, TILE), bandRivers(riverStrokes, y0, TILE)]);
    const land = landExt.subarray(W);
    // Rivers only on land: the hex coast leaves some river mouths in the sea.
    const rivers = await landOnly(riversRaw, land, TILE);
    // Elevation for the band and one row above and below, held above sea level on land and below
    // it at sea, so the real coastline leaves no ghost edge inside a hex.
    const er = new Float32Array(W * (TILE + 2));
    for (let r = -1; r <= TILE; r++) {
      const lat = 90 - ((Math.max(0, Math.min(H - 1, y0 + r)) + 0.5) / H) * 180;
      for (let x = 0; x < W; x++) er[(r + 1) * W + x] = clampToCoast(elevation.sample(lat, ((x + 0.5) / W) * 360 - 180), landExt[(r + 1) * W + x] === 1);
    }
    const rgb = new Uint8Array(W * TILE * 3);
    for (let r = 0; r < TILE; r++) {
      for (let x = 0; x < W; x++) {
        const i = r * W + x; const row = (r + 1) * W;
        const c = shadePixel({ climate, isLand: land[i] === 1, isLake: false, isIce: ice[i] === 1 }, x, y0 + r,
          er[row + x], er[row + ((x - 1 + W) % W)], er[row + ((x + 1) % W)], er[r * W + x], er[(r + 2) * W + x]);
        const o = i * 3;
        rgb[o] = Math.max(0, Math.min(255, Math.round(c[0]))); rgb[o + 1] = Math.max(0, Math.min(255, Math.round(c[1]))); rgb[o + 2] = Math.max(0, Math.min(255, Math.round(c[2])));
      }
    }
    const band = await sharp(Buffer.from(rgb.buffer), { raw: { width: W, height: TILE, channels: 3 }, limitInputPixels: false }).composite([{ input: rivers }]).png().toBuffer();
    await Promise.all(Array.from({ length: cols }, (_, tx) => sharp(band, { limitInputPixels: false }).extract({ left: tx * TILE, top: 0, width: TILE, height: TILE }).webp({ quality: 80 }).toFile(path.join(OUT, String(MAX_Z), `${tx}-${ty}.webp`))));
    if (ty % 4 === 3) log(`level ${MAX_Z}: band ${ty + 1}/${rowsOfTiles} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  // The lower levels: four children composed and halved.
  for (let z = MAX_Z - 1; z >= 0; z--) {
    const zc = 2 ** (z + 1); const zr = 2 ** z;
    for (let ty = 0; ty < zr; ty++) {
      await Promise.all(Array.from({ length: zc }, async (_, tx) => {
        const kids = [];
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) kids.push({ input: path.join(OUT, String(z + 1), `${tx * 2 + dx}-${ty * 2 + dy}.webp`), left: dx * TILE, top: dy * TILE });
        const merged = await sharp({ create: { width: TILE * 2, height: TILE * 2, channels: 3, background: { r: 18, g: 42, b: 92 } } }).composite(kids).png().toBuffer();
        await sharp(merged).resize(TILE, TILE, { kernel: 'lanczos3' }).webp({ quality: 80 }).toFile(path.join(OUT, String(z), `${tx}-${ty}.webp`));
      }));
    }
    log(`level ${z} done`);
  }
  writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ maxZ: MAX_Z, tile: TILE, width: W, height: H }));
  log(`pyramid written to public/map/tiles (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await buildRasterPyramid();
