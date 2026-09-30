// src/battle/sim/pathing.js
// Ground movement support (Tactical Battles plan §8.2): flow fields for routing around rock,
// water and buildings (one integer Dijkstra per destination tile, shared by every squad heading
// there and cached), a cheap straight-line walkability test so open-ground moves skip the field
// entirely, and a spatial hash for neighbour queries.
import { TILE_COST } from '../setup/mapgen';
import { Q } from './constants';

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

export const getFlowField = (w, goalIdx) => {
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

// Is the straight segment walkable (sampled every half tile)?
export const lineClear = (map, x0, y0, x1, y1) => {
  const dx = x1 - x0; const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (Q >> 1)));
  for (let s = 1; s <= steps; s++) {
    const x = x0 + Math.trunc((dx * s) / steps); const y = y0 + Math.trunc((dy * s) / steps);
    if (!TILE_COST[map.tiles[tileOf(map, x, y)]]) return false;
  }
  return true;
};

// Squads bucketed into 8×8-tile cells, rebuilt every tick.
const CELL = 8 * Q;
export const buildSpatialHash = (w) => {
  const cells = new Map();
  w.squads.forEach((q) => {
    if (!q.alive || !q.onField) return;
    const key = Math.floor(q.x / CELL) * 4096 + Math.floor(q.y / CELL);
    let list = cells.get(key);
    if (!list) { list = []; cells.set(key, list); }
    list.push(q.idx);
  });
  w.spatial = cells;
};

// Squad indices within `radius` of (x, y), in ascending index order (deterministic).
export const queryRadius = (w, x, y, radius) => {
  const out = [];
  const r2 = radius * radius;
  const cx0 = Math.floor((x - radius) / CELL); const cx1 = Math.floor((x + radius) / CELL);
  const cy0 = Math.floor((y - radius) / CELL); const cy1 = Math.floor((y + radius) / CELL);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const list = w.spatial.get(cx * 4096 + cy);
      if (!list) continue;
      for (const i of list) {
        const q = w.squads[i];
        const ddx = q.x - x; const ddy = q.y - y;
        if (ddx * ddx + ddy * ddy <= r2) out.push(i);
      }
    }
  }
  return out.sort((a, b) => a - b);
};
