// scripts/geo/build-raster-detail.mjs
// Phase F, raster half of the data (plans/peoples-and-world-setup.md 6b Q2 and Q3; master plan
// 5.4): finer pictures of the realistic Earth for the close view, and a land cover channel the
// close-view shader can read. Adds files next to the existing pyramid; levels 0 to 5 are untouched.
//
//   public/map/tiles/6/{x}-{y}.webp   level 6 (32,768 x 16,384, about 1.2 km a pixel), LAND TILES
//                                     ONLY (a tile is stored when it holds a land pixel; the open
//                                     sea stays at level 5). Same look as the pyramid
//                                     (build-raster-pyramid.mjs makeShadePixel), with the
//                                     hillshade from zoom-7 elevation (about 1.2 km) instead of
//                                     zoom 5, so ridges and valleys are real at close zoom.
//   public/map/cover/{z}/{x}-{y}.png  land cover classes, one byte a pixel (grey PNG, the value is
//                                     the class index in LAND_COVER), for levels 5 (every tile with
//                                     land) and 6 (the same tiles as the pictures).
//   public/map/tiles/detail.json      the manifest: which tiles exist per level, the classes, the
//                                     sources. src/data/geo/rasterDetail.js reads it.
//
// Land cover is DERIVED, not surveyed: Köppen climate per pixel, the game's own hex features
// (forest, jungle, marsh, oasis, floodplain: so a forest hex shows trees), the Natural Earth
// glaciers and a snow line and tree line from the elevation. ESA WorldCover (10 m) is the planned
// upgrade (6b Q2); it would replace classifyCover and nothing else.
//
// Inputs: scripts/geo/.raw/terrarium7 (npm run fetch:tiles -- --detail), terrarium4,
// ne/ne_10m_glaciated_areas, ne/ne_10m_rivers_lake_centerlines, src/data/geo/hexLand.json,
// src/data/geo/tiles.json, koppen-climate-lookup.
// Run: node scripts/geo/build-raster-detail.mjs [--cover-only]   (about 15 minutes). Deterministic.
import { readFileSync, mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { makeShadePixel, clampToCoast } from './build-raster-pyramid.mjs';
import { climateColorGrid } from './build-world-raster.mjs';
import { loadElevation } from './build-tiles.mjs';
import { loadRiverLines, riverSvg, RIVER_MAX_RANK } from './river-paint.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { PNG } = require('pngjs');
const KoppenModule = require('koppen-climate-lookup');
const KoppenLookup = KoppenModule.default || KoppenModule.KoppenLookup || KoppenModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '.raw');
const ROOT = path.join(__dirname, '../..');
const TILES_OUT = path.join(ROOT, 'public/map/tiles');
const COVER_OUT = path.join(ROOT, 'public/map/cover');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const log = (...a) => console.log(...a);

export const TILE = 256;
export const DETAIL_Z = 6;
export const COVER_LEVELS = [5, 6];
export const ELEVATION_Z = 7;
// Polar land (Antarctica, the Greenland and Arctic ice) keeps the zoom-4 elevation: mercator tiles
// crowd there, and an ice sheet gains little from finer relief.
export const DETAIL_MAX_LAT = 72;
// Land cover classes (the byte in public/map/cover). Order is the contract with rasterDetail.js.
export const LAND_COVER = ['water', 'ice', 'rock', 'desert', 'steppe', 'grassland', 'forest', 'rainforest', 'tundra', 'wetland', 'irrigated'];
const C = Object.fromEntries(LAND_COVER.map((n, i) => [n, i]));
// Level 6 keeps the pyramid's hillshade rules with a little less exaggeration: slopes measured
// over 1.2 km pixels are steeper than over 2.4 km ones, so 9 would look harsher than level 5.
export const DETAIL_RELIEF = 6.5;

const levelSize = (z) => ({ W: TILE * 2 ** (z + 1), H: TILE * 2 ** z, cols: 2 ** (z + 1), rows: 2 ** z });

