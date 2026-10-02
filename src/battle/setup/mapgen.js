// src/battle/setup/mapgen.js
// Procedural battlefields (Tactical Battles plan §7). A map is a pure function of the REGION (and
// its terrain type / combat width), never of the battle seed — so the same province is always the
// same battlefield, however many times it is fought over. Canonical orientation: the attacker
// enters from the WEST edge (x = 0), the defender's keep stands near the EAST edge.
import { createRng } from '../../utils/rng';
import { sectorAt } from './tileContext';

export const TILE = { OPEN: 0, FOREST: 1, WATER: 2, ROCK: 3, ROAD: 4, SAND: 5, FORD: 6, BUILDING: 7 };
// Movement cost per tile in eighths (8 = normal); 0 = impassable for ground units.
export const TILE_COST = [8, 11, 0, 0, 6, 10, 13, 0];
export const isPassable = (tile) => TILE_COST[tile] > 0;

export const hashString = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

// Bilinear value noise on an integer lattice, 0..1023 — integer maths only.
const valueNoise = (rng, w, h, cell) => {
  const gw = Math.ceil(w / cell) + 2; const gh = Math.ceil(h / cell) + 2;
  const grid = Array.from({ length: gw * gh }, () => Math.floor(rng.next() * 1024));
  const out = new Int16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = Math.floor(x / cell); const gy = Math.floor(y / cell);
      const fx = Math.floor(((x % cell) * 1024) / cell); const fy = Math.floor(((y % cell) * 1024) / cell);
      const a = grid[gy * gw + gx]; const b = grid[gy * gw + gx + 1];
      const c = grid[(gy + 1) * gw + gx]; const d = grid[(gy + 1) * gw + gx + 1];
      const top = a + (((b - a) * fx) >> 10); const bot = c + (((d - c) * fx) >> 10);
      out[y * w + x] = top + (((bot - top) * fy) >> 10);
    }
  }
  return out;
};

// Value such that `frac` of the noise lies above it.
const quantileAbove = (noise, frac) => {
  if (frac <= 0) return 2048;
  const sorted = Int16Array.from(noise).sort();
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - frac))))];
};

export const TEMPLATES = {
  plains: { cell: 16, forest: 0.08, rock: 0, sand: 0, heightAmp: 1 },
  mixed: { cell: 12, forest: 0.18, rock: 0.02, sand: 0, stream: true, heightAmp: 1 },
  hills: { cell: 9, forest: 0.1, rock: 0.05, sand: 0, heightAmp: 4 },
  forest: { cell: 10, forest: 0.55, rock: 0, sand: 0, lanes: 3, heightAmp: 1 },
  mountains: { cell: 8, forest: 0.05, rock: 0.08, sand: 0, pass: true, heightAmp: 6 },
  desert: { cell: 14, forest: 0, rock: 0.03, sand: 0.45, oasis: true, heightAmp: 2 },
  arctic: { cell: 14, forest: 0.03, rock: 0.05, sand: 0.6, lake: true, heightAmp: 2 },
  urban: { cell: 16, forest: 0, rock: 0, sand: 0, blocks: true, heightAmp: 0 },
  island: { cell: 12, forest: 0.12, rock: 0.02, sand: 0, coast: true, heightAmp: 1 }
};

export const getMapSize = (combatWidth) => ({ w: 64 + combatWidth * 8, h: 48 + combatWidth * 4 });

const carveDisc = (tiles, w, h, cx, cy, r, tile = TILE.OPEN, onlyImpassable = false) => {
  for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue;
      const i = y * w + x;
      if (onlyImpassable && isPassable(tiles[i])) continue;
      tiles[i] = tile;
    }
  }
};

// Walk a straight-ish line between two tiles, stamping a corridor of `halfWidth`.
const carveLine = (tiles, w, h, x0, y0, x1, y1, halfWidth, tile, { onlyImpassable = false, keepWaterAsFord = false } = {}) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let s = 0; s <= steps; s++) {
    const cx = Math.round(x0 + ((x1 - x0) * s) / steps); const cy = Math.round(y0 + ((y1 - y0) * s) / steps);
    for (let dy = -halfWidth; dy <= halfWidth; dy++) {
      for (let dx = -halfWidth; dx <= halfWidth; dx++) {
        const x = cx + dx; const y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        if (tiles[i] === TILE.BUILDING && tile !== TILE.OPEN) continue;
        if (onlyImpassable && isPassable(tiles[i])) continue;
        tiles[i] = keepWaterAsFord && tiles[i] === TILE.WATER ? TILE.FORD : tile;
      }
    }
  }
};

