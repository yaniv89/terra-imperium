// src/worldgen/v1/generate.js
// The world generator, version 1 (plans/MAP-VARIATIONS-PLAN.md section 4, phase MV3): the global
// pass that turns (seed, params) into the per-tile columns the engine reads, on the same
// frequency-100 grid as Earth (same lat, lon and neighbours; only the columns change).
//
// Steps (4.3): plates as a warped Voronoi on the sphere; elevation per cell from the plate base,
// boundary uplift (convergent belts, coastal ranges, island arcs, rifts and ridges, by graph
// distance to the plate edge) and integer noise, with 5 x 5 samples per cell for the mean, the
// maximum and the roughness (like build-tiles.mjs); the sea level as the quantile that gives the
// land share exactly; climate (temperature by latitude, lapse rate and continentality, moisture
// by an upwind walk over the prevailing wind band with orographic rain and rain shadow, a
// Köppen-like class); drainage on the hex corners (priority-flood depression filling, lakes,
// flow accumulation, rivers along hex edges with three size classes); classify() as on Earth;
// ranges, ridges and passes (terrainColumns.js); the resource scatter salted by the seed; names.
//
// Determinism (4.4): noise is integer (noise.js); everything else uses only + - * / and
// Math.sqrt (exactly rounded on every engine), integer comparisons and id tie-breaks. Positions
// come from fromLatLonExact. No Math.sin, cos, exp, log, pow or atan2 anywhere in this file.
// Frozen: any change that alters the output bytes is a new generator version.
import { ONE, hash1, hashUnit, makeField } from './noise';
import { fromLatLonExact } from '../../data/geo/geodesic';
import { sinCosDeg } from '../../utils/exactMath';
import { TERRAIN, RELIEF, FEATURE, classify, scatterResource } from '../../data/geo/classifyTile';
import { buildTerrainColumns } from '../../data/geo/terrainColumns';
import { createRng } from '../../utils/rng';
import { rangeName, riverName, placeName, PHONOLOGIES } from '../names';
import { normalizeParams, worldHashOf } from '../spec';
import { pickStartSites, MAX_MAJORS } from './startSites';

export const VERSION = 1;
export const CLIMATE_NAMES = ['Af', 'Am', 'As', 'Aw', 'BSh', 'BSk', 'BWh', 'BWk', 'Cfa', 'Cfb', 'Cfc', 'Csa', 'Csb', 'Csc', 'Cwa', 'Cwb', 'Dfa', 'Dfb', 'Dfc', 'Dfd', 'Dsa', 'Dsb', 'Dsc', 'Dsd', 'Dwa', 'Dwb', 'Dwc', 'Dwd', 'EF', 'ET'];
export const RESOURCE_NAMES = ['bananas', 'cattle', 'coal', 'copper', 'cotton', 'dates', 'deer', 'dyes', 'fish', 'furs', 'gems', 'gold', 'honey', 'horses', 'incense', 'iron', 'oil', 'olives', 'papyrus', 'reeds', 'rice', 'rubber', 'salt', 'sheep', 'silk', 'silver', 'spices', 'stone', 'sugar', 'tea', 'timber', 'uranium', 'whales', 'wheat', 'wine'];
export const MAX_ATTEMPTS = 4;
const RMAX = 8; // plate-edge distance tracked, in rings
const STEP_UNITS = 198; // a quarter of the cell spacing (about 19 km) in ONE units
const RIVER_TILE_SHARE = 0.36; // land tiles with a river edge (Earth 0.38)

// ---- the grid ---------------------------------------------------------------------------------
const gridCache = new WeakMap();
/** Neighbour lists, integer positions, float unit vectors and the east and north tangents. */
export const prepareGrid = (grid) => {
  let g = gridCache.get(grid.lat);
  if (g) return g;
  const n = grid.count;
  const nb = new Array(n);
  for (let i = 0; i < n; i++) {
    const ns = [];
    for (let k = 0; k < 6; k++) { const j = grid.neighbors[i * 6 + k]; if (j >= 0) ns.push(j); }
    nb[i] = ns;
  }
  const pos = new Int32Array(3 * n); const vec = new Float64Array(3 * n);
  const east = new Float64Array(3 * n); const north = new Float64Array(3 * n);
  const latDeg = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const lat = grid.lat[i] / 1000; const lon = grid.lon[i] / 1000;
    latDeg[i] = lat;
    const v = fromLatLonExact(lat, lon);
    vec[3 * i] = v[0]; vec[3 * i + 1] = v[1]; vec[3 * i + 2] = v[2];
    pos[3 * i] = Math.round(v[0] * ONE); pos[3 * i + 1] = Math.round(v[1] * ONE); pos[3 * i + 2] = Math.round(v[2] * ONE);
    const [sLa, cLa] = sinCosDeg(lat); const [sLo, cLo] = sinCosDeg(lon);
    east[3 * i] = -sLo; east[3 * i + 1] = cLo; east[3 * i + 2] = 0;
    north[3 * i] = -sLa * cLo; north[3 * i + 1] = -sLa * sLo; north[3 * i + 2] = cLa;
  }
  g = { n, nb, pos, vec, east, north, latDeg };
  gridCache.set(grid.lat, g);
  return g;
};

// 1 at x = 0 falling smoothly to 0 at x = 1 (one minus smoothstep).
const sm = (x) => { if (x <= 0) return 1; if (x >= 1) return 0; return (1 - x) * (1 - x) * (1 + 2 * x); };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// A binary min-heap of corner ids keyed by (key, id).
const makeHeap = (cap, key) => {
  const h = new Int32Array(cap); let size = 0;
  const less = (a, b) => key[a] < key[b] || (key[a] === key[b] && a < b);
  return {
    get size() { return size; },
    push(x) { let i = size++; h[i] = x; while (i > 0) { const p = (i - 1) >> 1; if (!less(h[i], h[p])) break; const t = h[i]; h[i] = h[p]; h[p] = t; i = p; } },
    pop() {
      const top = h[0]; h[0] = h[--size]; let i = 0;
      for (;;) { const l = 2 * i + 1; const r = l + 1; let m = i; if (l < size && less(h[l], h[m])) m = l; if (r < size && less(h[r], h[m])) m = r; if (m === i) break; const t = h[i]; h[i] = h[m]; h[m] = t; i = m; }
      return top;
    }
  };
};

