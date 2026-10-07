// src/battle/setup/cityBattle.js
// A city assault loads the real city (plans/MASTER-PLAN.md phase B; the world plan sections 7 to
// 10): every structure of the city's manifest (src/data/townLayout.js, from the city record by
// src/engine/cityManifest.js) stands on the battlefield with its manifest id, HP and the tiles it
// blocks, in its state from earlier battles (damaged at half HP, ruined as rubble).
//
// The transform (documented, the same for every city): the town's model space (1 unit = 10 m, x
// east, z south) is scaled by CITY_TILES_PER_UNIT battle tiles per unit and turned a quarter so
// the town's gate (its front, model south) faces the attacker, who always comes from the west
// (tileContext.js turns the land the same way):
//   tile x = keep x + 0.5 - z * S        tile y = keep y + 0.5 + x * S
// So the town's north lies east, behind the keep. The keep is the town hall (the objective).
// A main street three tiles wide runs from the gate to the keep and is never built over; the
// town's ground inside its walls is cleared of wood and rock (water stays).
//
// The town hall reads as THE main building (art plan row town-hall, 20 x 20 m): `hallPlacement`
// gives its drawn size in tiles by the town's size (small 4.2, medium and big 5.5), never into a
// landmark or a region building: it may stand up to 3 tiles off the centre (east, behind, or to
// a side; never toward the gate) to stay clear of them, and shrinks only when it must (never
// under the old 3 tiles; a shrunk hall stands taller, `hallLift`, so it still towers over the
// houses). A capital's hall stays centred (its palace stands there, drawn at least as large).
// The keep structure stands at the hall's centre, blocks the cells under it (3 x 3, or 5 x 5 for
// a 5-tile hall; the old 3 x 3 keep's cells outside it are opened) and reaches its walls (radius).
// The town model's houses the hall overlaps are cut out of the drawing and its shadows (`underHall`)
// and claim no ground; they stay in the manifest (housing, ids) as the hall's own quarters.
//
// Roles (world plan 8): houses, the town model's landmarks, the palace and wonders are passive
// (HP and footprint only); the region's buildings keep their battle effects (sim/buildings.js);
// the wall ring blocks the ground (its segments can be breached), the gate is open; towers fire.
import { TILE, isPassable, reachable } from './mapgen';
import { manifestHousing } from '../../data/townLayout';
import { Q, secondsToTicks } from '../sim/constants';

export const CITY_TILES_PER_UNIT = 2.75;
// Material by the age the city is built in (world plan 10: mud brick 1, masonry 1.4, concrete 2).
export const MATERIAL_BY_AGE = { bronze: 1, classical: 1.4, kingdoms: 1.4, gunpowder: 1.4, modern: 2 };
// Base HP (world plan 10): a small dwelling 800, a larger one 1,400, a shop-sized one 1,600, a
// civic landmark 2,400, the palace and wonders 5,000; walls and the gate by the fortification level.
export const HOUSE_HP = [[0.45, 800], [0.9, 1400], [Infinity, 1600]];
export const LANDMARK_HP = 2400;
export const PALACE_HP = 5000;
export const WONDER_HP = 5000;
export const wallHp = (fortLevel) => 500 + 250 * fortLevel;
export const gateHp = (fortLevel) => 800 + 300 * fortLevel;
// The reach of the town in model units beyond its wall ring (the buildings outside it).
const OUTSIDE_WALL = 2.9;
const RING_HALF = 0.75; // half the wall band, tiles
// The town hall's drawn size by town size (tiles; 5.5 tiles = 20 m) and the smallest it gets.
export const HALL_TILES = { small: 4.2, medium: 5.5, big: 5.5 };
const HALL_MIN = 3;

const HALL_SHIFTS = [0, 0.5, 1, 1.5, 2, 2.5, 3];
// A manifest rectangle in battle tiles about the keep's centre (the quarter turn: tile x = -z,
// tile y = x; the sides swap).
const tileRect = (st, S) => ({ cx: -st.z * S, cy: st.x * S, hx: (st.d * S) / 2, hy: (st.w * S) / 2 });

/**
 * Where the town hall stands and how big it is drawn, in battle tiles about the keep's centre:
 * { size, ox, oy } (ox east along tile x, oy along tile y). The tier's size where it fits clear of
 * the town's landmarks and the region's buildings (0.1 tile apart), centred when it can, else
 * shifted up to 3 tiles (never west, toward the gate; a capital's never) and, failing that,
 * shrunk. A shift must win at least 0.1 tile of size. Exact arithmetic on manifest numbers.
 */
