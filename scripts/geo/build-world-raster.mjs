// scripts/geo/build-world-raster.mjs
// The realistic base map (plans/civ-map-rework.md, B4b): a shaded-relief Earth rendered from the
// same real data the grid is built from, so coasts, mountains, deserts, forests and ice are
// where they really are. Equirectangular, so it is both the flat map background and the globe
// texture. Written to public/map/world-4096.webp (desktop flat map and globe) and
// public/map/world-2048.webp (phones).
//
// Inputs (scripts/geo/.raw, see fetch-tiles-raw.mjs): terrarium elevation tiles (zoom 4),
// Natural Earth land, lakes, glaciers and rivers, Köppen climate at 0.5°. Everything is derived
// per pixel: a climate colour (bilinear across the 0.5° cells, so no blocks), hypsometric tints
// and a snow line with elevation, hillshade from the elevation gradient, bathymetry in the sea,
// rivers drawn on top. Deterministic.
//
// Run: node scripts/geo/build-world-raster.mjs   (about a minute)
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadElevation } from './build-tiles.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const KoppenModule = require('koppen-climate-lookup');
const KoppenLookup = KoppenModule.default || KoppenModule.KoppenLookup || KoppenModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '.raw');
const OUT = path.join(__dirname, '../../public/map');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const W = 4096; const H = 2048;

// ---- climate colours (sRGB, low elevation) ---------------------------------------------------
export const CLIMATE_COLOR = {
  Af: [36, 88, 40], Am: [44, 96, 44], Aw: [108, 128, 56], As: [118, 132, 62],
  BWh: [218, 190, 134], BWk: [200, 182, 142], BSh: [176, 162, 98], BSk: [162, 152, 104],
  Cfa: [84, 130, 60], Cwa: [92, 132, 60], Cfb: [78, 124, 66], Cfc: [92, 122, 86], Cwb: [86, 126, 70], Cwc: [96, 120, 86],
  Csa: [142, 146, 82], Csb: [126, 138, 80], Csc: [120, 130, 90],
  Dfa: [96, 126, 70], Dwa: [100, 124, 72], Dsa: [120, 128, 80], Dfb: [84, 116, 70], Dwb: [88, 114, 72], Dsb: [110, 120, 82],
  Dfc: [78, 100, 74], Dwc: [82, 100, 76], Dsc: [100, 108, 84], Dfd: [100, 106, 88], Dwd: [104, 108, 90],
  ET: [142, 136, 116], EF: [236, 239, 242]
};
const DEFAULT_LAND = [120, 130, 90];