// ---- corners: the hex vertices and the edges between them -------------------------------------
const cornerCache = new WeakMap();
const prepareCorners = (G) => {
  let c = cornerCache.get(G);
  if (c) return c;
  const { n, nb } = G;
  // A corner belongs to the smallest of its three cells, numbered in (cell, slot) order; the other
  // two cells find it among the owner's slots.
  const cells = [];
  const cornerOf = new Int32Array(6 * n).fill(-1);
  for (let i = 0; i < n; i++) {
    const ns = nb[i]; const m = ns.length;
    for (let k = 0; k < m; k++) {
      const a = ns[k]; const b = ns[(k + 1) % m];
      if (i < a && i < b) { cornerOf[6 * i + k] = cells.length / 3; cells.push(i, a < b ? a : b, a < b ? b : a); }
    }
  }
  for (let i = 0; i < n; i++) {
    const ns = nb[i]; const m = ns.length;
    for (let k = 0; k < m; k++) {
      const a = ns[k]; const b = ns[(k + 1) % m];
      if (i < a && i < b) continue;
      const o = a < b ? a : b; const x = o === a ? b : a; // the owner and the third cell
      const os = nb[o]; const om = os.length;
      for (let t = 0; t < om; t++) {
        const p = os[t]; const q = os[(t + 1) % om];
        if ((p === i && q === x) || (p === x && q === i)) { cornerOf[6 * i + k] = cornerOf[6 * o + t]; break; }
      }
    }
  }
  const nc = cells.length / 3;
  // Links along every cell edge: corners c1 - c2 on the edge (a, b), with the slots on both sides.
  const linkNb = new Int32Array(3 * nc).fill(-1); const linkEdge = new Int32Array(3 * nc).fill(-1);
  const deg = new Uint8Array(nc);
  const eA = []; const eKA = []; const eB = []; const eKB = [];
  for (let a = 0; a < n; a++) {
    const ns = nb[a]; const m = ns.length;
    for (let k = 0; k < m; k++) {
      const b = ns[k];
      if (b < a) continue;
      const c1 = cornerOf[6 * a + ((k + m - 1) % m)]; const c2 = cornerOf[6 * a + k];
      const e = eA.length;
      eA.push(a); eKA.push(k); eB.push(b); eKB.push(nb[b].indexOf(a));
      linkNb[3 * c1 + deg[c1]] = c2; linkEdge[3 * c1 + deg[c1]] = e; deg[c1]++;
      linkNb[3 * c2 + deg[c2]] = c1; linkEdge[3 * c2 + deg[c2]] = e; deg[c2]++;
    }
  }
  c = { nc, cells: Int32Array.from(cells), cornerOf, linkNb, linkEdge, eA: Int32Array.from(eA), eKA: Int8Array.from(eKA), eB: Int32Array.from(eB), eKB: Int8Array.from(eKB) };
  cornerCache.set(G, c);
  return c;
};

// ---- one attempt ----------------------------------------------------------------------------------
const CLIMATE_OFFSET = { cold: -6, temperate: 0, hot: 4 };
const RAIN_SCALE = { dry: 0.7, normal: 1, wet: 1.35 };
const RELIEF_SCALE = { low: 0.6, normal: 1, high: 1.4 };