export const hallPlacement = (manifest, S = CITY_TILES_PER_UNIT) => {
  const want = HALL_TILES[manifest?.tierId] || HALL_TILES.small;
  const obstacles = (manifest?.structures || []).filter((st) => st.kind === 'landmark' || st.kind === 'building').map((st) => tileRect(st, S));
  let best = { size: HALL_MIN, ox: 0, oy: 0 }; let bestHalf = -1;
  const offsets = [];
  const shifts = manifest?.structures?.some((st) => st.kind === 'palace') ? [0] : HALL_SHIFTS;
  shifts.forEach((ox) => shifts.forEach((ay) => [ay, -ay].forEach((oy, k) => { if (k === 0 || ay > 0) offsets.push([ox, oy]); })));
  offsets.sort((a, b) => Math.max(a[0], Math.abs(a[1])) - Math.max(b[0], Math.abs(b[1])) || a[0] + Math.abs(a[1]) - b[0] - Math.abs(b[1]));
  offsets.forEach(([ox, oy]) => {
    const room = obstacles.reduce((m, o) => Math.min(m, Math.max(Math.abs(o.cx - ox) - o.hx, Math.abs(o.cy - oy) - o.hy) - 0.1), Infinity);
    const half = Math.min(want / 2, room);
    if (half < HALL_MIN / 2 || half < bestHalf + 0.05) return;
    bestHalf = half; best = { size: Math.round(2 * half * 100) / 100, ox, oy };
  });
  return best;
};
/** The town hall's drawn size in battle tiles (hallPlacement). */
export const hallSize = (manifest, S = CITY_TILES_PER_UNIT) => hallPlacement(manifest, S).size;

/** How far in from the east edge the keep must stand so the whole town fits (tiles). */
export const cityKeepInset = (manifest) => {
  const r = { small: 2.25, medium: 3.3, big: 4.4 }[manifest?.tierId] || 2.25;
  return Math.max(14, Math.ceil((r + OUTSIDE_WALL) * CITY_TILES_PER_UNIT) + 2);
};

const centre = (t) => Math.round(t * Q);

/**
 * Place the manifest's structures on the map (writes map.tiles). `keepStructures`: the keep and
 * towers from buildStructures (the keep stays first: the objective). Returns { structures, city }.
 */
