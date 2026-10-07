// src/battle/input/placement.js
// Can a building go here? The screen's mirror of the sim's rule (sim/economy.js placementBlock), read
// from the render view so the placement ghost turns green or red as the finger or the mouse moves,
// with a short reason (plans/UI-DESIGN.md section 10). The sim stays the judge: an order it refuses
// does nothing. placement.test.js keeps the two in step on a real battle.
//   placementCheck({ view, setup, side, type, tx, ty, fog }) -> { ok, code, reason }
//   tx, ty: the footprint's top-left tile (the build order's), fog: the player's fog grid or null.
import { BUILDINGS, buildableFor, BUILD_RADIUS_HQ, BUILD_RADIUS_OWN } from '../data/economy';
import { MAX_ECO_BUILDINGS } from '../sim/economy';
import { TILE } from '../setup/mapgen';
import { Q } from '../sim/constants';

const VEINS = new Set(['stone', 'ore', 'gold']);
const GROUND_REASON = {
  [TILE.FOREST]: 'Blocked by trees',
  [TILE.WATER]: 'Cannot build on water',
  [TILE.ROCK]: 'Blocked by rocks',
  [TILE.ROAD]: 'Keep the road clear',
  [TILE.FORD]: 'Cannot build in the ford',
  [TILE.BUILDING]: 'Overlaps a building',
  [TILE.GATE]: 'Overlaps the gate'
};
export const PLACEMENT_REASON = {
  unknown: 'Cannot build that here',
  edge: 'Too close to the edge of the field',
  limit: 'Building limit reached',
  ground: 'Blocked ground',
  crowded: 'Too close to another building',
  node: 'On top of a resource',
  noVein: 'A mine must stand by stone, ore or gold',
  fog: 'You cannot see this ground',
  far: 'Outside your camp area',
  occupied: 'Troops are standing here'
};

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

/** { ok, code, reason } for `side` placing `type` with its top-left tile at (tx, ty). */
export const placementCheck = ({ view, setup, side, type, tx, ty, fog = null }) => {
  const fail = (code, reason = PLACEMENT_REASON[code]) => ({ ok: false, code, reason });
  const def = BUILDINGS[type];
  if (!def || !view?.eco || !buildableFor(setup.sides[side].ageId).includes(type)) return fail('unknown');
  const { map } = setup; const size = def.size;
  if (tx < 1 || ty < 1 || tx + size > map.w - 1 || ty + size > map.h - 1) return fail('edge');
  const buildings = view.eco.buildings;
  if (buildings.filter((b) => b.side === side && b.alive && !BUILDINGS[b.type]?.hq).length >= MAX_ECO_BUILDINGS) return fail('limit');
  const tile = tileAt(view, setup);
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
  if (nodes.some((n) => n.amount !== 0 && n.kind !== 'farm' && near(n, ((size * Q) >> 1) + (Q >> 1)))) return fail('node');
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
  if (fog && fog[Math.floor(cy / Q) * map.w + Math.floor(cx / Q)] !== 2) return fail('fog');
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