const attemptWorld = (grid, seed, params, attempt, progress, version = 1) => {
  const V2 = version >= 2; // generator 2: the look pass (see the header); version 1 stays byte for byte
  const G = prepareGrid(grid);
  const { n, nb, pos, vec, east, north, latDeg } = G;
  const s0 = hash1(seed, 0x51a7 + attempt * 7919);
  const salt = (k) => hash1(k, s0);
  const rng = createRng(s0);
  const landTarget = Math.round((n * params.land) / 100);

  // ---- 1. plates ---------------------------------------------------------------------------------
  // generator 2's shapes (spec.js): more, smaller plates for the archipelago and islands
  const shape = V2 ? params.shape : 'continents';
  const reliefScale = V2 ? RELIEF_SCALE[params.relief] ?? 1 : 1;
  const nP = shape === 'archipelago' ? 34 + Math.floor(rng.next() * 8) : shape === 'islands' ? 44 + Math.floor(rng.next() * 8) : 22 + Math.floor(rng.next() * 9);
  const seeds = []; const vel = [];
  while (seeds.length < nP) {
    const x = rng.next() * 2 - 1; const y = rng.next() * 2 - 1; const z = rng.next() * 2 - 1;
    const q = x * x + y * y + z * z;
    if (q > 1 || q < 0.01) continue;
    const m = Math.sqrt(q);
    seeds.push([x / m, y / m, z / m]);
  }
  seeds.forEach((s) => {
    let vx = rng.next() * 2 - 1; let vy = rng.next() * 2 - 1; let vz = rng.next() * 2 - 1;
    const d = vx * s[0] + vy * s[1] + vz * s[2];
    vx -= d * s[0]; vy -= d * s[1]; vz -= d * s[2];
    const m = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    const speed = 0.4 + rng.next() * 0.8;
    vel.push([(vx / m) * speed, (vy / m) * speed, (vz / m) * speed]);
  });
  const seedI = seeds.map((s) => [Math.round(s[0] * ONE), Math.round(s[1] * ONE), Math.round(s[2] * ONE)]);
  const W1 = makeField(salt(1), 2, 4); const W2 = makeField(salt(2), 2, 4); const W3 = makeField(salt(3), 2, 4);
  const WARP = 30000; // displacement scale (0.45 of a radius at full noise)
  const plate = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const px = pos[3 * i]; const py = pos[3 * i + 1]; const pz = pos[3 * i + 2];
    const qx = px + Math.floor((W1(px, py, pz) * WARP) / ONE);
    const qy = py + Math.floor((W2(px, py, pz) * WARP) / ONE);
    const qz = pz + Math.floor((W3(px, py, pz) * WARP) / ONE);
    let best = 0; let bestD = -Infinity;
    for (let p = 0; p < nP; p++) { const d = qx * seedI[p][0] + qy * seedI[p][1] + qz * seedI[p][2]; if (d > bestD) { bestD = d; best = p; } }
    plate[i] = best;
  }
  const area = new Int32Array(nP); const border = Array.from({ length: nP }, () => new Int32Array(nP));
  for (let i = 0; i < n; i++) { area[plate[i]]++; for (const j of nb[i]) if (plate[j] !== plate[i]) border[plate[i]][plate[j]]++; }

  // ---- 2. continents: groups of plates -----------------------------------------------------------
  const autoK = shape === 'pangaea' || shape === 'inland' ? 1 : shape === 'archipelago' ? 9 + (hash1(seed, 0xc0) % 4) : shape === 'islands' ? 18 + (hash1(seed, 0xc0) % 6) : 3 + (hash1(seed, 0xc0) % 4);
  const k = params.continents || autoK;
  const group = new Int16Array(nP).fill(-1);
  const gArea = new Array(k).fill(0);
  const contTarget = Math.round(landTarget * 1.08);
  const cores = [];
  const alive = [];
  for (let p = 0; p < nP; p++) if (area[p] > 0) alive.push(p);
  cores.push(alive[Math.floor(rng.next() * alive.length)]);
  while (cores.length < k && cores.length < alive.length) {
    let best = -1; let bestD = Infinity;
    alive.forEach((p) => {
      if (cores.includes(p)) return;
      let near = -Infinity;
      cores.forEach((c) => { const d = seeds[p][0] * seeds[c][0] + seeds[p][1] * seeds[c][1] + seeds[p][2] * seeds[c][2]; if (d > near) near = d; });
      if (near < bestD) { bestD = near; best = p; }
    });
    cores.push(best);
  }
  cores.forEach((p, g) => { group[p] = g; gArea[g] += area[p]; });
  let contArea = gArea.reduce((a, b) => a + b, 0);
  const touchesOther = (p, g) => { for (let q = 0; q < nP; q++) if (border[p][q] && group[q] >= 0 && group[q] !== g) return true; return false; };
  let relaxed = false;
  while (contArea < contTarget) {
    const order = gArea.map((a, g) => [a, g]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[1]);
    let added = false;
    for (const g of order) {
      let best = -1; let bestB = 0;
      for (let p = 0; p < nP; p++) {
        if (group[p] >= 0 || !area[p]) continue;
        let b = 0; for (let q = 0; q < nP; q++) if (group[q] === g) b += border[p][q];
        if (!b || (!relaxed && touchesOther(p, g))) continue;
        if (b > bestB) { bestB = b; best = p; }
      }
      if (best >= 0) { group[best] = g; gArea[g] += area[best]; contArea += area[best]; added = true; break; }
    }
    if (!added) { if (relaxed) break; relaxed = true; }
  }
  const isCont = (p) => group[p] >= 0;
  progress(0.15, 'plates');

  // ---- 3. plate edges: distance in rings and the interaction there --------------------------------
  const dist = new Int8Array(n).fill(-1);
  const bConv = new Float64Array(n); const bOther = new Int16Array(n).fill(-1);
  const queue = new Int32Array(n); let qh = 0; let qt = 0;
  for (let i = 0; i < n; i++) {
    const a = plate[i];
    let other = -1;
    for (const j of nb[i]) if (plate[j] !== a) { other = plate[j]; break; }
    if (other < 0) continue;
    const sa = seeds[a]; const sb = seeds[other];
    let dx = sb[0] - sa[0]; let dy = sb[1] - sa[1]; let dz = sb[2] - sa[2];
    const m = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    dx /= m; dy /= m; dz /= m;
    const va = vel[a]; const vb = vel[other];
    bConv[i] = (va[0] - vb[0]) * dx + (va[1] - vb[1]) * dy + (va[2] - vb[2]) * dz;
    bOther[i] = other; dist[i] = 0; queue[qt++] = i;
  }
  while (qh < qt) {
    const i = queue[qh++];
    if (dist[i] >= RMAX) continue;
    for (const j of nb[i]) {
      if (dist[j] >= 0 || plate[j] !== plate[i]) continue;
      dist[j] = dist[i] + 1; bConv[j] = bConv[i]; bOther[j] = bOther[i]; queue[qt++] = j;
    }
  }

  // ---- 4. coarse elevation per cell (metres) -------------------------------------------------------
  const C1 = makeField(salt(4), 2, 5); const C2 = makeField(salt(8), 6, 3); const HILL = makeField(salt(5), 3, 2);
  const coarse = new Float64Array(n); const mountainF = new Float64Array(n); const hillF = new Float64Array(n);
  const rangeBelt = new Uint8Array(n);
  const hotspots = [];
  const nHot = 6 + Math.floor(rng.next() * 6);
  for (let h = 0; h < nHot; h++) hotspots.push(Math.floor(rng.next() * n));
  const hotBoost = new Float64Array(n);
  hotspots.forEach((c) => {
    hotBoost[c] += 4200;
    nb[c].forEach((j) => { hotBoost[j] += 2600; nb[j].forEach((x) => { hotBoost[x] += 500; }); });
  });
  for (let i = 0; i < n; i++) {
    const own = plate[i]; const contOwn = isCont(own);
    const d = dist[i] < 0 ? RMAX + 1 : dist[i];
    const other = bOther[i];
    const otherCont = other >= 0 && isCont(other);
    let e = contOwn ? 350 : -3600;
    if (other >= 0 && contOwn !== otherCont && d <= 4) e = contOwn ? 350 - 700 * sm(d / 5) : -3600 + 2400 * sm(d / 5);
    let up = 0;
    const c = other >= 0 ? bConv[i] : 0;
    if (c > 0.15) {
      if (contOwn && otherCont) up = Math.min(5200, 3400 * c) * sm(d / 6.5);
      else if (contOwn) up = Math.min(4400, 3000 * c) * sm(Math.abs(d - 1.5) / 3.5);
      else if (otherCont) up = -1800 * c * sm(d / 2.5);
      else up = own > other ? (V2 ? Math.min(2500, 2000 * c) : Math.min(4800, 3600 * c)) * sm(Math.abs(d - 1.2) / 2) : -1500 * c * sm(d / 2);
    } else if (c < -0.15) {
      const a = -c;
      if (contOwn) up = otherCont ? -900 * a * sm(d / 2.5) : 0;
      else up = (V2 ? 900 : 1400) * a * sm(d / 3.5);
    }
    const px = pos[3 * i]; const py = pos[3 * i + 1]; const pz = pos[3 * i + 2];
    up *= reliefScale;
    // the archipelago and islands break their land up with stronger broad noise
    const broad = shape === 'islands' ? 2 : shape === 'archipelago' ? 1.5 : 1;
    e += up + (C1(px, py, pz) * 2300 * broad) / ONE + (C2(px, py, pz) * 900 * broad) / ONE + hotBoost[i];
    if (contOwn && d > 5) e += 120;
    coarse[i] = e;
    mountainF[i] = up > 150 ? clamp(up / 2600, 0, 1.3) : 0;
    hillF[i] = clamp(0.5 + HILL(px, py, pz) / ONE, 0, 1);
    if (up > 1200) rangeBelt[i] = 1;
  }
  progress(0.3, 'elevation');

  // ---- 5. detail: 5 x 5 samples per cell near and above the coast ----------------------------------
  const sortedCoarse = Float64Array.from(coarse).sort();
  const provisional = sortedCoarse[n - landTarget];
  const FD = makeField(salt(6), 48, 2); const FR = makeField(salt(7), 24, 3, { ridged: true });
  const elevMean = new Int32Array(n); const elevMax = new Int32Array(n); const rough = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const e = coarse[i];
    if (e < provisional - 1100) { elevMean[i] = Math.round(e); elevMax[i] = Math.round(e); rough[i] = 25; continue; }
    const hf = hillF[i]; const ad = 260 + 1700 * hf * hf; const ar = 3800 * mountainF[i] * reliefScale;
    const px = pos[3 * i]; const py = pos[3 * i + 1]; const pz = pos[3 * i + 2];
    const ex = east[3 * i] * STEP_UNITS; const ey = east[3 * i + 1] * STEP_UNITS; const ez = east[3 * i + 2] * STEP_UNITS;
    const nx = north[3 * i] * STEP_UNITS; const ny = north[3 * i + 1] * STEP_UNITS; const nz = north[3 * i + 2] * STEP_UNITS;
    let sum = 0; let sum2 = 0; let mx = -Infinity;
    for (let a = -2; a <= 2; a++) {
      for (let b = -2; b <= 2; b++) {
        const sx = px + Math.round(ex * a + nx * b); const sy = py + Math.round(ey * a + ny * b); const sz = pz + Math.round(ez * a + nz * b);
        const v = ar > 0 ? (FD(sx, sy, sz) * ad + FR(sx, sy, sz) * ar) / ONE : (FD(sx, sy, sz) * ad) / ONE;
        sum += v; sum2 += v * v; if (v > mx) mx = v;
      }
    }
    const mean = sum / 25;
    const sd = Math.sqrt(Math.max(0, sum2 / 25 - mean * mean));
    elevMean[i] = Math.round(e + mean); elevMax[i] = Math.round(e + mx); rough[i] = Math.round(sd);
  }
  progress(0.5, 'detail');

  // ---- 6. sea level by quantile ---------------------------------------------------------------------
  const ids = new Int32Array(n); for (let i = 0; i < n; i++) ids[i] = i;
  ids.sort((a, b) => elevMean[b] - elevMean[a] || a - b);
  const land = new Uint8Array(n);
  for (let r = 0; r < landTarget; r++) land[ids[r]] = 1;
  let seaLevel = elevMean[ids[landTarget - 1]];
  const carved = new Int16Array(n); // generator 2, the inland sea: its depth (m) plus one
  if (V2) {
    // Generator 2: no specks of up to six hexes (island arcs read as dotted lines) and no enclosed
    // enclosed seas inside the continents (the shallow inland seas of version 1). The specks are
    // drowned and the small seas filled, then the quantile is taken again over the rest so the
    // land share stays exact; again while anything changes (a fill can join specks, a drowning open seas).
    const force = new Int8Array(n); // 1 must be land, -1 must be sea
    const comp = new Int32Array(n);
    if (shape === 'inland') {
      // The inland sea: about 6% of the land, carved round the land tile farthest from the sea
      // (rings of land from it, a hashed half ring of wobble), deepest in the middle.
      const ds = new Int16Array(n).fill(-1);
      qh = 0; qt = 0;
      for (let i = 0; i < n; i++) if (!land[i]) { ds[i] = 0; queue[qt++] = i; }
      while (qh < qt) { const i = queue[qh++]; for (const j of nb[i]) if (ds[j] < 0) { ds[j] = ds[i] + 1; queue[qt++] = j; } }
      let centre = 0; for (let i = 1; i < n; i++) if (ds[i] > ds[centre]) centre = i;
      const ring = new Int16Array(n).fill(-1);
      qh = 0; qt = 0; queue[qt++] = centre; ring[centre] = 0;
      const want = Math.round(landTarget * 0.06);
      while (qh < qt && qt < want * 2) { const i = queue[qh++]; for (const j of nb[i]) if (ring[j] < 0) { ring[j] = ring[i] + 1; queue[qt++] = j; } }
      const order = Array.from(queue.subarray(0, qt)).sort((a, b) => (ring[a] + hashUnit(a, s0 ^ 0x5ea) * 1.5) - (ring[b] + hashUnit(b, s0 ^ 0x5ea) * 1.5) || a - b);
      const rMax = Math.max(1, ring[order[Math.min(order.length, want) - 1]]);
      for (let r = 0; r < want && r < order.length; r++) { const i = order[r]; force[i] = -1; carved[i] = 1 + Math.round(1800 * (1 - ring[i] / (rMax + 1))); }
    }
    for (let round = 0; round < 6; round++) {
      comp.fill(-1);
      const sizes = [];
      let biggestSea = -1;
      for (let s = 0; s < n; s++) {
        if (comp[s] >= 0) continue;
        const id = sizes.length; const kind = land[s];
        qh = 0; qt = 0; queue[qt++] = s; comp[s] = id;
        while (qh < qt) { const i = queue[qh++]; for (const j of nb[i]) if (comp[j] < 0 && land[j] === kind) { comp[j] = id; queue[qt++] = j; } }
        sizes.push(qt);
        if (!kind && (biggestSea < 0 || qt > sizes[biggestSea])) biggestSea = id;
      }
      let changed = 0;
      for (let i = 0; i < n; i++) {
        const c = comp[i];
        if (land[i] && sizes[c] <= 6 && force[i] !== -1) { force[i] = -1; changed++; }
        if (!land[i] && c !== biggestSea && sizes[c] < 250 && force[i] !== 1) { force[i] = 1; changed++; }
      }
      if (!changed) break;
      const key = (i) => elevMean[i] + force[i] * 100000;
      ids.sort((a, b) => key(b) - key(a) || a - b);
      land.fill(0);
      for (let r = 0; r < landTarget; r++) land[ids[r]] = 1;
      // the sea level of the free tiles (a forced tile keeps its own height, held at the shore)
      for (let r = landTarget - 1; r >= 0; r--) if (!force[ids[r]]) { seaLevel = elevMean[ids[r]]; break; }
    }
    // What the rounds left: drown the last specks and give their hexes to the highest sea hexes on
    // the shores of the larger landmasses (one for one, so the share stays exact).
    comp.fill(-1);
    const sizes = [];
    for (let s = 0; s < n; s++) {
      if (comp[s] >= 0 || !land[s]) continue;
      qh = 0; qt = 0; queue[qt++] = s; comp[s] = sizes.length;
      while (qh < qt) { const i = queue[qh++]; for (const j of nb[i]) if (comp[j] < 0 && land[j]) { comp[j] = sizes.length; queue[qt++] = j; } }
      sizes.push(qt);
    }
    let drowned = 0;
    for (let i = 0; i < n; i++) if (land[i] && sizes[comp[i]] <= 6) { land[i] = 0; force[i] = -1; drowned++; }
    if (drowned) {
      const shore = [];
      for (let i = 0; i < n; i++) if (!land[i] && force[i] !== -1 && nb[i].some((j) => land[j] && sizes[comp[j]] > 6)) shore.push(i);
      shore.sort((a, b) => elevMean[b] - elevMean[a] || a - b);
      // (never one that would leave a sea hex walled in by land)
      const seaLeft = (j, but) => nb[j].some((x) => x !== but && !land[x]);
      for (let r = 0; r < shore.length && drowned > 0; r++) {
        const i = shore[r];
        if (nb[i].some((j) => !land[j] && !seaLeft(j, i))) continue;
        land[i] = 1; force[i] = 1; drowned--;
      }
    }
  }
  const elevation = new Int16Array(n); const elevMaxS = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let e = elevMean[i] - seaLevel + (land[i] ? 1 : 0);
    e = land[i] ? Math.max(1, e) : Math.min(0, e);
    if (carved[i]) e = Math.min(e, 1 - carved[i] - 200);
    elevation[i] = clamp(e, -11000, 9000); elevMaxS[i] = Math.max(elevation[i], elevMax[i] - seaLevel);
  }
  // Lakes are land hexes with terrain lake (as on Earth), made by the drainage pass below, so the
  // land share stays exact. Enclosed seas stay sea (Earth's Caspian is one).
  const lake = new Uint8Array(n);

  // ---- 7. climate ------------------------------------------------------------------------------------
  // Rings to the sea (continentality), over land.
  const dsea = new Int16Array(n).fill(-1);
  qh = 0; qt = 0;
  for (let i = 0; i < n; i++) if (!land[i]) { dsea[i] = 0; queue[qt++] = i; }
  while (qh < qt) { const i = queue[qh++]; for (const j of nb[i]) if (dsea[j] < 0) { dsea[j] = dsea[i] + 1; queue[qt++] = j; } }
  const tOff = CLIMATE_OFFSET[params.climate] ?? 0;
  const seaTemp = (i) => 27 - 0.0075 * latDeg[i] * latDeg[i] + tOff;
  const meanT = new Float64Array(n);
  for (let i = 0; i < n; i++) meanT[i] = seaTemp(i) - (land[i] ? 0.0065 * Math.max(0, elevation[i]) : 0);
  // The prevailing wind band: the direction the wind comes FROM, in the cell's tangent plane.
  const upwindStep = (i) => {
    const lat = latDeg[i]; const al = lat < 0 ? -lat : lat; const sg = lat < 0 ? -1 : 1;
    let ue; let un;
    if (al < 30) { ue = 1; un = 0.35 * sg; } else if (al < 60) { ue = -1; un = -0.3 * sg; } else { ue = 1; un = 0.3 * sg; }
    const dx = east[3 * i] * ue + north[3 * i] * un; const dy = east[3 * i + 1] * ue + north[3 * i + 1] * un; const dz = east[3 * i + 2] * ue + north[3 * i + 2] * un;
    let best = -1; let bestD = -Infinity;
    for (const j of nb[i]) {
      const d = (vec[3 * j] - vec[3 * i]) * dx + (vec[3 * j + 1] - vec[3 * i + 1]) * dy + (vec[3 * j + 2] - vec[3 * i + 2]) * dz;
      if (d > bestD || (d === bestD && j < best)) { bestD = d; best = j; }
    }
    return best;
  };
  const upwind = new Int32Array(n);
  for (let i = 0; i < n; i++) upwind[i] = upwindStep(i);
  const K = 14;
  const DRY = makeField(salt(9), 4, 2);
  const precip = new Float64Array(n); const drySummer = new Uint8Array(n); const dryWinter = new Uint8Array(n);
  const path = new Int32Array(K + 1);
  const rainScale = RAIN_SCALE[params.rainfall] ?? 1;
  for (let i = 0; i < n; i++) {
    if (!land[i] || lake[i]) continue;
    path[0] = i;
    for (let s = 1; s <= K; s++) path[s] = upwind[path[s - 1]];
    let m = land[path[K]] && !lake[path[K]] ? 0.4 : 0;
    let seaNear = 99;
    for (let s = K; s >= 1; s--) {
      const x = path[s];
      if (!land[x] || lake[x]) {
        const warm = clamp((seaTemp(x) + 5) / 30, 0.15, 1);
        m += (1 - m) * 0.35 * warm;
        if (s < seaNear) seaNear = s;
      } else {
        const rise = Math.max(0, elevation[path[s - 1]] - elevation[x]);
        m -= m * clamp(0.045 + rise / 2500, 0, 0.6);
        m += (1 - m) * 0.02;
      }
    }
    const rise = Math.max(0, elevation[i] - elevation[path[1]]);
    let P = m * 1500 + m * Math.min(1, rise / 1200) * 1600;
    const al = latDeg[i] < 0 ? -latDeg[i] : latDeg[i];
    if (al < 12) P = P * 1.15 + 900 * (1 - al / 12);
    // the dry subtropical belt (generator 2: its middle wanders by up to 7 degrees, no straight stripes)
    const belt = V2 ? 26 + (DRY(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]) * 22) / ONE : 26;
    if (al > belt - 10 && al < belt + 10) P *= 0.4 + 0.6 * Math.min(1, Math.abs(al - belt) / 10);
    P *= clamp((meanT[i] + 25) / 40, 0.3, 1);
    precip[i] = P * rainScale;
    if (al >= 30 && al <= 45 && seaNear <= 5) drySummer[i] = 1;
    else if (al >= 18 && al < 32 && al < 30 && seaNear <= 6 && dsea[i] <= 6) dryWinter[i] = 1;
  }
  const climate = new Int8Array(n).fill(-1);
  const glaciated = new Uint8Array(n);
  const warmestOf = new Float64Array(n);
  const climateCode = (name) => { const c = CLIMATE_NAMES.indexOf(name); return c >= 0 ? c : CLIMATE_NAMES.indexOf(name.slice(0, 2) + 'b') >= 0 ? CLIMATE_NAMES.indexOf(name.slice(0, 2) + 'b') : CLIMATE_NAMES.indexOf('Cfb'); };
  for (let i = 0; i < n; i++) {
    const al = latDeg[i] < 0 ? -latDeg[i] : latDeg[i];
    const cont = clamp((dsea[i] < 0 ? 0 : dsea[i]) / 12, 0, 1);
    const amp = (4 + 0.6 * al) * (0.3 + 0.7 * cont);
    const T = meanT[i];
    const warmest = T + amp / 2; const coldest = T - amp / 2;
    warmestOf[i] = warmest;
    if (!land[i]) { if ((V2 ? al > 80 + hashUnit(i, s0 ^ 0x1ce) * 3 : al > 76) && warmest < 2) glaciated[i] = 1; continue; }
    if (lake[i]) continue;
    const P = precip[i]; const s = drySummer[i]; const w = dryWinter[i];
    let kname;
    if (warmest < 10) kname = warmest < 0 ? 'EF' : 'ET';
    else {
      const pth = 20 * T + (s ? 0 : w ? 280 : 140);
      if (P < pth) kname = (P < pth / 2 ? 'BW' : 'BS') + (T >= 18 ? 'h' : 'k');
      else if (coldest >= 18) kname = P >= 2000 ? 'Af' : P >= 1500 ? 'Am' : 'Aw';
      else if (coldest > -3) kname = `C${s ? 's' : w ? 'w' : 'f'}${warmest >= 22 ? 'a' : warmest >= 16 ? 'b' : 'c'}`;
      else kname = `D${s ? 's' : w ? 'w' : 'f'}${warmest >= 22 ? 'a' : warmest >= 16 ? 'b' : coldest < -38 ? 'd' : 'c'}`;
    }
    climate[i] = climateCode(kname);
    if (kname === 'EF' || ((V2 ? al > 75 : al > 72) && warmest < 4)) glaciated[i] = 1;
  }
  progress(0.62, 'climate');

  // ---- 8. drainage on the corners ----------------------------------------------------------------------
  const C = prepareCorners(G);
  const { nc, cells: cc, linkNb, linkEdge, eA, eKA, eB, eKB } = C;
  const cornerElev = new Float64Array(nc);
  for (let c = 0; c < nc; c++) cornerElev[c] = (elevation[cc[3 * c]] + elevation[cc[3 * c + 1]] + elevation[cc[3 * c + 2]]) / 3 + (hash1(c, s0 ^ 0x77) % 40);
  const flood = (isOutlet) => {
    const filled = new Float64Array(nc); const down = new Int32Array(nc).fill(-1); const downEdge = new Int32Array(nc).fill(-1);
    const seen = new Uint8Array(nc); const order = new Int32Array(nc); let no = 0;
    const heap = makeHeap(nc, filled);
    for (let c = 0; c < nc; c++) if (isOutlet(c)) { filled[c] = cornerElev[c]; seen[c] = 1; heap.push(c); }
    while (heap.size) {
      const c = heap.pop(); order[no++] = c;
      for (let t = 0; t < 3; t++) {
        const x = linkNb[3 * c + t];
        if (x < 0 || seen[x]) continue;
        seen[x] = 1; filled[x] = Math.max(cornerElev[x], filled[c]); down[x] = c; downEdge[x] = linkEdge[3 * c + t]; heap.push(x);
      }
    }
    return { filled, down, downEdge, order: order.subarray(0, no), seen };
  };
  const cornerWet = (c) => !land[cc[3 * c]] || !land[cc[3 * c + 1]] || !land[cc[3 * c + 2]] || lake[cc[3 * c]] || lake[cc[3 * c + 1]] || lake[cc[3 * c + 2]];
  let F = flood(cornerWet);
  // Lakes: filled depressions deep enough, in whole hexes, at most 2.5% of the land.
  {
    const depth = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      if (!land[i] || lake[i] || dsea[i] <= 1) continue;
      let s = 0; let m = Infinity;
      for (let k2 = 0; k2 < nb[i].length; k2++) { const c = C.cornerOf[6 * i + k2]; const d = F.filled[c] - cornerElev[c]; s += d; if (d < m) m = d; }
      depth[i] = m > 0 ? s / nb[i].length : 0;
    }
    const cand = []; const seenL = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      if (depth[s] < (V2 ? 160 : 110) || seenL[s]) continue;
      const comp = []; qh = 0; qt = 0; queue[qt++] = s; seenL[s] = 1;
      while (qh < qt) { const i = queue[qh++]; comp.push(i); for (const j of nb[i]) if (!seenL[j] && depth[j] >= 110) { seenL[j] = 1; queue[qt++] = j; } }
      let tot = 0; comp.forEach((i) => { tot += depth[i]; });
      cand.push({ comp, tot, first: s });
    }
    cand.sort((a, b) => b.tot - a.tot || a.first - b.first);
    let budget = Math.floor(landTarget * (V2 ? 0.007 : 0.012)); let added = 0;
    cand.forEach(({ comp }) => { if (comp.length <= budget) { comp.forEach((i) => { lake[i] = 1; climate[i] = -1; }); budget -= comp.length; added += comp.length; } });
    if (added) F = flood(cornerWet);
  }
  // Flow accumulation, weighted by the rain of the corner's cells.
  const acc = new Float64Array(nc);
  for (let c = 0; c < nc; c++) {
    if (cornerWet(c)) continue;
    acc[c] = (precip[cc[3 * c]] + precip[cc[3 * c + 1]] + precip[cc[3 * c + 2]]) / 3 + 50;
  }
  const basin = new Int32Array(nc).fill(-1);
  for (let r = 0; r < F.order.length; r++) { const c = F.order[r]; basin[c] = F.down[c] < 0 ? c : basin[F.down[c]]; }
  for (let r = F.order.length - 1; r >= 0; r--) { const c = F.order[r]; if (F.down[c] >= 0) acc[F.down[c]] += acc[c]; }
  // River edges: corner -> downstream corner where the flow passes a threshold set for the target
  // share of land tiles with a river edge.
  const segs = [];
  const icy = (c) => glaciated[cc[3 * c]] || glaciated[cc[3 * c + 1]] || glaciated[cc[3 * c + 2]];
  // No river on the ice, nor one that would run into it (it would end on dry land there).
  const iceDown = new Uint8Array(nc);
  for (let r = 0; r < F.order.length; r++) { const c = F.order[r]; iceDown[c] = icy(c) || (F.down[c] >= 0 && iceDown[F.down[c]]) ? 1 : 0; }
  for (let c = 0; c < nc; c++) if (F.down[c] >= 0 && !cornerWet(c) && !iceDown[c]) segs.push(c);
  segs.sort((a, b) => acc[b] - acc[a] || a - b);
  const landCount = landTarget;
  const mark = new Uint32Array(n); let stamp = 0;
  const coverage = (count) => {
    stamp++; let tiles = 0;
    for (let r = 0; r < count; r++) {
      const e = F.downEdge[segs[r]]; const a = eA[e]; const b = eB[e];
      if (mark[a] !== stamp) { mark[a] = stamp; tiles++; }
      if (mark[b] !== stamp) { mark[b] = stamp; tiles++; }
    }
    return tiles / landCount;
  };
  let lo = 0; let hi = segs.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (coverage(mid) < RIVER_TILE_SHARE) lo = mid + 1; else hi = mid; }
  const riverCount = lo;
  const rivers = new Uint8Array(n); const riverSize = new Uint16Array(n);
  const setEdge = (e, size) => {
    const a = eA[e]; const b = eB[e]; const ka = eKA[e]; const kb = eKB[e];
    rivers[a] |= 1 << ka; rivers[b] |= 1 << kb;
    riverSize[a] = (riverSize[a] & ~(3 << (2 * ka))) | (size << (2 * ka));
    riverSize[b] = (riverSize[b] & ~(3 << (2 * kb))) | (size << (2 * kb));
  };
  const segSize = new Uint8Array(nc);
  for (let r = 0; r < riverCount; r++) {
    const size = r < riverCount * 0.1 ? 3 : r < riverCount * 0.36 ? 2 : 1;
    segSize[segs[r]] = size;
    setEdge(F.downEdge[segs[r]], size);
  }
  progress(0.75, 'rivers');

  // ---- 9. classify ---------------------------------------------------------------------------------------
  const coastal = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (land[i] && !lake[i]) { for (const j of nb[i]) if (!land[j]) { coastal[i] = 1; break; } } else if (!land[i]) { for (const j of nb[i]) if (land[j] && !lake[j]) { coastal[i] = 1; break; } }
  }
  const idSalt = hash1(seed, 0xa11);
  const hashS = (id, s) => { let h = ((id + idSalt) * 2654435761 + s * 40503) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  // Deltas at the mouths of great rivers, wetlands in wet shallow basins.
  const delta = new Uint8Array(n);
  for (let r = 0; r < riverCount; r++) {
    const c = segs[r]; if (segSize[c] < 3) continue;
    const d = F.down[c]; if (!cornerWet(d)) continue;
    for (let t = 0; t < 3; t++) { const i = cc[3 * d + t]; if (land[i] && !lake[i]) delta[i] = 1; }
  }
  const terrain = new Uint8Array(n); const relief = new Uint8Array(n); const feature = new Uint8Array(n);
  const NONE = new Set();
  for (let i = 0; i < n; i++) {
    let rc = NONE;
    if (land[i] && !lake[i]) {
      rc = new Set();
      if (rangeBelt[i]) rc.add('Range/mtn');
      if (elevation[i] > 1200 && rough[i] < 250) rc.add('Plateau');
      if (delta[i] && precip[i] > 500) rc.add('Delta');
      else if (precip[i] > 1100 && elevation[i] < 200 && rivers[i] && hashS(i, 3) < 0.25) rc.add('Wetlands');
    }
    const c = classify({
      id: i, land: !!land[i] && !lake[i], lat: latDeg[i] < 0 ? -latDeg[i] : latDeg[i], elevMean: elevation[i], elevMax: elevMaxS[i], rough: rough[i],
      koppen: climate[i] >= 0 ? CLIMATE_NAMES[climate[i]] : null, regionClasses: rc, glaciated: !!glaciated[i], lake: !!lake[i],
      riverEdges: rivers[i], coastal: !!coastal[i], depth: elevation[i]
    }, hashS);
    terrain[i] = TERRAIN.indexOf(c.terrain); relief[i] = RELIEF.indexOf(c.relief); feature[i] = FEATURE.indexOf(c.feature);
  }
  // A lake hex carries no river along its own edges.
  for (let i = 0; i < n; i++) if (lake[i]) {
    for (let k2 = 0; k2 < nb[i].length; k2++) {
      if (!(rivers[i] & (1 << k2))) continue;
      const j = nb[i][k2]; const kj = nb[j].indexOf(i);
      rivers[i] &= ~(1 << k2); riverSize[i] &= ~(3 << (2 * k2));
      rivers[j] &= ~(1 << kj); riverSize[j] &= ~(3 << (2 * kj));
    }
  }
  progress(0.82, 'classify');

  // ---- 10. resources -------------------------------------------------------------------------------------
  const resource = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const r = scatterResource(i, { land: !!land[i] && !lake[i], t: TERRAIN[terrain[i]], rel: RELIEF[relief[i]], feat: FEATURE[feature[i]], near: coastal[i] }, hashS);
    if (r) resource[i] = RESOURCE_NAMES.indexOf(r);
  }

  // ---- 11. terrain columns and names -------------------------------------------------------------------
  const raw = {
    version: 1, frequency: grid.frequency || 100, orientation: grid.orientation || { rotation: 51, tilt: 0 }, count: n,
    terrainNames: TERRAIN, reliefNames: RELIEF, featureNames: FEATURE, climateNames: CLIMATE_NAMES,
    countryIds: [],
    lat: grid.lat, lon: grid.lon, neighbors: grid.neighbors,
    land, coastal, country: new Int16Array(n).fill(-1), elevation, roughness: Uint16Array.from(rough, (r) => clamp(r, 0, 65535)),
    climate, terrain, relief, feature, rivers, resourceNames: RESOURCE_NAMES, resource,
    riverNames: {}, names: {}, capitals: {}
  };
  const tc = buildTerrainColumns(raw, nb);
  raw.riverSize = riverSize; raw.range = tc.range; raw.ridge = tc.ridge; raw.pass = tc.pass; raw.rangeSizes = tc.rangeSizes;
  raw.terrainDataVersion = 1;
  // Landmasses and their phonologies.
  const mass = new Int32Array(n).fill(-1); const massSizes = [];
  for (let s = 0; s < n; s++) {
    if (!land[s] || lake[s] || mass[s] >= 0) continue;
    const id = massSizes.length; let size = 0; qh = 0; qt = 0; queue[qt++] = s; mass[s] = id;
    while (qh < qt) { const i = queue[qh++]; size++; for (const j of nb[i]) if (land[j] && !lake[j] && mass[j] < 0) { mass[j] = id; queue[qt++] = j; } }
    massSizes.push(size);
  }
  const phonOf = (i) => {
    let m = mass[i];
    if (m < 0) { for (const j of nb[i]) if (mass[j] >= 0) { m = mass[j]; break; } }
    return hash1(m < 0 ? 0 : m, s0 ^ 0x9090) % PHONOLOGIES.length;
  };
  raw.rangeNames = tc.rangeNames.map((_, r) => (tc.rangeSizes[r] >= 5 ? rangeName(phonOf(tc.rangeTiles[r][0]), r, s0) : null));
  for (let i = 0; i < n; i++) if (land[i] && !lake[i] && hashS(i, 91) < 0.2) raw.names[i] = placeName(phonOf(i), i, s0);
  // Rivers: one name per basin whose main stem is a river (size 2) or larger.
  const basinName = new Map();
  for (let r = 0; r < riverCount; r++) {
    const c = segs[r]; if (segSize[c] < 2) continue;
    const e = F.downEdge[c]; const a = eA[e]; const b = eB[e];
    if (!(rivers[a] & (1 << eKA[e]))) continue;
    const bs = basin[c];
    if (!basinName.has(bs)) basinName.set(bs, riverName(phonOf(a), bs, s0));
    const nm = basinName.get(bs);
    raw.riverNames[a] ||= nm; raw.riverNames[b] ||= nm;
  }
  progress(0.9, 'names');

  // ---- 12. fair start sites (and their repairs: part of the world) ---------------------------------
  const sites = pickStartSites(raw, G, hashS);
  raw.starts = { version: 1, majors: sites.majors, majorScores: sites.majorScores, candidates: sites.candidates };
  const sortedMajor = sites.majorScores.slice().sort((a, b) => a - b);
  const medianMajor = sortedMajor.length ? sortedMajor[Math.floor(sortedMajor.length / 2)] : 0;
  progress(0.95, 'starts');

  // ---- report ---------------------------------------------------------------------------------------------
  let hills = 0; let mountains = 0; let inRanges = 0; let riverTiles = 0; let lakes = 0; let desert = 0; let cold = 0; let landTiles = 0;
  const groups = {};
  for (let i = 0; i < n; i++) {
    if (!land[i]) continue;
    if (lake[i]) { lakes++; continue; }
    landTiles++;
    if (relief[i] === 1) hills++;
    if (relief[i] === 2) { mountains++; if (tc.range[i] >= 0 && tc.rangeSizes[tc.range[i]] >= 5) inRanges++; }
    if (rivers[i]) riverTiles++;
    if (TERRAIN[terrain[i]] === 'desert') desert++;
    if (TERRAIN[terrain[i]] === 'tundra' || TERRAIN[terrain[i]] === 'snow') cold++;
    if (climate[i] >= 0) { const gname = CLIMATE_NAMES[climate[i]][0]; groups[gname] = (groups[gname] || 0) + 1; }
  }
  const big = massSizes.filter((s) => s >= 300).sort((a, b) => b - a);
  const report = {
    attempt, plates: nP, continentTarget: k, shape,
    landShare: (landTiles + lakes) / n, landTiles, lakes, lakeShare: lakes / Math.max(1, landTiles),
    continents: big.length, largestShare: (massSizes.length ? Math.max(...massSizes) : 0) / Math.max(1, landTiles),
    hillShare: hills / Math.max(1, landTiles), mountainShare: mountains / Math.max(1, landTiles), mountainsInRanges: inRanges / Math.max(1, mountains),
    riverShare: riverTiles / Math.max(1, landTiles), desertShare: desert / Math.max(1, landTiles), coldShare: cold / Math.max(1, landTiles),
    koppenMax: Math.max(0, ...Object.values(groups)) / Math.max(1, landTiles), passes: tc.pass.reduce((a, b) => a + b, 0),
    startSites: sites.majors.length, startCandidates: sites.candidates.length, startRepairs: sites.repairs,
    startMin: sortedMajor[0] ?? 0, startMedian: medianMajor, startSpread: medianMajor ? (medianMajor - (sortedMajor[0] ?? 0)) / medianMajor : 1
  };
  return { raw, report };
};

