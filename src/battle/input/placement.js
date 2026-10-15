// src/battle/input/placement.js
// Can a building go here? The screen's mirror of the sim's rule (sim/economy.js placementBlock), read
// from the render view so the placement ghost turns green or red as the finger or the mouse moves,
// with a short reason (plans/UI-DESIGN.md section 10). The sim stays the judge: an order it refuses
// does nothing. placement.test.js keeps the two in step on a real battle.
//   placementCheck({ view, setup, side, type, tx, ty, fog }) -> { ok, code, reason }
//   tx, ty: the footprint's top-left tile (the build order's), fog: the player's fog grid or null.
import { BUILDINGS, RESOURCES, buildableFor, BUILD_RADIUS_HQ, BUILD_RADIUS_OWN } from '../data/economy';
import { MAX_ECO_BUILDINGS, NODE_PAD } from '../sim/economy';
import { TILE } from '../setup/mapgen';
import { Q } from '../sim/constants';
import { t } from '../../i18n/core';

// A table of reasons whose text is read when asked, so it follows the language (keys: bt.place.*).
const reasons = (map) => Object.defineProperties({}, Object.fromEntries(Object.entries(map).map(([k, key]) => [k, { enumerable: true, get: () => t(key) }])));

const VEINS = new Set(['stone', 'gold']);
const GROUND_REASON = reasons({
  [TILE.FOREST]: 'bt.place.forest',
  [TILE.WATER]: 'bt.place.water',
  [TILE.ROCK]: 'bt.place.rock',
  [TILE.ROAD]: 'bt.place.road',
  [TILE.FORD]: 'bt.place.ford',
  [TILE.BUILDING]: 'bt.place.building',
  [TILE.GATE]: 'bt.place.gate'
});
export const PLACEMENT_REASON = reasons(Object.fromEntries(['unknown', 'edge', 'limit', 'ground', 'crowded', 'node', 'noVein', 'fog', 'far', 'occupied', 'outside', 'workers', 'cost', 'refused'].map((k) => [k, `bt.place.${k}`])));

// The map's tiles as the sim has them now: the setup's ground, every standing building's footprint
// claimed (economy.js claimFootprint), broken city works turned to rubble (cityStructures.js).
const tileAt = (view, setup) => {
  const { map } = setup;
  const claimed = new Map();
  (view.eco?.buildings || []).forEach((b) => {
    if (!b.alive || b.proxy) return;
    for (let y = b.ty; y < b.ty + b.size; y++) for (let x = b.tx; x < b.tx + b.size; x++) claimed.set(y * map.w + x, TILE.BUILDING);
  });
  (view.structures || []).forEach((s, i) => {
    if (s.alive) return;
    (setup.structures?.[i]?.footprint || []).forEach((c) => { const t = map.tiles[c]; if (t === TILE.BUILDING || t === TILE.GATE) claimed.set(c, TILE.RUBBLE); });
  });
  return (i) => (claimed.has(i) ? claimed.get(i) : map.tiles[i]);
};