// ---- which zoom-7 elevation tiles the game's land needs (fetch-tiles-raw.mjs --detail) ---------
const mercTile = (lat, lon, z) => {
  const n = 2 ** z; const la = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * n); const y = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n);
  return [((x % n) + n) % n, Math.max(0, Math.min(n - 1, y))];
};
/** [x, y] of every zoom-7 terrarium tile under a land hex (its centre, corners and edge midpoints). */
export const detailElevationTiles = (tiles) => {
  const want = new Set();
  for (let id = 0; id < tiles.count; id++) {
    if (tiles.land[id] !== 1 || Math.abs(tiles.lat[id] / 1000) > DETAIL_MAX_LAT) continue;
    const poly = tiles.polygonOf(id);
    const c = tiles.latLonOf(id);
    const pts = [c, ...poly, ...poly.map((p, k) => { const q = poly[(k + 1) % poly.length]; return { lat: (p.lat + q.lat) / 2, lon: Math.abs(p.lon - q.lon) > 180 ? p.lon : (p.lon + q.lon) / 2 }; })];
    pts.forEach((p) => { const [x, y] = mercTile(p.lat, p.lon, ELEVATION_Z); want.add(`${x}-${y}`); });
  }
  return [...want].map((k) => k.split('-').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
};

// ---- elevation: zoom 7 where fetched, zoom 4 elsewhere (the open sea) --------------------------
const loadElevation7 = (fallback) => {
  const N = 2 ** ELEVATION_Z; const SIZE = N * TILE;
  const cache = new Map(); // key -> Float32Array | null (missing)
  const order = [];
  const tileData = (tx, ty) => {
    const key = ty * N + tx;
    if (cache.has(key)) return cache.get(key);
    const file = path.join(RAW, `terrarium${ELEVATION_Z}`, `${tx}-${ty}.png`);
    let data = null;
    if (existsSync(file)) {
      const png = PNG.sync.read(readFileSync(file));
      data = new Float32Array(TILE * TILE);
      for (let i = 0; i < TILE * TILE; i++) data[i] = png.data[i * 4] * 256 + png.data[i * 4 + 1] + png.data[i * 4 + 2] / 256 - 32768;
    }
    cache.set(key, data); order.push(key);
    if (order.length > 1400) cache.delete(order.shift());
    return data;
  };
  const px = (xi, yi) => {
    const x = ((xi % SIZE) + SIZE) % SIZE; const y = Math.max(0, Math.min(SIZE - 1, yi));
    const d = tileData(x >> 8, y >> 8);
    return d ? d[(y & 255) * TILE + (x & 255)] : NaN;
  };
  let fine = 0; let coarse = 0;
  const sample = (lat, lon) => {
    const la = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
    const x = ((lon + 180) / 360) * SIZE - 0.5;
    const y = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * SIZE - 0.5;
    const x0 = Math.floor(x); const y0 = Math.floor(y); const fx = x - x0; const fy = y - y0;
    const a = px(x0, y0); const b = px(x0 + 1, y0); const c = px(x0, y0 + 1); const d = px(x0 + 1, y0 + 1);
    if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) { coarse++; return fallback.sample(lat, lon); }
    fine++;
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
  return { sample, stats: () => ({ fine, coarse }) };
};

// ---- Köppen class per 0.5 degree cell (sea cells filled from the nearest land cell in the row) --
// A smooth deterministic warp of the lookup point (two octaves of value noise, about 14 km and
// 4 km): the hex features and the 0.5 degree climate cells then end in natural wavy edges instead
// of hexagons and squares. Only the cover's lookups are warped, never the land or the elevation.
const hash2 = (x, y, s) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const valueNoise = (x, y, s) => {
  const x0 = Math.floor(x); const y0 = Math.floor(y); const fx = x - x0; const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, s); const b = hash2(x0 + 1, y0, s); const c = hash2(x0, y0 + 1, s); const d = hash2(x0 + 1, y0 + 1, s);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy - 0.5;
};
export const COVER_WARP = [{ cell: 0.25, amp: 0.25 }, { cell: 0.07, amp: 0.07 }]; // degrees
const warp = (lat, lon) => {
  let dLat = 0; let dLon = 0;
  COVER_WARP.forEach(({ cell, amp }, k) => { dLat += valueNoise(lon / cell, lat / cell, 2 * k + 1) * amp; dLon += valueNoise(lon / cell, lat / cell, 2 * k + 2) * amp; });
  return [Math.max(-89.9, Math.min(89.9, lat + dLat)), lon + dLon / Math.max(0.2, Math.cos((lat * Math.PI) / 180))];
};