export const placeCity = ({ map, manifest, damage = null, fortLevel = 0, keepStructures }) => {
  const S = CITY_TILES_PER_UNIT;
  const { w, h, tiles, keep } = map;
  const kx = keep.x + 0.5; const ky = keep.y + 0.5;
  const toTile = (x, z) => ({ tx: kx - z * S, ty: ky + x * S });
  const ruined = damage?.ruined || {}; const damaged = damage?.damaged || {};
  const mat = MATERIAL_BY_AGE[manifest.ageId] || 1;
  const owner = new Int32Array(w * h).fill(-1); // which structure blocks a tile
  const inMap = (i, j) => i >= 1 && j >= 1 && i < w - 1 && j < h - 1;
  const ringR = manifest.structures.filter((s) => s.kind === 'wall' || s.kind === 'gate').reduce((m, s) => Math.max(m, Math.sqrt(s.x * s.x + s.z * s.z)), 0) * S;
  const townR = (ringR || ({ small: 2.25, medium: 3.3, big: 4.4 }[manifest.tierId] || 2.25) * S) + 1;

  // The town's ground: cleared of wood, rock and sand (water and roads stay), the main street kept.
  for (let j = Math.floor(ky - townR); j <= Math.ceil(ky + townR); j++) {
    for (let i = Math.floor(kx - townR); i <= Math.ceil(kx + townR); i++) {
      if (!inMap(i, j)) continue;
      const dx = i + 0.5 - kx; const dy = j + 0.5 - ky;
      if (dx * dx + dy * dy > townR * townR) continue;
      const t = tiles[j * w + i];
      if (t === TILE.FOREST || t === TILE.ROCK || t === TILE.SAND) tiles[j * w + i] = TILE.OPEN;
    }
  }
  const street = (i, j) => Math.abs(j + 0.5 - ky) <= 1.6 && i + 0.5 <= kx && i + 0.5 >= kx - townR - 1;
  // The town hall (see the header): where it stands, its drawn size, the cells it blocks, its reach.
  const { size: hall, ox, oy } = hallPlacement(manifest, S);
  const hx0 = kx + ox; const hy0 = ky + oy; const half = hall / 2;
  const core = (i, j) => Math.abs(i - keep.x) <= 1 && Math.abs(j - keep.y) <= 1;
  const keepCell = (i, j) => Math.abs(i + 0.5 - hx0) <= half - 0.3 && Math.abs(j + 0.5 - hy0) <= half - 0.3;
  const underHall = (st) => { const r = tileRect(st, S); return Math.abs(r.cx - ox) < r.hx + half - 0.15 && Math.abs(r.cy - oy) < r.hy + half - 0.15; };

  const structures = [keepStructures[0]];
  const want = HALL_TILES[manifest.tierId] || HALL_TILES.small;
  const hallLift = hall < want ? Math.round(Math.min(1.45, Math.sqrt(want / hall)) * 100) / 100 : 1;
  Object.assign(keepStructures[0], {
    x: centre(hx0), y: centre(hy0), hall, hallLift, w: hall, d: hall,
    radius: Math.max(keepStructures[0].radius, Math.round(half * Q))
  });
  keepStructures[0].manifestId = 'townhall';
  for (let j = Math.floor(hy0 - half); j <= Math.ceil(hy0 + half); j++) {
    for (let i = Math.floor(hx0 - half); i <= Math.ceil(hx0 + half); i++) {
      if (!inMap(i, j) || !keepCell(i, j) || tiles[j * w + i] === TILE.WATER) continue;
      tiles[j * w + i] = TILE.BUILDING; owner[j * w + i] = 0;
    }
  }
  // the map's own 3 x 3 keep (mapgen.js) where the hall stepped off it: open ground again
  for (let j = keep.y - 1; j <= keep.y + 1; j++) for (let i = keep.x - 1; i <= keep.x + 1; i++) if (core(i, j) && !keepCell(i, j) && tiles[j * w + i] === TILE.BUILDING) tiles[j * w + i] = TILE.OPEN;
  // Housing in battle (master plan 6.3; the battle economy reads it, src/battle/sim/economy.js).
  keepStructures[0].housing = manifest.structures.find((st) => st.kind === 'townhall')?.housing || 0;
  const claim = (cells, si) => cells.filter((c) => owner[c] < 0 && tiles[c] !== TILE.WATER).map((c) => { owner[c] = si; return c; });
  const rectCells = (tx, ty, hx, hy) => {
    const out = [];
    for (let j = Math.floor(ty - hy); j <= Math.ceil(ty + hy); j++) {
      for (let i = Math.floor(tx - hx); i <= Math.ceil(tx + hx); i++) {
        if (!inMap(i, j) || keepCell(i, j) || street(i, j)) continue;
        if (Math.abs(i + 0.5 - tx) <= hx * 0.9 && Math.abs(j + 0.5 - ty) <= hy * 0.9) out.push(j * w + i);
      }
    }
    const ci = Math.floor(tx); const cj = Math.floor(ty);
    if (!out.length && inMap(ci, cj) && !keepCell(ci, cj) && !street(ci, cj)) out.push(cj * w + ci);
    return out;
  };
  const add = (st, base) => {
    const { tx, ty } = toTile(st.x, st.z);
    const hx = (st.d * S) / 2; const hy = (st.w * S) / 2; // the quarter turn swaps the sides
    const maxHp = Math.round(base);
    const s = {
      id: st.kind === 'building' ? `b_${st.category}` : st.id, manifestId: st.id, kind: st.kind,
      x: centre(Math.max(1, Math.min(w - 1, tx))), y: centre(Math.max(1, Math.min(h - 1, ty))),
      radius: Math.max(Q >> 1, Math.round(Math.max(hx, hy) * Q * 0.9)),
      w: st.d * S, d: st.w * S, h: st.h * S, maxHp, hp: maxHp, range: 0, attackTicks: secondsToTicks(1.5), damage: 0, cooldown: 0, alive: true,
      model: [st.x, st.z, st.w, st.d], // its ground in the town model's space (the renderer cuts ruins out of the town file)
      passive: !!st.passive, ...(st.housing ? { housing: st.housing } : {}), ...(st.category ? { category: st.category, tier: st.tier, name: st.name } : {}), ...(st.projectId ? { projectId: st.projectId } : {})
    };
    if (st.kind === 'house' && underHall(st)) s.underHall = true;
    s.footprint = st.kind === 'wall' || st.kind === 'gate' || s.underHall ? [] : claim(rectCells(tx, ty, hx, hy), structures.length);
    structures.push(s);
    return s;
  };

  // Towers first (they fire), on the ring; then the ring's segments by the nearest segment centre.
  const towers = manifest.structures.filter((s) => s.kind === 'tower');
  if (towers.length) {
    // as many armed as the fortification level gives (buildStructures, the battle's balance); the
    // rest of the ring's towers stand unarmed (HP only) until the level arms them
    const armed = keepStructures.length - 1;
    towers.forEach((st, i) => {
      const t = add(st, 800 + 200 * fortLevel);
      Object.assign(t, { id: `tower${i}`, radius: Math.round(0.8 * Q), range: 7 * Q, damage: i < armed ? 8 + 4 * fortLevel : 0 });
    });
  } else keepStructures.slice(1).forEach((t) => structures.push(t));
  const segs = manifest.structures.filter((s) => s.kind === 'wall' || s.kind === 'gate');
  const segIdx = segs.map((st) => add(st, st.kind === 'gate' ? gateHp(fortLevel) : wallHp(fortLevel)));
  if (segs.length) {
    const centres = segs.map((st) => toTile(st.x, st.z));
    for (let j = Math.floor(ky - ringR - 1); j <= Math.ceil(ky + ringR + 1); j++) {
      for (let i = Math.floor(kx - ringR - 1); i <= Math.ceil(kx + ringR + 1); i++) {
        if (!inMap(i, j)) continue;
        const dx = i + 0.5 - kx; const dy = j + 0.5 - ky;
        if (Math.abs(Math.sqrt(dx * dx + dy * dy) - ringR) > RING_HALF) continue;
        let best = 0; let bestD = Infinity;
        centres.forEach((c, k) => { const d = (c.tx - i - 0.5) ** 2 + (c.ty - j - 0.5) ** 2; if (d < bestD) { bestD = d; best = k; } });
        const c = j * w + i;
        if (owner[c] >= 0 || tiles[c] === TILE.WATER) continue;
        const s = segIdx[best];
        owner[c] = structures.indexOf(s);
        if (s.kind === 'wall') s.footprint.push(c); // the gate stays open ground
      }
    }
  }
  // Then buildings, the palace, the town's landmarks, wonders, and the houses.
  const ORDER = ['building', 'palace', 'landmark', 'wonder', 'house'];
  ORDER.forEach((kind) => manifest.structures.filter((st) => st.kind === kind).forEach((st) => {
    const area = st.w * st.d;
    const base = kind === 'house' ? HOUSE_HP.find(([a]) => area < a)[1] * mat
      : kind === 'building' ? 600 + 150 * (st.tier || 0)
        : kind === 'palace' ? PALACE_HP * mat : kind === 'wonder' ? WONDER_HP * mat : LANDMARK_HP * mat;
    add(st, base);
  }));

  // Block the ground; earlier damage: ruined (rubble, no HP) or damaged (half HP).
  structures.forEach((s) => {
    if (!s.manifestId || s.manifestId === 'townhall') return;
    const isRuin = !!ruined[s.manifestId];
    (s.footprint || []).forEach((c) => { tiles[c] = isRuin ? TILE.RUBBLE : TILE.BUILDING; });
    if (isRuin) { s.hp = 0; s.alive = false; s.ruinedAtStart = true; } else if (damaged[s.manifestId]) s.hp = Math.max(1, Math.round(s.maxHp / 2));
  });
  // The attacker can always reach the gate and the keep (a coast or a river may still close the
  // street): carve the street open if it is not.
  const midY = keep.y;
  const front = Math.min(keep.x - 1, Math.floor(hx0 - half + 0.3)); // the hall's first cell from the west
  if (!reachable(tiles, w, h, 6, midY, front - 1, keep.y)) {
    for (let i = 1; i < front; i++) for (let j = midY - 1; j <= midY + 1; j++) if (!isPassable(tiles[j * w + i]) && owner[j * w + i] < 0) tiles[j * w + i] = TILE.OPEN;
  }
  return {
    structures,
    city: {
      cityId: manifest.cityId, townKey: manifest.townKey, ageId: manifest.ageId, tierId: manifest.tierId, style: manifest.style,
      scale: S, housingCap: manifestHousing(manifest, ruined), structureCount: structures.length - 1
    }
  };
};