// Breadth-first reachability over passable tiles.
export const reachable = (tiles, w, h, fromX, fromY, toX, toY) => {
  const start = fromY * w + fromX; const goal = toY * w + toX;
  if (!isPassable(tiles[start])) return false;
  const seen = new Uint8Array(w * h); const queue = [start]; seen[start] = 1;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    if (i === goal) return true;
    const x = i % w; const y = (i - x) / w;
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of next) if (j >= 0 && !seen[j] && isPassable(tiles[j])) { seen[j] = 1; queue.push(j); }
  }
  return false;
};

// The outer band of the field belongs to the six neighbouring tiles (tileContext.js): each sector
// takes its neighbour's ground (forest, rock for mountains, sand for desert, a sea with a beach for
// water), and a river on the edge between the tile and a neighbour runs across that sector's inner
// rim with a ford or two. The middle of the field stays the tile's own template.
export const SECTOR_INNER = 0.55; // of the half-diagonal: where a neighbour's ground begins
const SECTOR_TEMPLATES = {
  forest: { forest: 0.6, rock: 0 }, hills: { forest: 0.15, rock: 0.06 }, mountains: { forest: 0.05, rock: 0.35 },
  desert: { forest: 0, rock: 0.03, sand: 0.7 }, arctic: { forest: 0.02, rock: 0.08, sand: 0.5 }, plains: { forest: 0.04, rock: 0 },
  mixed: { forest: 0.15, rock: 0.02 }, urban: { forest: 0, rock: 0 }, island: { forest: 0.1, rock: 0 }
};
const paintSectors = (tiles, heightNoise, forestNoise, w, h, ctx, rng) => {
  const cx = (w - 1) / 2; const cy = (h - 1) / 2;
  const half = Math.hypot(cx, cy);
  const riverFords = new Map();
  ctx.sectors.forEach((s) => { if (s.river) riverFords.set(s.tile, [rng.next(), rng.next()]); });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx; const dy = cy - y; // y grows south on the map, north is up
      const d = Math.hypot(dx, dy) / half;
      if (d < SECTOR_INNER - 0.08) continue;
      const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const s = sectorAt(ctx.sectors, deg);
      if (!s) continue;
      const i = y * w + x;
      // A river on this edge: a band of water across the sector's inner rim, with fords.
      if (s.river && d >= SECTOR_INNER - 0.08 && d < SECTOR_INNER + 0.02) {
        const [f1, f2] = riverFords.get(s.tile);
        const along = ((deg - s.bearing + 540) % 360 - 180) / 60; // -0.5..0.5 across the sector
        const ford = Math.abs(along - (f1 - 0.5) * 0.8) < 0.07 || Math.abs(along - (f2 - 0.5) * 0.8) < 0.07;
        tiles[i] = ford ? TILE.FORD : TILE.WATER;
        continue;
      }
      if (d < SECTOR_INNER) continue;
      if (s.water) {
        // The sea (or a lake) fills the sector beyond a beach.
        if (d >= SECTOR_INNER + 0.22) tiles[i] = TILE.WATER;
        else if (d >= SECTOR_INNER + 0.14) tiles[i] = TILE.SAND;
        continue;
      }
      const t = SECTOR_TEMPLATES[s.terrain] || SECTOR_TEMPLATES.mixed;
      const fn = forestNoise[i]; const hn = heightNoise[i];
      if (t.rock && hn >= 1024 * (1 - t.rock)) tiles[i] = TILE.ROCK;
      else if (t.forest && fn >= 1024 * (1 - t.forest)) tiles[i] = TILE.FOREST;
      else if (t.sand && (fn + hn) / 2 >= 1024 * (1 - t.sand)) tiles[i] = TILE.SAND;
      else if (tiles[i] !== TILE.OPEN) tiles[i] = TILE.OPEN;
    }
  }
};

