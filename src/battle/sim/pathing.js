// src/battle/sim/pathing.js
// Ground movement support (Tactical Battles plan §8.2): flow fields for routing around rock,
// water and buildings (one integer Dijkstra per destination tile, shared by every squad heading
// there and cached), a cheap straight-line walkability test so open-ground moves skip the field
// entirely, and a spatial hash for neighbour queries.
import { TILE_COST } from '../setup/mapgen';
import { Q } from './constants';
import { makeGrid, rebuildGrid, sortInts } from './spatial';

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];
const STEP = [10, 10, 10, 10, 14, 14, 14, 14];
const UNREACHED = 0xffff;
const CACHE_LIMIT = 24;

export const tileOf = (map, x, y) => {
  const tx = Math.max(0, Math.min(map.w - 1, Math.floor(x / Q)));
  const ty = Math.max(0, Math.min(map.h - 1, Math.floor(y / Q)));
  return ty * map.w + tx;
};

export const tileCostAt = (map, x, y) => TILE_COST[map.tiles[tileOf(map, x, y)]];

// Integer Dijkstra from the goal outward with a 64-bucket queue.
export const buildFlowField = (map, goalIdx) => {
  const { w, h, tiles } = map;
  const cost = new Uint16Array(w * h).fill(UNREACHED);
  const buckets = Array.from({ length: 64 }, () => []);
  cost[goalIdx] = 0;
  buckets[0].push(goalIdx);
  let pending = 1;
  for (let b = 0; pending > 0; b = (b + 1) & 63) {
    const bucket = buckets[b];
    while (bucket.length) {
      const i = bucket.pop(); pending -= 1;
      const x = i % w; const y = (i - x) / w;
      for (let k = 0; k < 8; k++) {
        const nx = x + DX[k]; const ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        const tc = TILE_COST[tiles[j]];
        if (!tc) continue;
        // No corner-cutting between two impassable orthogonal neighbours.
        if (k >= 4 && (!TILE_COST[tiles[y * w + nx]] || !TILE_COST[tiles[ny * w + x]])) continue;
        const c = cost[i] + ((STEP[k] * tc) >> 3);
        if (c < cost[j]) { cost[j] = c; buckets[c & 63].push(j); pending += 1; }
      }
    }
  }
  return cost;
};

// A destination inside an impassable tile (the keep's footprint, a building block) is replaced by
// the nearest walkable tile — otherwise the flow field could never leave the obstacle and every
// squad ordered there would just stand still.
export const walkableGoal = (map, goalIdx) => {
  if (TILE_COST[map.tiles[goalIdx]]) return goalIdx;
  const gx = goalIdx % map.w; const gy = (goalIdx - gx) / map.w;
  for (let r = 1; r <= 6; r++) {
    let best = -1; let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = gx + dx; const y = gy + dy;
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
        const i = y * map.w + x;
        const d = dx * dx + dy * dy;
        if (TILE_COST[map.tiles[i]] && (d < bestD || (d === bestD && i < best))) { best = i; bestD = d; }
      }
    }
    if (best >= 0) return best;
  }
  return goalIdx;
};

export const getFlowField = (w, rawGoalIdx) => {
  const goalIdx = walkableGoal(w.map, rawGoalIdx);
  if (!w.flowCache) w.flowCache = new Map();
  const cached = w.flowCache.get(goalIdx);
  if (cached) return cached;
  const field = buildFlowField(w.map, goalIdx);
  if (w.flowCache.size >= CACHE_LIMIT) w.flowCache.delete(w.flowCache.keys().next().value);
  w.flowCache.set(goalIdx, field);
  return field;
};

// The next waypoint (tile centre) from (x, y) toward the field's goal, or null if unreachable.
export const nextWaypoint = (w, field, x, y) => {
  const { map } = w;
  const i = tileOf(map, x, y);
  const tx = i % map.w; const ty = (i - tx) / map.w;
  let best = field[i]; let bestJ = -1;
  for (let k = 0; k < 8; k++) {
    const nx = tx + DX[k]; const ny = ty + DY[k];
    if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
    const j = ny * map.w + nx;
    if (field[j] < best) { best = field[j]; bestJ = j; }
  }
  if (bestJ < 0) return null;
  const bx = bestJ % map.w; const by = (bestJ - bx) / map.w;
  return { x: bx * Q + (Q >> 1), y: by * Q + (Q >> 1) };
};