const koppenGrid = () => {
  const lookup = KoppenLookup.getInstance();
  const cols = 720; const rows = 360;
  const grid = new Array(cols * rows).fill(null);
  const cells = lookup.grid instanceof Map ? [...lookup.grid.values()] : Object.values(lookup.grid);
  cells.forEach((cell) => { grid[Math.floor((cell.latitude + 90) / 0.5) * cols + Math.floor((cell.longitude + 180) / 0.5)] = cell.koppenClass; });
  for (let row = 0; row < rows; row++) {
    let last = null;
    for (let col = 0; col < cols; col++) { const v = grid[row * cols + col]; if (v) last = v; else if (last) grid[row * cols + col] = `~${last}`; }
    let next = null;
    for (let col = cols - 1; col >= 0; col--) { const v = grid[row * cols + col]; if (v && v[0] !== '~') next = v; else if (!v && next) grid[row * cols + col] = next; }
  }
  return (lat, lon) => {
    const col = ((Math.floor((lon + 180) / 0.5) % cols) + cols) % cols; const row = Math.max(0, Math.min(rows - 1, Math.floor((lat + 90) / 0.5)));
    const v = grid[row * cols + col];
    return v ? v.replace('~', '') : null;
  };
};

/** One pixel's land cover class (LAND_COVER index). Pure; the rules in the header. */
export const classifyCover = ({ land, ice, elevation, lat, koppen, feature }) => {
  if (!land) return C.water;
  const alat = Math.abs(lat);
  if (ice || koppen === 'EF' || elevation > 5400 - alat * 40) return C.ice;
  const treeLine = 3900 - Math.max(0, alat - 25) * 70;
  if (elevation > treeLine) return C.rock;
  if (feature === 'marsh') return C.wetland;
  if (feature === 'oasis' || feature === 'floodplain') return C.irrigated;
  if (feature === 'jungle') return C.rainforest;
  if (feature === 'forest') return C.forest;
  if (!koppen) return C.grassland;
  if (koppen === 'ET') return C.tundra;
  if (koppen.startsWith('BW')) return C.desert;
  if (koppen.startsWith('BS') || koppen === 'Csa' || koppen === 'Csb') return C.steppe;
  if (koppen === 'Af' || koppen === 'Am') return C.rainforest;
  if (/^D.[cd]$/.test(koppen)) return C.forest;
  return C.grassland;
};

// ---- the nearest hex for a pixel: a greedy walk from a hint (exact on the sphere's Voronoi) -----
const nearestWalker = (tiles) => {
  const { centres, neighbors } = tiles;
  return (hint, lat, lon) => {
    const la = (lat * Math.PI) / 180; const lo = (lon * Math.PI) / 180;
    const v = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    let best = hint >= 0 ? hint : tiles.nearest(lat, lon, 1);
    let bd = centres[best][0] * v[0] + centres[best][1] * v[1] + centres[best][2] * v[2];
    for (;;) {
      let moved = false;
      for (const n of neighbors[best]) {
        const d = centres[n][0] * v[0] + centres[n][1] * v[1] + centres[n][2] * v[2];
        if (d > bd) { bd = d; best = n; moved = true; }
      }
      if (!moved) return best;
    }
  };
};