export const climateColorGrid = () => {
  const lookup = KoppenLookup.getInstance();
  const cols = 720; const rows = 360;
  const grid = new Uint8Array(cols * rows * 3);
  const cells = lookup.grid instanceof Map ? [...lookup.grid.values()] : Object.values(lookup.grid);
  cells.forEach((cell) => {
    const col = Math.floor((cell.longitude + 180) / 0.5); const row = Math.floor((cell.latitude + 90) / 0.5);
    const c = CLIMATE_COLOR[cell.koppenClass] || DEFAULT_LAND;
    const o = (row * cols + col) * 3;
    grid[o] = c[0]; grid[o + 1] = c[1]; grid[o + 2] = c[2];
  });
  // Fill sea cells (no climate) from the nearest land cell in the row, so coasts don't bleed grey.
  const filled = new Uint8Array(grid);
  for (let row = 0; row < rows; row++) {
    let last = null;
    for (let col = 0; col < cols; col++) {
      const o = (row * cols + col) * 3;
      if (grid[o] || grid[o + 1] || grid[o + 2]) last = o;
      else if (last != null) { filled[o] = grid[last]; filled[o + 1] = grid[last + 1]; filled[o + 2] = grid[last + 2]; }
    }
    let next = null;
    for (let col = cols - 1; col >= 0; col--) {
      const o = (row * cols + col) * 3;
      if (grid[o] || grid[o + 1] || grid[o + 2]) next = o;
      else if (!(filled[o] || filled[o + 1] || filled[o + 2]) && next != null) { filled[o] = grid[next]; filled[o + 1] = grid[next + 1]; filled[o + 2] = grid[next + 2]; }
    }
  }
  // Two 3x3 box blurs: a climate boundary becomes a 1.5 degree gradient instead of a step.
  let src = filled;
  for (let pass = 0; pass < 2; pass++) {
    const dst = new Uint8Array(src.length);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const acc = [0, 0, 0]; let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ry = row + dy; if (ry < 0 || ry >= rows) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const o = (ry * cols + (((col + dx) % cols) + cols) % cols) * 3;
            acc[0] += src[o]; acc[1] += src[o + 1]; acc[2] += src[o + 2]; n++;
          }
        }
        const o = (row * cols + col) * 3;
        dst[o] = Math.round(acc[0] / n); dst[o + 1] = Math.round(acc[1] / n); dst[o + 2] = Math.round(acc[2] / n);
      }
    }
    src = dst;
  }
  const smooth = src;
  const sample = (lat, lon) => {
    const x = (lon + 180) / 0.5 - 0.5; const y = (lat + 90) / 0.5 - 0.5;
    const x0 = Math.floor(x); const y0 = Math.floor(y); const fx = x - x0; const fy = y - y0;
    const at = (xx, yy) => {
      const cx = ((xx % cols) + cols) % cols; const cy = Math.max(0, Math.min(rows - 1, yy));
      const o = (cy * cols + cx) * 3; return [smooth[o], smooth[o + 1], smooth[o + 2]];
    };
    const a = at(x0, y0); const b = at(x0 + 1, y0); const c = at(x0, y0 + 1); const d = at(x0 + 1, y0 + 1);
    return [0, 1, 2].map((k) => (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy);
  };
  return { sample };
};

// ---- masks from the vector layers, rasterised by sharp ----------------------------------------
const geoToSvgPaths = (features, filter = () => true) => {
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
const rasterMask = async (pathData) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><path d="${pathData}" fill="white" fill-rule="evenodd"/></svg>`;
  const { data } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = data[i * 4] > 127 ? 1 : 0;
  return mask;
};
const riverOverlay = async (features) => {
  const strokes = [];
  features.forEach((f) => {
    const rank = f.properties.scalerank ?? 12;
    if (rank > 8 || /lake/i.test(f.properties.featurecla || '')) return;
    const width = rank <= 3 ? 2.0 : rank <= 6 ? 1.2 : 0.7;
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
    lines.forEach((line) => {
      const d = line.map(([lon, lat], i) => `${i ? 'L' : 'M'}${(((lon + 180) / 360) * W).toFixed(1)} ${(((90 - lat) / 180) * H).toFixed(1)}`).join('');
      strokes.push(`<path d="${d}" stroke="rgb(96,156,214)" stroke-opacity="0.7" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    });
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${strokes.join('')}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
};