// Blocked-tile prefix sums per map (the tiles never change during a battle): how many impassable
// tiles a rectangle holds, in four reads. Kept beside the map, not on it, so setups stay plain data.
const blockedSums = new WeakMap();
const blockedPrefix = (map) => {
  let sums = blockedSums.get(map.tiles);
  if (sums) return sums;
  const { w, h, tiles } = map;
  const W = w + 1;
  sums = new Int32Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += TILE_COST[tiles[y * w + x]] ? 0 : 1;
      sums[(y + 1) * W + x + 1] = sums[y * W + x + 1] + row;
    }
  }
  blockedSums.set(map.tiles, sums);
  return sums;
};
/** Forget the blocked-tile sums after the map's tiles change (a city structure fell to rubble). */
export const invalidateBlocked = (map) => { blockedSums.delete(map.tiles); };
const clampTile = (v, n) => Math.max(0, Math.min(n - 1, Math.floor(v / Q)));

// Is the straight segment walkable (sampled every half tile)? Every sample lies in the box of tiles
// between the two ends, so a box with no impassable tile answers yes at once; only a box with an
// obstacle in it is sampled.
export const lineClear = (map, x0, y0, x1, y1) => {
  const ax = clampTile(Math.min(x0, x1), map.w); const bx = clampTile(Math.max(x0, x1), map.w);
  const ay = clampTile(Math.min(y0, y1), map.h); const by = clampTile(Math.max(y0, y1), map.h);
  const sums = blockedPrefix(map); const W = map.w + 1;
  if (sums[(by + 1) * W + bx + 1] - sums[ay * W + bx + 1] - sums[(by + 1) * W + ax] + sums[ay * W + ax] === 0) return true;
  const dx = x1 - x0; const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (Q >> 1)));
  for (let s = 1; s <= steps; s++) {
    const x = x0 + Math.trunc((dx * s) / steps); const y = y0 + Math.trunc((dy * s) / steps);
    if (!TILE_COST[map.tiles[tileOf(map, x, y)]]) return false;
  }
  return true;
};

// Squads in a packed grid (spatial.js) of 2x2-tile cells, rebuilt after movement each tick, in
// place of the old Map of 8x8-tile cell arrays. The rule of a query stays the old one, so every
// query finds exactly the squads it found before: a squad counts if the 8x8 cell it stood in at the
// build touches the query box, and it is within the radius where it stands NOW (squads nudged
// since the build by separation or garrisons included). The fine cells nest inside the old ones
// (8 / 2 = 4), so the old cell test is a range of fine cells.
export const SPATIAL_CELL = 8 * Q;
const CELL = SPATIAL_CELL;
const FINE = 2 * Q;
export const SPATIAL_PER = CELL / FINE;
const PER = SPATIAL_PER;
const inGrid = (q) => q.alive && q.onField;
export const buildSpatialHash = (w) => {
  w.spatial = rebuildGrid(w.spatial && w.spatial.cell === FINE && !w.spatial.bySide ? w.spatial : makeGrid(FINE), w.squads, inGrid);
};

// Squad indices within `radius` of (x, y), in ascending index order (deterministic).
// (separateSquads in movement.js runs its own local version of this rule.)
export const queryRadius = (w, x, y, radius) => {
  const g = w.spatial;
  if (!g || !g.n) return [];
  const r2 = radius * radius;
  const { squads } = w;
  if (!g.scratch || g.scratch.length < g.n) g.scratch = new Int32Array(Math.max(16, g.n * 2));
  const buf = g.scratch;
  let n = 0;
  const { cx0, cy0, cols, rows, start, items } = g;
  // The old 8x8 cells the box touches, as ranges of fine cells.
  const ax = Math.max(Math.floor((x - radius) / CELL) * PER - cx0, 0); const bx = Math.min((Math.floor((x + radius) / CELL) + 1) * PER - 1 - cx0, cols - 1);
  const ay = Math.max(Math.floor((y - radius) / CELL) * PER - cy0, 0); const by = Math.min((Math.floor((y + radius) / CELL) + 1) * PER - 1 - cy0, rows - 1);
  for (let cy = ay; cy <= by; cy++) {
    for (let c = cy * cols + ax, cEnd = cy * cols + bx; c <= cEnd; c++) {
      for (let s = start[c], end = start[c + 1]; s < end; s++) {
        const i = items[s];
        const q = squads[i];
        const ddx = q.x - x; const ddy = q.y - y;
        if (ddx * ddx + ddy * ddy <= r2) buf[n++] = i;
      }
    }
  }
  sortInts(buf, n);
  return Array.from(buf.subarray(0, n));
};

// Target finding (combat.js acquireTarget) asks "which ENEMIES are within my sight?" for every
// squad: a finer grid split by side, so the scan never walks through the squad's own army. Built
// at the start of acquireTargets, when nobody has moved since, so it finds exactly the squads a
// full radius query would.
const TARGET_CELL = 4 * Q;
export const buildTargetGrid = (w) => {
  w.targetGrid = rebuildGrid(w.targetGrid && w.targetGrid.cell === TARGET_CELL ? w.targetGrid : makeGrid(TARGET_CELL, true), w.squads, inGrid);
  return w.targetGrid;
};