/** The quality checks of section 8.1 a world must pass (a failed one retries with the next attempt). */
export const qualityProblems = (report, params) => {
  const out = [];
  const coldWorld = params.climate === 'cold';
  if (Math.abs(report.landShare * 100 - params.land) > 0.5) out.push('land share');
  const k = report.continentTarget;
  const shape = report.shape || 'continents';
  if (params.continents ? (report.continents < Math.max(1, k - 1) || report.continents > k + 2) : shape === 'continents' ? (report.continents < 2 || report.continents > 9) : false) out.push('continents');
  if (!params.continents && (shape === 'pangaea' || shape === 'inland') && report.largestShare < 0.55) out.push('continents');
  if (!params.continents && shape === 'islands' && report.largestShare > 0.35) out.push('continents');
  if (!params.continents && shape === 'archipelago' && report.largestShare > 0.5) out.push('continents');
  if (report.mountainShare < 0.03 || report.mountainShare > 0.16) out.push('mountains');
  if (report.riverShare < 0.28 || report.riverShare > 0.47) out.push('rivers');
  if (report.lakeShare > 0.03) out.push('lakes');
  if (report.koppenMax > (coldWorld ? 0.6 : 0.5)) out.push('climate spread');
  if (report.desertShare > 0.3) out.push('desert');
  if (report.coldShare > (coldWorld ? 0.5 : 0.36)) out.push('cold');
  if (report.startSites < MAX_MAJORS || report.startCandidates < 200) out.push('start sites');
  return out;
};

/**
 * Generates a world: { raw, report }. `raw` has tiles.json's shape with typed-array columns (plus
 * `world`, the descriptor with its hash); `grid` is Earth's grid (count, lat, lon, neighbors,
 * frequency, orientation). `onProgress(fraction, stage)` is called along the way.
 */
export const generateWorldV1 = (spec, grid, { onProgress = () => {} } = {}, version = 1) => {
  const seed = spec.seed >>> 0;
  const params = normalizeParams(spec.params);
  let best = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const base = attempt / MAX_ATTEMPTS;
    const res = attemptWorld(grid, seed, params, attempt, (f, stage) => onProgress(base + f / MAX_ATTEMPTS, stage), version);
    const problems = qualityProblems(res.report, params);
    res.report.problems = problems;
    if (!best || problems.length < best.report.problems.length) best = res;
    if (!problems.length) break;
  }
  const { raw, report } = best;
  const worldHash = worldHashOf(raw);
  raw.world = { kind: 'generated', generatorVersion: version, seed, params, attempt: report.attempt, worldHash };
  onProgress(1, 'done');
  return { raw, report: { ...report, worldHash } };
};

// Exposed for the quality tests.
export const _internals = { prepareCorners, hashUnit, attemptWorld };