// regionId drives the whole layout; terrain/combatWidth pick the template and size; `features`
// (deposit capture points, road count, keep radius) come from the region's real strategic data.
// `landing`: an amphibious assault (T9). The attacker's (west) edge becomes open sea with a sand
// beach in front of it; the invaders deploy on the sand and fall back to their boats.
export const LANDING_SEA_COLS = 5;
export const generateMap = ({ regionId, terrain, combatWidth, pointCount = 0, roads = 1, landing = false, tileContext = null }) => {
  const { w, h } = getMapSize(combatWidth);
  const tpl = TEMPLATES[terrain] || TEMPLATES.mixed;
  // On the tile world the ground is the tile's: the same tile is always the same battlefield.
  const rng = createRng(hashString(tileContext ? `map:tile:${tileContext.tile}` : `map:${regionId}`));
  const heightNoise = valueNoise(rng, w, h, tpl.cell);
  const forestNoise = valueNoise(rng, w, h, Math.max(5, tpl.cell - 3));
  const sandNoise = valueNoise(rng, w, h, tpl.cell + 4);
  const tiles = new Uint8Array(w * h);
  const forestAt = quantileAbove(forestNoise, tpl.forest);
  const rockAt = quantileAbove(heightNoise, tpl.rock);
  const sandAt = quantileAbove(sandNoise, tpl.sand);
  for (let i = 0; i < w * h; i++) {
    if (tpl.rock && heightNoise[i] >= rockAt) tiles[i] = TILE.ROCK;
    else if (tpl.forest && forestNoise[i] >= forestAt) tiles[i] = TILE.FOREST;
    else if (tpl.sand && sandNoise[i] >= sandAt) tiles[i] = TILE.SAND;
  }

  const midY = Math.floor(h / 2);
  if (tileContext?.sectors?.length) paintSectors(tiles, heightNoise, forestNoise, w, h, tileContext, rng);
  if (tpl.pass) {
    // Two impassable massifs with a single pass through the middle (combat width 3 by design).
    const passHalf = 3 + Math.floor(rng.next() * 3);
    const passCenter = midY + Math.floor(rng.next() * 7) - 3;
    for (let y = 0; y < h; y++) {
      for (let x = 14; x < w - 22; x++) {
        const edge = Math.floor((heightNoise[y * w + x] - 512) / 160);
        if (Math.abs(y - passCenter) > passHalf + edge) tiles[y * w + x] = TILE.ROCK;
      }
    }
  }
  if (tpl.lanes) {
    for (let l = 0; l < tpl.lanes; l++) {
      const ly = Math.floor(((l + 1) * h) / (tpl.lanes + 1)) + Math.floor(rng.next() * 5) - 2;
      carveLine(tiles, w, h, 0, ly, w - 1, ly + Math.floor(rng.next() * 9) - 4, 1, TILE.OPEN);
    }
  }
  if (tpl.stream) {
    // A north-south stream across the middle of the field, crossable at two fords.
    const sx = Math.floor(w * 0.45);
    const fords = [Math.floor(h * 0.3), Math.floor(h * 0.7)];
    for (let y = 0; y < h; y++) {
      const x = sx + Math.floor((heightNoise[y * w + sx] - 512) / 200);
      for (let dx = 0; dx < 2; dx++) {
        const isFord = fords.some((fy) => Math.abs(y - fy) <= 1);
        tiles[y * w + x + dx] = isFord ? TILE.FORD : TILE.WATER;
      }
    }
  }
  if (tpl.oasis || tpl.lake) {
    const cx = Math.floor(w * (0.35 + rng.next() * 0.25)); const cy = Math.floor(h * (0.2 + rng.next() * 0.6));
    carveDisc(tiles, w, h, cx, cy, tpl.lake ? 5 : 3, TILE.WATER);
  }
  if (tpl.coast) {
    for (let x = 0; x < w; x++) {
      const top = 3 + Math.floor((heightNoise[x] - 512) / 256); const bot = 3 + Math.floor((heightNoise[(h - 1) * w + x] - 512) / 256);
      for (let y = 0; y < h; y++) {
        if (y < top || y >= h - bot) tiles[y * w + x] = TILE.WATER;
        else if (y < top + 2 || y >= h - bot - 2) tiles[y * w + x] = TILE.SAND;
      }
    }
  }
  if (tpl.blocks) {
    // A street grid of impassable building blocks, with a few open plazas.
    for (let by = 4; by < h - 6; by += 8) {
      for (let bx = Math.floor(w * 0.28); bx < w - 20; bx += 8) {
        if (rng.next() < 0.2) continue; // plaza
        for (let y = by; y < by + 5; y++) for (let x = bx; x < bx + 5; x++) tiles[y * w + x] = TILE.BUILDING;
      }
    }
  }

  // Keep and deploy zones are always clear ground.
  const keep = { x: w - 14, y: midY };
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < 12; x++) if (tiles[y * w + x] !== TILE.WATER || !tpl.coast) tiles[y * w + x] = TILE.OPEN;
  carveDisc(tiles, w, h, keep.x, keep.y, 9, TILE.OPEN);
  for (let y = keep.y - 1; y <= keep.y + 1; y++) for (let x = keep.x - 1; x <= keep.x + 1; x++) tiles[y * w + x] = TILE.BUILDING;

  // Capture points (the region's real resource deposits) in the middle band.
  const points = [];
  for (let p = 0; p < pointCount; p++) {
    const px = Math.floor(w * (0.38 + rng.next() * 0.28));
    const py = Math.floor(h * (0.18 + ((p + rng.next() * 0.6) / Math.max(1, pointCount)) * 0.64));
    carveDisc(tiles, w, h, px, Math.min(h - 3, Math.max(2, py)), 2, TILE.OPEN);
    points.push({ x: px, y: Math.min(h - 3, Math.max(2, py)) });
  }

  // Roads from the attacker's edge toward the keep (more infrastructure → more roads); water
  // crossings become fords.
  for (let r = 0; r < roads; r++) {
    const startY = r === 0 ? midY : Math.floor(h * (r % 2 ? 0.25 : 0.75));
    carveLine(tiles, w, h, 0, startY, keep.x - 3, keep.y + (r === 0 ? 0 : (r % 2 ? -3 : 3)), 0, TILE.ROAD, { keepWaterAsFord: true });
  }

  // Guarantee: the keep can always be reached from the attacker's zone.
  if (!reachable(tiles, w, h, 6, midY, keep.x - 4, keep.y)) {
    carveLine(tiles, w, h, 6, midY, keep.x - 4, keep.y, 1, TILE.OPEN, { onlyImpassable: true });
  }
  points.forEach((pt) => {
    if (!reachable(tiles, w, h, 6, midY, pt.x, pt.y)) carveLine(tiles, w, h, 6, midY, pt.x, pt.y, 1, TILE.OPEN, { onlyImpassable: true });
  });

  if (landing) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < LANDING_SEA_COLS; x++) tiles[y * w + x] = TILE.WATER;
      for (let x = LANDING_SEA_COLS; x < LANDING_SEA_COLS + 3; x++) tiles[y * w + x] = TILE.SAND;
    }
  }

  const height = new Int16Array(w * h);
  for (let i = 0; i < w * h; i++) height[i] = Math.floor(((heightNoise[i] - 512) * tpl.heightAmp) / 8);
  if (tileContext?.sectors?.length) {
    // Hills and mountains beyond the rim rise, water sinks.
    const cx = (w - 1) / 2; const cy = (h - 1) / 2; const half = Math.hypot(cx, cy);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, cy - y) / half; if (d < SECTOR_INNER) continue;
      const s = sectorAt(tileContext.sectors, ((Math.atan2(cy - y, x - cx) * 180) / Math.PI + 360) % 360);
      if (!s) continue;
      const i = y * w + x; const rise = Math.min(1, (d - SECTOR_INNER) / 0.4);
      if (s.water) height[i] = Math.min(height[i], 0);
      else if (s.terrain === 'mountains') height[i] += Math.round(rise * 160);
      else if (s.terrain === 'hills') height[i] += Math.round(rise * 60);
    }
  }
  if (landing) for (let y = 0; y < h; y++) for (let x = 0; x < LANDING_SEA_COLS + 3; x++) height[y * w + x] = Math.min(0, height[y * w + x]);
  const attackerEdge = landing ? LANDING_SEA_COLS : 1; // the tile x the attacker enters on and falls back to
  return { w, h, tiles, height, keep, points, landing, attackerEdge, attackerZone: { x0: attackerEdge, y0: 2, x1: 11, y1: h - 3 } };
};