// ---- the render -------------------------------------------------------------------------------
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export const buildWorldRaster = async ({ log = console.log } = {}) => {
  const t0 = Date.now();
  const elevation = loadElevation();
  const climate = climateColorGrid();
  const landFc = readJson(path.join(RAW, 'ne', 'ne_50m_land.geojson'));
  const lakesFc = readJson(path.join(RAW, 'ne', 'ne_10m_lakes.geojson'));
  const glacierFc = readJson(path.join(RAW, 'ne', 'ne_10m_glaciated_areas.geojson'));
  const riversFc = readJson(path.join(RAW, 'ne', 'ne_10m_rivers_lake_centerlines.geojson'));
  const [land, lakes, glacier] = await Promise.all([
    rasterMask(geoToSvgPaths(landFc.features)),
    rasterMask(geoToSvgPaths(lakesFc.features, (f) => (f.properties.scalerank ?? 10) <= 5)),
    rasterMask(geoToSvgPaths(glacierFc.features))
  ]);
  log(`masks ready (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

  // Elevation sampled on the equirectangular grid once (bilinear in mercator space), so the
  // hillshade gradient works in pixel space.
  const elev = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180;
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * 360 - 180;
      elev[y * W + x] = elevation.sample(lat, lon);
    }
  }
  log(`elevation sampled (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

  const rgb = new Uint8Array(W * H * 3);
  const light = [-0.5, -0.6, 0.62]; // from the north-west, 38 degrees up (screen x right, y down)
  const kmPerPixelLat = (180 / H) * 111;
  for (let y = 0; y < H; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180;
    const kmPerPixelLon = Math.max(1, kmPerPixelLat * Math.cos((lat * Math.PI) / 180));
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const lon = ((x + 0.5) / W) * 360 - 180;
      const e = elev[i];
      const isLand = land[i] === 1; const isLake = lakes[i] === 1; const isIce = glacier[i] === 1 || lat < -84;
      // Hillshade from the gradient (metres per km, exaggerated).
      const ex = elev[y * W + ((x + 1) % W)] - elev[y * W + ((x - 1 + W) % W)];
      const ey = elev[Math.min(H - 1, y + 1) * W + x] - elev[Math.max(0, y - 1) * W + x];
      const gx = (ex / (2 * kmPerPixelLon * 1000)) * 14; const gy = (ey / (2 * kmPerPixelLat * 1000)) * 14;
      const nl = Math.hypot(gx, gy, 1);
      const nx = -gx / nl; const ny = -gy / nl; const nz = 1 / nl;
      const dot = nx * light[0] + ny * light[1] + nz * light[2];
      let shade = 0.62 + 0.5 * Math.max(0, dot);
      let color;
      if (isLand && !isLake) {
        if (isIce) {
          color = [232, 238, 244];
          shade = 0.8 + 0.3 * Math.max(0, dot);
        } else {
          color = climate.sample(lat, lon);
          const hyps = clamp01((e - 700) / 2400);
          color = mix(color, [152, 128, 102], hyps * 0.75);
          const rock = clamp01((e - 2600) / 1800);
          color = mix(color, [168, 160, 152], rock * 0.8);
          const snowLine = 5400 - Math.abs(lat) * 40;
          const snow = clamp01((e - snowLine) / 600);
          color = mix(color, [240, 243, 246], snow);
          // Low wet land a touch darker and greener, high dry plateaus paler.
          if (e < 50) color = mix(color, [color[0] * 0.92, color[1] * 0.98, color[2] * 0.9], 0.5);
        }
      } else if (isLake) {
        color = [58, 118, 170]; shade = 0.9 + 0.1 * Math.max(0, dot);
      } else {
        const depth = Math.max(0, -e);
        const shelf = clamp01(depth / 220);
        color = mix([92, 160, 205], [48, 104, 165], shelf);
        color = mix(color, [18, 42, 92], clamp01((depth - 220) / 3800));
        shade = 0.88 + 0.2 * Math.max(0, dot);
        if (lat < -62 && isIce) { color = [226, 234, 242]; shade = 0.95; }
      }
      const grain = 1 + (hash(x, y) - 0.5) * 0.05;
      const o = i * 3;
      rgb[o] = Math.max(0, Math.min(255, Math.round(color[0] * shade * grain)));
      rgb[o + 1] = Math.max(0, Math.min(255, Math.round(color[1] * shade * grain)));
      rgb[o + 2] = Math.max(0, Math.min(255, Math.round(color[2] * shade * grain)));
    }
  }
  log(`terrain rendered (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const rivers = await riverOverlay(riversFc.features);
  const image = sharp(Buffer.from(rgb.buffer), { raw: { width: W, height: H, channels: 3 } }).composite([{ input: rivers }]);
  const png = await image.png().toBuffer();
  mkdirSync(OUT, { recursive: true });
  await sharp(png).webp({ quality: 82 }).toFile(path.join(OUT, 'world-4096.webp'));
  await sharp(png).resize(2048, 1024, { kernel: 'lanczos3' }).webp({ quality: 80 }).toFile(path.join(OUT, 'world-2048.webp'));
  await sharp(png).resize(2048, 1024).png().toFile(path.join(RAW, 'world-preview.png'));
  log(`wrote public/map/world-4096.webp and world-2048.webp (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await buildWorldRaster();