/** "Needs 70 more stone and 20 more gold", or null when `stock` (whole units, RESOURCES order) pays `cost`. */
export const shortfallText = (cost, stock) => {
  const short = RESOURCES.map((r, i) => [r, Math.max(0, (cost?.[r] || 0) - (stock?.[i] || 0))]).filter(([, v]) => v > 0);
  if (!short.length) return null;
  const parts = short.map(([r, v]) => `${v} more ${r}`);
  return `Needs ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`}`;
};

/**
 * { ok, code, reason } for `side` placing `type` with its top-left tile at (tx, ty). With `stock`
 * (the view's whole units) the price is checked too ('cost'), with `workers` the laborers
 * ('workers'): the sim's build order refuses both (I181: the reason shows next to Build here).
 */
export const placementCheck = ({ view, setup, side, type, tx, ty, fog = null, stock = null, workers = null }) => {
  const fail = (code, reason = PLACEMENT_REASON[code]) => ({ ok: false, code, reason });
  const def = BUILDINGS[type];
  if (!def || !view?.eco || !buildableFor(setup.sides[side].ageId).includes(type)) return fail('unknown');
  if (workers === 0) return fail('workers');
  const shortText = stock ? shortfallText(def.cost, stock) : null;
  const ground = groundCheck({ view, setup, side, type, tx, ty, fog });
  if (!ground.ok) return ground;
  return shortText ? fail('cost', shortText) : ground;
};

/** The legal footprint centres for `type` around (cx, cy) within `radius` tiles: a Uint8Array over
 *  the map, 1 where a footprint centred on that tile can go (I173: the tint while placing). */
export const legalArea = ({ view, setup, side, type, fog = null, cx, cy, radius }) => {
  const { map } = setup; const size = BUILDINGS[type]?.size || 1;
  const out = new Uint8Array(map.w * map.h);
  const tileFn = tileAt(view, setup);
  for (let y = Math.max(0, cy - radius); y <= Math.min(map.h - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(map.w - 1, cx + radius); x++) {
      const { tx, ty } = footprintAt(type, x + 0.5, y + 0.5);
      if (groundCheck({ view, setup, side, type, tx, ty, fog, tileFn }).ok) out[y * map.w + x] = 1;
    }
  }
  return { cells: out, size };
};

const groundCheck = ({ view, setup, side, type, tx, ty, fog = null, tileFn = null }) => {
  const fail = (code, reason = PLACEMENT_REASON[code]) => ({ ok: false, code, reason });
  const def = BUILDINGS[type];
  const { map } = setup; const size = def.size;
  if (tx < 1 || ty < 1 || tx + size > map.w - 1 || ty + size > map.h - 1) return fail('edge');
  const buildings = view.eco.buildings;
  if (buildings.filter((b) => b.side === side && b.alive && !BUILDINGS[b.type]?.hq).length >= MAX_ECO_BUILDINGS) return fail('limit');
  const tile = tileFn || tileAt(view, setup);
  for (let y = ty; y < ty + size; y++) {
    for (let x = tx; x < tx + size; x++) {
      const t = tile(y * map.w + x);
      if (t !== TILE.OPEN && t !== TILE.SAND && t !== TILE.RUBBLE) return fail('ground', GROUND_REASON[t] || PLACEMENT_REASON.ground);
    }
  }
  for (let y = ty - 1; y <= ty + size; y++) {
    for (let x = tx - 1; x <= tx + size; x++) {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
      if (tile(y * map.w + x) === TILE.BUILDING) return fail('crowded');
    }
  }
  const cx = tx * Q + ((size * Q) >> 1); const cy = ty * Q + ((size * Q) >> 1); // economy.js footprintCentre
  const nodes = view.eco.nodes;
  const near = (n, r) => Math.abs(n.x - cx) <= r && Math.abs(n.y - cy) <= r;
  if (nodes.some((n) => n.amount !== 0 && n.kind !== 'farm' && near(n, NODE_PAD(size)))) return fail('node');
  if (def.mine) {
    // The vein a standing mine works is the one nearest to it (economy.js 'build').
    const taken = new Set();
    buildings.forEach((b) => {
      if (!b.alive || b.type !== 'mine') return;
      let best = -1; let bestD = Infinity;
      nodes.forEach((n) => { if (VEINS.has(n.kind) && n.amount !== 0) { const d = (n.x - b.x) ** 2 + (n.y - b.y) ** 2; if (d < bestD) { bestD = d; best = n.i; } } });
      taken.add(best);
    });
    if (!nodes.some((n) => VEINS.has(n.kind) && n.amount !== 0 && near(n, ((size * Q) >> 1) + 2 * Q) && !taken.has(n.i))) return fail('noVein');
  }
  if (fog && fog[Math.floor(cy / Q) * map.w + Math.floor(cx / Q)] < 1) return fail('fog');
  const reach = buildings.some((b) => b.side === side && b.built && b.alive && ((b.x - cx) ** 2 + (b.y - cy) ** 2 <= ((BUILDINGS[b.type]?.hq ? BUILD_RADIUS_HQ : BUILD_RADIUS_OWN) * Q) ** 2));
  if (!reach) return fail('far');
  const half = (size * Q) >> 1;
  if ((view.squads || []).some((o) => o.alive && o.onField && o.classId !== 'air' && (o.x - cx) ** 2 + (o.y - cy) ** 2 <= half * half && Math.abs(o.x - cx) < half && Math.abs(o.y - cy) < half)) return fail('occupied');
  return { ok: true, code: null, reason: null };
};

/** The footprint's top-left tile for a building centred on a ground point (tiles). */
export const footprintAt = (type, gx, gz) => {
  const size = BUILDINGS[type]?.size || 1;
  return { size, tx: Math.round(gx - size / 2), ty: Math.round(gz - size / 2) };
};
