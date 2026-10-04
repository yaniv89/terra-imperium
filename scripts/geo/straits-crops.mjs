// scripts/geo/straits-crops.mjs
// Before/after crops of the hex grid around each strait in STRAIT_LINES (plans/math/straits.md).
// Land green, sea blue, lake light blue, cells that changed outlined in orange (opened) or red
// (closed), capitals as red dots, the strait line in yellow.
// One PNG per strait: the hex grid before | after on top, the realistic Earth raster (the
// equirectangular world-4096.webp) before | after below when both rasters are given.
// Run: node scripts/geo/straits-crops.mjs <before tiles.json> <after tiles.json> <out dir>
//        [<before world-4096.webp> <after world-4096.webp>]
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fromLatLon, buildLatLonIndex } from '../../src/data/geo/geodesic.js';
import { STRAIT_LINES } from './build-tiles.mjs';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const sharp = require('sharp');

const load = (file) => {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const centres = Array.from({ length: raw.count }, (_, i) => fromLatLon(raw.lat[i] / 1000, raw.lon[i] / 1000));
  return { raw, index: buildLatLonIndex(centres) };
};

const W = 360; const H = 300; const SPAN_LAT = 7;
const view = (line) => {
  const lats = line.map((p) => p[0]); const lons = line.map((p) => p[1]);
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2; const cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const spanLat = Math.max(SPAN_LAT, (Math.max(...lats) - Math.min(...lats)) * 1.6);
  const k = Math.cos((cLat * Math.PI) / 180);
  const spanLon = (spanLat * W) / H / Math.max(0.15, k);
  return { cLat, cLon, spanLat, spanLon };
};
const render = (grid, other, { line }) => {
  const { cLat, cLon, spanLat, spanLon } = view(line);
  const toPx = (lat, lon) => [((lon - cLon) / spanLon + 0.5) * W, (0.5 - (lat - cLat) / spanLat) * H];
  const png = new PNG({ width: W, height: H });
  const ids = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    ids[y * W + x] = grid.index.nearest(cLat + (0.5 - y / H) * spanLat, cLon + (x / W - 0.5) * spanLon);
  }
  const { raw } = grid;
  const lakeCode = raw.terrainNames.indexOf('lake');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = ids[y * W + x];
    let c = raw.land[id] ? [96, 150, 80] : raw.terrain[id] === lakeCode ? [120, 170, 220] : [40, 80, 150];
    const edge = (x + 1 < W && ids[y * W + x + 1] !== id) || (y + 1 < H && ids[(y + 1) * W + x] !== id);
    if (edge) c = c.map((v) => Math.round(v * 0.75));
    if (other && other.raw.land[id] !== raw.land[id] && edge) c = raw.land[id] ? [220, 40, 40] : [255, 150, 30];
    const o = (y * W + x) * 4; png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255;
  }
  const dot = (px, py, col, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = Math.round(px + dx); const y = Math.round(py + dy);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const o = (y * W + x) * 4; png.data[o] = col[0]; png.data[o + 1] = col[1]; png.data[o + 2] = col[2];
    }
  };
  for (let s = 0; s < line.length - 1; s++) {
    for (let t = 0; t <= 60; t++) {
      const [x, y] = toPx(line[s][0] + ((line[s + 1][0] - line[s][0]) * t) / 60, line[s][1] + ((line[s + 1][1] - line[s][1]) * t) / 60);
      dot(x, y, [250, 220, 40], 0);
    }
  }
  Object.values(raw.capitals).forEach((id) => { const [x, y] = toPx(raw.lat[id] / 1000, raw.lon[id] / 1000); dot(x, y, [220, 20, 20], 2); });
  return PNG.sync.write(png);
};
// The same window cut from an equirectangular raster (sharp keeps the decoded pixels).
const rasterCrop = async (raster, { line }) => {
  const { cLat, cLon, spanLat, spanLon } = view(line);
  const { width, height } = raster.info;
  const x0 = Math.round(((cLon - spanLon / 2 + 180) / 360) * width); const y0 = Math.round(((90 - (cLat + spanLat / 2)) / 180) * height);
  const w = Math.max(1, Math.round((spanLon / 360) * width)); const h = Math.max(1, Math.round((spanLat / 180) * height));
  return sharp(raster.data, { raw: raster.info }).extract({ left: Math.max(0, x0), top: Math.max(0, y0), width: w, height: h })
    .resize(W, H, { kernel: 'nearest', fit: 'fill' }).png().toBuffer();
};
const loadRaster = async (file) => { const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true }); return { data, info }; };

const [beforeFile, afterFile, outDir, rasterBeforeFile, rasterAfterFile] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const before = load(beforeFile);
const after = load(afterFile);
const rasters = rasterBeforeFile ? [await loadRaster(rasterBeforeFile), await loadRaster(rasterAfterFile)] : null;
const GAP = 6;
for (const s of STRAIT_LINES) {
  const slug = s.name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  const tiles = [render(before, after, s), render(after, before, s)];
  if (rasters) tiles.push(await rasterCrop(rasters[0], s), await rasterCrop(rasters[1], s));
  const rows = rasters ? 2 : 1;
  await sharp({ create: { width: W * 2 + GAP, height: H * rows + GAP * (rows - 1), channels: 3, background: '#ffffff' } })
    .composite(tiles.map((input, k) => ({ input, left: (k % 2) * (W + GAP), top: Math.floor(k / 2) * (H + GAP) })))
    .png().toFile(path.join(outDir, `${slug}.png`));
}
console.log(`wrote ${STRAIT_LINES.length} crops to ${outDir}`);