// ---- vector layers as SVG for one tile (rings whose box meets the tile only) -------------------
const ringsOf = (features) => {
  const rings = [];
  features.forEach((f) => {
    const g = f.geometry; if (!g) return;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    polys.forEach((p) => p.forEach((ring) => {
      let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
      ring.forEach(([x, y]) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; });
      rings.push({ ring, minX, minY, maxX, maxY });
    }));
  });
  return rings;
};
const boxOfTile = (z, tx, ty, padPx = 2) => {
  const { W, H } = levelSize(z);
  return { lon0: ((tx * TILE - padPx) / W) * 360 - 180, lon1: (((tx + 1) * TILE + padPx) / W) * 360 - 180, lat1: 90 - ((ty * TILE - padPx) / H) * 180, lat0: 90 - (((ty + 1) * TILE + padPx) / H) * 180 };
};
const meets = (b, r) => r.maxX >= b.lon0 && r.minX <= b.lon1 && r.maxY >= b.lat0 && r.minY <= b.lat1;
const svgPathsFor = (rings, z, box) => {
  const { W, H } = levelSize(z);
  return rings.filter((r) => meets(box, r)).map(({ ring }) => ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${(((lon + 180) / 360) * W).toFixed(1)} ${(((90 - lat) / 180) * H).toFixed(1)}`).join('') + 'Z').join('');
};
const maskFor = async (pathData, z, tx, y0, rows) => {
  const mask = new Uint8Array(TILE * rows);
  if (!pathData) return mask;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${rows}" viewBox="${tx * TILE} ${y0} ${TILE} ${rows}"><path d="${pathData}" fill="white" fill-rule="evenodd"/></svg>`;
  const { data } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < TILE * rows; i++) mask[i] = data[i * 4] > 127 ? 1 : 0;
  return mask;
};
const riverOverlay = async (lines, z, tx, ty, box) => {
  const { W, H } = levelSize(z);
  const strokes = riverSvg(lines, { W, H, kmPx: (180 / H) * 111, minPx: 1, keep: (l) => meets(box, l) });
  if (!strokes) return null;
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="${tx * TILE} ${ty * TILE} ${TILE} ${TILE}">${strokes}</svg>`)).raw().toBuffer({ resolveWithObject: true });
};

// ---- one tile: colour (optional) and land cover ------------------------------------------------
const renderTile = async (ctx, z, tx, ty, { colour, writeCover = true }) => {
  const { W, H } = levelSize(z);
  const box = boxOfTile(z, tx, ty);
  const y0 = ty * TILE;
  const landExt = await maskFor(svgPathsFor(ctx.landRings, z, box), z, tx, y0 - 1, TILE + 2);
  const land = landExt.subarray(TILE, TILE * (TILE + 1));
  if (!land.some((v) => v)) return null; // open sea: level 5 covers it
  const ice = await maskFor(svgPathsFor(ctx.iceRings, z, box), z, tx, y0, TILE);
  // elevation for the tile and a one-pixel border (the hillshade gradient needs it)
  const EW = TILE + 2;
  const er = new Float32Array(EW * (TILE + 2));
  for (let r = -1; r <= TILE; r++) {
    const lat = 90 - ((Math.max(0, Math.min(H - 1, y0 + r)) + 0.5) / H) * 180;
    for (let c = -1; c <= TILE; c++) {
      const lon = ((((tx * TILE + c) % W) + W) % W + 0.5) / W * 360 - 180;
      const inLand = r >= 0 && r < TILE && c >= 0 && c < TILE ? land[r * TILE + c] === 1 : landExt[(r + 1) * TILE + Math.max(0, Math.min(TILE - 1, c))] === 1;
      er[(r + 1) * EW + (c + 1)] = clampToCoast(ctx.elevation.sample(lat, lon), inLand);
    }
  }
  const cover = new Uint8Array(TILE * TILE);
  const rgb = colour ? new Uint8Array(TILE * TILE * 3) : null;
  let hint = ctx.rowHint;
  for (let r = 0; r < TILE; r++) {
    const lat = 90 - ((y0 + r + 0.5) / H) * 180;
    let rowHint = hint;
    for (let c = 0; c < TILE; c++) {
      const i = r * TILE + c; const lon = ((tx * TILE + c + 0.5) / W) * 360 - 180;
      const e = er[(r + 1) * EW + c + 1];
      let feature = 'none';
      let koppen = null;
      if (land[i]) {
        const [wl, wo] = warp(lat, lon);
        hint = ctx.nearest(hint, wl, wo); if (c === 0) rowHint = hint;
        // a warped point that lands on a water hex keeps the land's own class rules
        feature = ctx.tiles.land[hint] === 1 ? ctx.tiles.featureOf(hint) : 'none';
        koppen = ctx.koppen(wl, wo);
      }
      cover[i] = classifyCover({ land: land[i] === 1, ice: ice[i] === 1, elevation: e, lat, koppen, feature });
      if (rgb) {
        const k = ctx.shade({ climate: ctx.climate, isLand: land[i] === 1, isLake: false, isIce: ice[i] === 1 }, tx * TILE + c, y0 + r,
          e, er[(r + 1) * EW + c], er[(r + 1) * EW + c + 2], er[r * EW + c + 1], er[(r + 2) * EW + c + 1]);
        rgb[i * 3] = Math.max(0, Math.min(255, Math.round(k[0]))); rgb[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(k[1]))); rgb[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(k[2])));
      }
    }
    hint = rowHint;
  }
  ctx.rowHint = hint;
  const coverFile = path.join(COVER_OUT, String(z), `${tx}-${ty}.png`);
  if (writeCover) await sharp(Buffer.from(cover.buffer), { raw: { width: TILE, height: TILE, channels: 1 } }).png({ compressionLevel: 9, palette: false }).toFile(coverFile);
  if (rgb) {
    const rivers = await riverOverlay(ctx.riverLines, z, tx, ty, box);
    if (rivers) {
      // rivers on land only, blended by their alpha
      const { data } = rivers;
      for (let i = 0; i < TILE * TILE; i++) {
        const a = land[i] ? data[i * 4 + 3] / 255 : 0;
        if (!a) continue;
        for (let k = 0; k < 3; k++) rgb[i * 3 + k] = Math.round(rgb[i * 3 + k] * (1 - a) + data[i * 4 + k] * a);
      }
    }
    await sharp(Buffer.from(rgb.buffer), { raw: { width: TILE, height: TILE, channels: 3 } }).webp({ quality: 80 }).toFile(path.join(TILES_OUT, String(z), `${tx}-${ty}.webp`));
  }
  return true;
};

export const buildRasterDetail = async ({ coverOnly = false, box = null } = {}) => {
  const t0 = Date.now();
  // One area in place: --box lon0,lat0,lon1,lat1 re-renders only the level 6 pictures meeting it
  // (rivers and relief) and leaves everything else alone: the other tiles, the land cover and
  // the manifest (the tile set does not change). Needs the zoom-7 elevation of that area
  // (node scripts/geo/fetch-tiles-raw.mjs --detail --box lon0,lat0,lon1,lat1).
  const only = box ? { minX: box[0], minY: box[1], maxX: box[2], maxY: box[3] } : null;
  const { getTiles } = await import('../../src/data/geo/tiles.js');
  const tiles = getTiles();
  const coarse = loadElevation();
  const ctx = {
    tiles,
    elevation: coverOnly ? coarse : loadElevation7(coarse),
    coarse,
    climate: climateColorGrid(),
    koppen: koppenGrid(),
    nearest: nearestWalker(tiles),
    rowHint: -1,
    landRings: ringsOf(readJson(path.join(ROOT, 'src/data/geo/hexLand.json')).features),
    iceRings: ringsOf(readJson(path.join(RAW, 'ne', 'ne_10m_glaciated_areas.geojson')).features),
    riverLines: loadRiverLines(RAW, { maxRank: RIVER_MAX_RANK[DETAIL_Z] })
  };
  log(`sources ready (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const manifest = { version: 1, tile: TILE, detail: {}, cover: { classes: LAND_COVER, levels: {} }, sources: {
    elevation: `Mapzen/Tilezen terrarium zoom ${ELEVATION_Z} under land, zoom 4 at sea (see CREDITS.md)`,
    land: 'src/data/geo/hexLand.json (the hex coast)', ice: 'Natural Earth 1:10M glaciated areas', rivers: 'Natural Earth 1:10M rivers',
    cover: 'derived: Köppen climate (koppen-climate-lookup), the game hex features, Natural Earth glaciers, elevation snow and tree lines'
  } };
  if (!only) rmSync(COVER_OUT, { recursive: true, force: true });
  for (const z of COVER_LEVELS) {
    if (only && z !== DETAIL_Z) continue;
    const colour = z === DETAIL_Z && !coverOnly;
    // level 5 cover uses the coarse elevation: its classes only need the snow and tree lines
    const saved = ctx.elevation; if (z < DETAIL_Z) ctx.elevation = coarse;
    ctx.shade = makeShadePixel(levelSize(z).W, levelSize(z).H, DETAIL_RELIEF);
    mkdirSync(path.join(COVER_OUT, String(z)), { recursive: true });
    if (colour && !only) { rmSync(path.join(TILES_OUT, String(z)), { recursive: true, force: true }); mkdirSync(path.join(TILES_OUT, String(z)), { recursive: true }); }
    const { cols, rows } = levelSize(z);
    const kept = [];
    for (let ty = 0; ty < rows; ty++) {
      ctx.rowHint = -1;
      for (let tx = 0; tx < cols; tx++) {
        const box = boxOfTile(z, tx, ty);
        if (!ctx.landRings.some((r) => meets(box, r))) continue;
        if (only && !meets(box, only)) continue;
        // level 6 past DETAIL_MAX_LAT would only repeat level 5 (same coarse elevation): skip it
        if (z === DETAIL_Z && (box.lat0 > DETAIL_MAX_LAT || box.lat1 < -DETAIL_MAX_LAT)) continue;
        if (await renderTile(ctx, z, tx, ty, { colour, writeCover: !only })) kept.push(`${tx}-${ty}`);
      }
      if (ty % 8 === 7) log(`level ${z}: row ${ty + 1}/${rows}, ${kept.length} tiles (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ctx.elevation = saved;
    manifest.cover.levels[z] = kept;
    if (colour) manifest.detail[z] = kept;
  }
  if (coverOnly && existsSync(path.join(TILES_OUT, 'detail.json'))) manifest.detail = readJson(path.join(TILES_OUT, 'detail.json')).detail;
  if (!only) writeFileSync(path.join(TILES_OUT, 'detail.json'), JSON.stringify(manifest));
  if (ctx.elevation.stats) log(`elevation samples: ${JSON.stringify(ctx.elevation.stats())}`);
  log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const boxArg = process.argv.indexOf('--box');
if (isMain) await buildRasterDetail({ coverOnly: process.argv.includes('--cover-only'), box: boxArg > 0 ? process.argv[boxArg + 1].split(',').map(Number) : null });
