// src/worldgen/painter.js
// The painted look for a generated world, a first CPU version (plans/MAP-VARIATIONS-PLAN.md 5.1 to
// 5.4, phase MV4): the realistic Earth style of scripts/geo/build-world-raster.mjs (Köppen colours,
// hypsometric tints, rock and the snow line, hillshade from the elevation gradient, bathymetry,
// lakes, rivers, a little grain) painted from the generated tile columns into the equirectangular
// base picture that the flat map, the globe, the minimap and the close view ground already draw
// (worldRaster.js). It covers levels 0 to 3 of the pyramid (a 4096 picture is level 3); deeper
// zooms show it magnified until the GPU renderer of MV4 draws levels 4 to 6 and the land cover.
//
// Per pixel: the tile under it by a greedy walk over the grid's neighbours (cheap, no index), then
// a smooth blend of that tile and its six neighbours (Gaussian weights by angle): land share,
// elevation and climate colour, so the coast follows the hexes with rounded corners and colours
// change softly between tiles; detail noise scaled by the tile's roughness for the hillshade.
// Visual only: floats and Math.sin are fine here, nothing the rules read comes from this.
import { CLIMATE_COLOR, DEFAULT_LAND } from '../data/geo/rasterLook';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// Smooth value noise in pixel space (a few px a cell), for the relief texture.
const vnoise = (x, y, cell) => {
  const fx = x / cell; const fy = y / cell;
  const x0 = Math.floor(fx); const y0 = Math.floor(fy);
  const sx = fx - x0; const sy = fy - y0;
  const u = sx * sx * (3 - 2 * sx); const v = sy * sy * (3 - 2 * sy);
  const a = hash(x0, y0); const b = hash(x0 + 1, y0); const c = hash(x0, y0 + 1); const d = hash(x0 + 1, y0 + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v - 0.5;
};

/**
 * RGBA (Uint8ClampedArray, W x H, equirectangular, north up, longitude -180 at x = 0) of the
 * generated world in `tiles` (a decorated grid). `onProgress(fraction)` per row band.
 */
export const paintWorld = (tiles, W, H, { onProgress = () => {} } = {}) => {
  const n = tiles.count;
  const C = tiles.centres; const nb = tiles.neighbors;
  const T = tiles.terrainNames; const F = tiles.featureNames;
  const lakeCode = T.indexOf('lake'); const snowCode = T.indexOf('snow'); const iceCode = F.indexOf('ice');
  // Per tile: paint elevation, land (0, 1; lakes count as water with their own colour), colour.
  const elev = new Float32Array(n); const landF = new Float32Array(n); const lakeF = new Float32Array(n);
  const ice = new Uint8Array(n); const rough = new Float32Array(n);
  const col = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const land = tiles.land[i] === 1 && tiles.terrain[i] !== lakeCode;
    landF[i] = land ? 1 : 0; lakeF[i] = tiles.terrain[i] === lakeCode ? 1 : 0;
    elev[i] = land ? Math.max(tiles.elevation[i], 2) : Math.min(tiles.elevation[i], -80);
    ice[i] = tiles.feature[i] === iceCode || tiles.terrain[i] === snowCode ? 1 : 0;
    rough[i] = tiles.roughness ? tiles.roughness[i] : 50;
    const k = tiles.climate[i] >= 0 ? tiles.climateNames[tiles.climate[i]] : null;
    const c = (k && CLIMATE_COLOR[k]) || DEFAULT_LAND;
    col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2];
  }
  // Sea tiles take the colour of a land neighbour (no grey bleed along the coast).
  for (let i = 0; i < n; i++) {
    if (landF[i]) continue;
    const j = nb[i].find((x) => landF[x]);
    if (j != null) { col[3 * i] = col[3 * j]; col[3 * i + 1] = col[3 * j + 1]; col[3 * i + 2] = col[3 * j + 2]; }
  }
  const sinLat = new Float64Array(H); const cosLat = new Float64Array(H);
  for (let y = 0; y < H; y++) { const la = (90 - ((y + 0.5) / H) * 180) * (Math.PI / 180); sinLat[y] = Math.sin(la); cosLat[y] = Math.cos(la); }
  const sinLon = new Float64Array(W); const cosLon = new Float64Array(W);
  for (let x = 0; x < W; x++) { const lo = (((x + 0.5) / W) * 360 - 180) * (Math.PI / 180); sinLon[x] = Math.sin(lo); cosLon[x] = Math.cos(lo); }
  const S2 = 0.0095 * 0.0095; // Gaussian width (radians squared): a little under the hex spacing
  const pe = new Float32Array(W * H); const pl = new Float32Array(W * H); const plake = new Float32Array(W * H);
  const pc = new Float32Array(3 * W * H); const pice = new Float32Array(W * H);
  const pxScale = W / 2048;
  let cur = tiles.nearest(90, -180);
  for (let y = 0; y < H; y++) {
    let rowStart = cur;
    for (let x = 0; x < W; x++) {
      const px = cosLat[y] * cosLon[x]; const py = cosLat[y] * sinLon[x]; const pz = sinLat[y];
      // Greedy walk to the nearest centre.
      let c = x === 0 ? rowStart : cur;
      let best = C[c][0] * px + C[c][1] * py + C[c][2] * pz;
      for (let moved = true; moved;) {
        moved = false;
        for (const j of nb[c]) { const d = C[j][0] * px + C[j][1] * py + C[j][2] * pz; if (d > best) { best = d; c = j; moved = true; } }
      }
      cur = c;
      if (x === 0) rowStart = c;
      let ws = 0; let e = 0; let l = 0; let lk = 0; let r = 0; let g = 0; let b = 0; let ic = 0; let ro = 0;
      const add = (j) => {
        const d = C[j][0] * px + C[j][1] * py + C[j][2] * pz;
        const w = Math.exp(-(2 * (1 - d)) / S2);
        ws += w; e += w * elev[j]; l += w * landF[j]; lk += w * lakeF[j]; ic += w * ice[j]; ro += w * rough[j];
        r += w * col[3 * j]; g += w * col[3 * j + 1]; b += w * col[3 * j + 2];
      };
      add(c); for (const j of nb[c]) add(j);
      const i = y * W + x;
      const land = l / ws;
      pl[i] = land; plake[i] = lk / ws; pice[i] = ic / ws;
      const detail = (vnoise(x, y, 6 * pxScale) * 0.7 + vnoise(x + 977, y + 331, 2.5 * pxScale) * 0.3) * (ro / ws) * 3.2;
      pe[i] = e / ws + (land > 0.5 ? detail : detail * 0.15);
      pc[3 * i] = r / ws; pc[3 * i + 1] = g / ws; pc[3 * i + 2] = b / ws;
    }
    if ((y & 63) === 0) onProgress(y / H * 0.8);
  }
  cur = tiles.nearest(0, 0);
  // Shade.
  const out = new Uint8ClampedArray(W * H * 4);
  const light = [-0.5, -0.6, 0.62];
  const kmPerPixelLat = (180 / H) * 111;
  for (let y = 0; y < H; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180;
    const kmLon = Math.max(1, kmPerPixelLat * cosLat[y]);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const e = pe[i];
      const ex = pe[y * W + ((x + 1) % W)] - pe[y * W + ((x - 1 + W) % W)];
      const ey = pe[Math.min(H - 1, y + 1) * W + x] - pe[Math.max(0, y - 1) * W + x];
      const gx = (ex / (2 * kmLon * 1000)) * 14; const gy = (ey / (2 * kmPerPixelLat * 1000)) * 14;
      const nl = Math.sqrt(gx * gx + gy * gy + 1);
      const dot = (-gx / nl) * light[0] + (-gy / nl) * light[1] + (1 / nl) * light[2];
      let shade = 0.62 + 0.5 * Math.max(0, dot);
      let color;
      const isLand = pl[i] > 0.5; const isLake = !isLand && plake[i] > pl[i] * 0.5 && plake[i] > 0.3;
      if (isLand) {
        if (pice[i] > 0.5) { color = [232, 238, 244]; shade = 0.8 + 0.3 * Math.max(0, dot); } else {
          color = [pc[3 * i], pc[3 * i + 1], pc[3 * i + 2]];
          color = mix(color, [152, 128, 102], clamp01((e - 700) / 2400) * 0.75);
          color = mix(color, [168, 160, 152], clamp01((e - 2600) / 1800) * 0.8);
          color = mix(color, [240, 243, 246], clamp01((e - (5400 - Math.abs(lat) * 40)) / 600));
          if (e < 50) color = mix(color, [color[0] * 0.92, color[1] * 0.98, color[2] * 0.9], 0.5);
        }
      } else if (isLake) {
        color = [58, 118, 170]; shade = 0.9 + 0.1 * Math.max(0, dot);
      } else {
        const depth = Math.max(0, -e);
        color = mix([92, 160, 205], [48, 104, 165], clamp01(depth / 220));
        color = mix(color, [18, 42, 92], clamp01((depth - 220) / 3800));
        shade = 0.88 + 0.2 * Math.max(0, dot);
        if (pice[i] > 0.5) { color = [226, 234, 242]; shade = 0.95; }
      }
      const grain = 1 + (hash(x, y) - 0.5) * 0.05;
      const o = i * 4;
      out[o] = color[0] * shade * grain; out[o + 1] = color[1] * shade * grain; out[o + 2] = color[2] * shade * grain; out[o + 3] = 255;
    }
  }
  onProgress(0.9);
  // Rivers along the hex edges (corner to corner), wider downstream, on land only.
  const corner = (a, b, c) => { const v = [C[a][0] + C[b][0] + C[c][0], C[a][1] + C[b][1] + C[c][1], C[a][2] + C[b][2] + C[c][2]]; const m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return [v[0] / m, v[1] / m, v[2] / m]; };
  const toPx = (v) => { const lat = Math.asin(v[2]) * (180 / Math.PI); const lon = Math.atan2(v[1], v[0]) * (180 / Math.PI); return [((lon + 180) / 360) * W, ((90 - lat) / 180) * H]; };
  const plot = (x, y, a) => {
    const xi = ((Math.round(x) % W) + W) % W; const yi = Math.round(y);
    if (yi < 0 || yi >= H) return;
    const i = yi * W + xi;
    if (pl[i] < 0.5) return;
    const o = i * 4;
    out[o] = out[o] + (58 - out[o]) * a; out[o + 1] = out[o + 1] + (118 - out[o + 1]) * a; out[o + 2] = out[o + 2] + (170 - out[o + 2]) * a;
  };
  // (not on small pictures, where a hex is a pixel or two and the lines would cover the land)
  for (let a = 0; W >= 1024 && a < n; a++) {
    if (!tiles.rivers[a]) continue;
    const ns = nb[a]; const m = ns.length;
    for (let k = 0; k < m; k++) {
      const b = ns[k];
      if (b < a || !(tiles.rivers[a] & (1 << k))) continue;
      const size = tiles.riverSizeBetween(a, b);
      const p0 = toPx(corner(a, ns[(k + m - 1) % m], b)); const p1 = toPx(corner(a, b, ns[(k + 1) % m]));
      if (Math.abs(p1[0] - p0[0]) > W / 2) continue; // across the date line: skip the stub
      const width = (0.35 + size * 0.35) * pxScale;
      const steps = Math.max(2, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 2));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps; const x = p0[0] + (p1[0] - p0[0]) * t; const y = p0[1] + (p1[1] - p0[1]) * t;
        plot(x, y, Math.min(1, 0.55 + width * 0.4));
        if (width > 0.7) { plot(x + 0.5, y, 0.5); plot(x, y + 0.5, 0.5); }
      }
    }
  }
  onProgress(1);
  return out;
};
