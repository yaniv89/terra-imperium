// src/battle/setup/economySetup.js
// The battle economy's part of a BattleSetup (phase R1; master plan 6.3, 6.4): where the resource
// nodes lie, where the attacker's expedition camp stands, each side's starting stockpile and the
// housing it starts with. Computed once, before the sim; pure of the battle seed (the same tile is
// always the same ground: the nodes come from the map and the tile, like mapgen.js).
//
// Nodes (Q1, U01): every side gets a safe starter cluster by its base (a grove, stone outcrops, a
// gold vein, herds, fish where there is water) and the middle of the field holds a few contested
// ones (gold, stone, a herd), more or fewer by the tile and its neighbours: woods give groves,
// hills and mountains stone, desert gold and few trees, plains and grassland herds and cattle, a
// coast, river or lake fish. Metal ore is no resource (X29): where an ore spot stood there is
// stone, in every age, so every starter cluster has at least two stone outcrops.
// W12 (the user's ruling of 16 October 2026: every tree is wood, and the field had too few
// resources): every forest tile is a tree worth TREE_WOOD, the trees of a WOOD_CELL square one
// node (woodNodes; a base's grove is trees planted for it), berry bushes join the food, and mirrored
// pairs of stone, gold, herds, berries and fish are scattered over the whole field (scatterPairs).
//
// The attacker's camp (X08) stands CAMP_INSET tiles in from its edge, so its build circle is not
// half off the field.
//
// The campaign seam (R2 builds the full bridge): `inputs` = { supply: [a, d], development: [a, d] }
// in 0..1, from which each side's stockpile multiplier comes (data/economy.js stockMult). With no
// inputs, buildSetupFromArmies reads the supply meter of the units each side brings.
import { createRng } from '../../utils/rng';
import { TILE, isPassable, hashString } from './mapgen';
import { NODE_KINDS, BUILDINGS, RESOURCES, START_STOCK, TREE_WOOD, WOOD_CELL, woodSlots, stockMult, toMilli, CAMP_HOUSING, CAMP_HOUSING_PER_REGIMENT, HALL_HOUSING, MILLI } from '../data/economy';
import { Q } from '../sim/constants';
import { FIRST_AGE_ID } from '../../data/ages';
const SUPPLY_MAX = 100; // src/engine/supplyMeter.js SUPPLY_MAX (not imported: it pulls the tile world into the battle bundle)

const centre = (t) => t * Q + (Q >> 1);
/** How far in from the attacker's edge its camp stands (tiles; X08). */
export const CAMP_INSET = 3;

/** A side's campaign supply as 0..1: the mean supply meter of the units it brings (full when none say). */
export const unitsSupply = (units = []) => {
  const list = units.filter((u) => u && u.strength > 0);
  if (!list.length) return 1;
  return list.reduce((s, u) => s + Math.max(0, Math.min(SUPPLY_MAX, u.supply ?? SUPPLY_MAX)), 0) / (list.length * SUPPLY_MAX);
};

// What the tile and its neighbours add to the node mix.
const terrainMix = (terrain, tileContext) => {
  const near = new Set([terrain, ...(tileContext?.sectors || []).filter((s) => !s.water).map((s) => s.terrain)]);
  const water = !!tileContext?.coastal || (tileContext?.sectors || []).some((s) => s.water || s.river) || terrain === 'island';
  const barren = terrain === 'desert' || terrain === 'arctic';
  const rocky = near.has('mountains') || near.has('hills');
  const grass = near.has('plains') || terrain === 'plains' || terrain === 'mixed';
  return {
    grove: near.has('forest') ? 12 : barren ? 5 : 10, // trees planted by each base (each one TREE_WOOD)
    stone: rocky ? 2 : 1,
    extraStone: near.has('mountains') ? 2 : 1, // where the ore spots stood (X29)
    gold: terrain === 'desert' || near.has('mountains') ? 2 : 1,
    herds: grass ? 2 : 1,
    cattle: terrain === 'plains' || terrain === 'mixed',
    berries: !barren,
    fish: water,
    // W12: the mirrored pairs scattered over the field (scatterPairs)
    scatter: {
      stone: 2 + (rocky ? 2 : 0) + (terrain === 'mountains' ? 1 : 0),
      gold: 1 + (terrain === 'desert' || rocky ? 1 : 0),
      herd: grass ? 2 : 1,
      cattle: grass && terrain !== 'hills' ? 1 : 0,
      berries: barren ? 0 : near.has('forest') || terrain === 'mixed' ? 3 : 2,
      fish: water ? 3 : 0
    }
  };
};

// How far from either headquarters a scattered node must stand (tiles): the build circle's core
// stays free for building (BUILD_RADIUS_HQ is 20; the starter clusters already sit inside it).
export const SCATTER_HQ_GAP = 14;
// How far a mirrored node may slip from the exact mirror tile to find fitting ground (tiles).
export const SCATTER_SLIP = 3;

/**
 * W12: resource nodes scattered over the whole field in pairs, one in each half, the east one on
 * the mirror tile of the west one (x -> w - 1 - x) or within SCATTER_SLIP of it, never inside
 * SCATTER_HQ_GAP of a headquarters. A pair whose mirror finds no fitting ground is not placed, so
 * the halves always hold the same nodes. Fish (water is rarely mirrored) are placed half by half,
 * as many in each as the poorer half allows, plus at most one.
 */
const scatterPairs = ({ w, h, tiles, rng, mix, fits, addNode, hqs, zoneX1 }) => {
  const farFromHq = (x, y) => hqs.every((q) => (x - q.x) ** 2 + (y - q.y) ** 2 >= SCATTER_HQ_GAP * SCATTER_HQ_GAP);
  const nearForest = (i) => [i - 1, i + 1, i - w, i + w].some((j) => tiles[j] === TILE.FOREST);
  const mirrorSpot = (kind, x, y) => {
    for (let r = 0; r <= SCATTER_SLIP; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const mx = w - 1 - x + dx; const my = y + dy;
        if (mx < 2 || my < 2 || mx >= w - 2 || my >= h - 2 || mx <= w / 2) continue;
        if (fits(kind, my * w + mx) && farFromHq(mx, my)) return { x: mx, y: my };
      }
    }
    return null;
  };
  const x0 = Math.min(Math.floor(w / 2) - 6, (zoneX1 ?? 11) + 3); const x1 = Math.floor(w / 2) - 2; // the west half past the attacker's deployment (its mirror is the east half)
  const pair = (kind) => {
    for (let tries = 0; tries < 120; tries++) {
      const x = x0 + Math.floor(rng.next() * (x1 - x0)); const y = 3 + Math.floor(rng.next() * (h - 6));
      const i = y * w + x;
      if (!farFromHq(x, y) || !fits(kind, i)) continue;
      if (kind === 'berries' && tries < 80 && !nearForest(i)) continue; // bushes grow at the wood's edge
      const m = mirrorSpot(kind, x, y);
      if (!m) continue;
      addNode(kind, x, y, true); addNode(kind, m.x, m.y, true);
      return true;
    }
    return false;
  };
  ['stone', 'gold', 'herd', 'cattle', 'berries'].forEach((kind) => { for (let k = 0; k < (mix.scatter[kind] || 0); k++) pair(kind); });
  if (!mix.scatter.fish) return;
  // Fish: shore water in each half, in a seeded order.
  const spots = [[], []];
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x;
    if (tiles[i] === TILE.WATER && fits('fish', i) && farFromHq(x, y)) spots[x < w / 2 ? 0 : 1].push(i);
  }
  const fewest = Math.min(spots[0].length, spots[1].length);
  [0, 1].forEach((half) => {
    const list = spots[half];
    const want = Math.min(mix.scatter.fish, fewest + 1, list.length);
    let placed = 0;
    for (let k = 0; k < 60 && placed < want && list.length; k++) {
      const i = list[Math.floor(rng.next() * list.length)];
      if (!fits('fish', i)) continue;
      addNode('fish', i % w, Math.floor(i / w), true); placed += 1;
    }
  });
};

/**
 * W12, every tree is wood: the forest tiles (not under the city or the camp) of each WOOD_CELL
 * square become one `tree` node of TREE_WOOD a tree. `trees` lists its tiles in the order they are
 * felled, nearest a headquarters first (the edge a laborer reaches first); the node stands on its
 * first standing tree (the sim moves it as trees fall).
 */
export const woodNodes = ({ w, h, tiles, blocked, hqs }) => {
  const out = [];
  const hqDist = (x, y) => Math.min(...hqs.map((q) => (x - q.x) ** 2 + (y - q.y) ** 2));
  for (let cy = 0; cy < h; cy += WOOD_CELL) {
    for (let cx = 0; cx < w; cx += WOOD_CELL) {
      const trees = [];
      for (let y = cy; y < Math.min(h, cy + WOOD_CELL); y++) for (let x = cx; x < Math.min(w, cx + WOOD_CELL); x++) {
        const i = y * w + x;
        if (tiles[i] === TILE.FOREST && !blocked[i] && x > 0 && y > 0 && x < w - 1 && y < h - 1) trees.push(i);
      }
      if (!trees.length) continue;
      const key = trees.map((i) => hqDist(i % w, Math.floor(i / w)));
      const order = trees.map((_, k) => k).sort((a, b) => key[a] - key[b] || trees[a] - trees[b]).map((k) => trees[k]);
      const first = order[0];
      const amount = toMilli(TREE_WOOD) * order.length;
      out.push({
        kind: 'tree', res: 'wood', x: centre(first % w), y: centre(Math.floor(first / w)), tile: first,
        amount, max: amount, slots: woodSlots(order.length), rate: NODE_KINDS.tree.rate, side: -1, radius: Math.round(0.45 * Q),
        trees: order, perTree: toMilli(TREE_WOOD), cut: 0
      });
    }
  }
  return out;
};

// Ground a node may stand on: open, sand or (for groves) forest; never a road, a building or water.
const nodeGround = (t, kind) => (kind === 'fish' ? t === TILE.WATER : t === TILE.OPEN || t === TILE.SAND || (kind === 'tree' && t === TILE.FOREST));

/**
 * Place the economy on a generated map. Writes map.tiles (the camp's footprint becomes BUILDING;
 * a grove on open ground becomes forest). Returns the setup's `economy` object.
 */
export const buildEconomySetup = ({ map, terrain, tileContext = null, regionKey = 'battle', sides, structures, city = null, inputs = null, ageIds = [FIRST_AGE_ID, FIRST_AGE_ID] }) => {
  const { w, h, tiles, keep } = map;
  const rng = createRng(hashString(`eco:${tileContext ? `tile:${tileContext.tile}` : regionKey}`));
  const mix = terrainMix(terrain, tileContext);
  const taken = new Uint8Array(w * h); // tiles a node or the camp already claims (and their margin)
  // The town's own ground is the city's (cityBattle.js): no nodes inside its houses' reach.
  (structures || []).forEach((s) => (s.footprint || []).forEach((c) => { taken[c] = 1; }));
  const claim = (tx, ty, r) => { for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (x >= 0 && y >= 0 && x < w && y < h) taken[y * w + x] = 1; };
  const midY = Math.floor(h / 2);

  // The attacker's expedition camp: in its deployment zone, CAMP_INSET tiles in from its edge (X08:
  // at one tile in, 40% of its build circle lay off the field), off the centre line (the roads).
  const edge = map.attackerEdge || 1;
  const size = BUILDINGS.camp.size;
  let camp = null;
  for (let k = 0; k < 40 && !camp; k++) {
    const dy = (k % 2 ? 1 : -1) * (8 + Math.floor(k / 2));
    const tx = edge + CAMP_INSET; const ty = midY + dy - (size >> 1);
    if (ty < 2 || ty + size > h - 2) continue;
    let ok = true;
    for (let y = ty; y < ty + size && ok; y++) for (let x = tx; x < tx + size && ok; x++) { const t = tiles[y * w + x]; if (!isPassable(t) || t === TILE.ROAD || t === TILE.FORD) ok = false; }
    if (ok) camp = { tx, ty };
  }
  if (!camp) camp = { tx: edge + CAMP_INSET, ty: Math.max(2, midY - 10) };
  const campFootprint = [];
  for (let y = camp.ty; y < camp.ty + size; y++) for (let x = camp.tx; x < camp.tx + size; x++) { campFootprint.push(y * w + x); tiles[y * w + x] = TILE.BUILDING; }
  claim(camp.tx + (size >> 1), camp.ty + (size >> 1), size);

  const nodes = [];
  const anchors = [
    { x: camp.tx + size / 2, y: camp.ty + size / 2, rMin: 3, rMax: 9, xMax: Math.floor(w * 0.3) },
    { x: keep.x, y: keep.y, rMin: city ? 9 + Math.round((city.scale || 0) * 2) : 5, rMax: city ? 22 : 11, xMin: Math.floor(w * 0.62) }
  ];
  const fits = (kind, i) => {
    if (taken[i] || !nodeGround(tiles[i], kind)) return false;
    // A fish shoal must touch the shore (a worker stands on land beside it).
    if (kind === 'fish' && ![i - 1, i + 1, i - w, i + w].some((j) => isPassable(tiles[j]))) return false;
    return true;
  };
  const addNode = (kind, tx, ty, scattered = false) => {
    const i = ty * w + tx; const def = NODE_KINDS[kind];
    claim(tx, ty, 1);
    nodes.push({ id: nodes.length, kind, res: def.res, x: centre(tx), y: centre(ty), tile: i, amount: toMilli(def.amount), max: toMilli(def.amount), slots: def.slots, rate: def.rate, side: -1, radius: Math.round(0.45 * Q), ...(scattered ? { scattered: true } : null) });
    return { x: tx, y: ty };
  };
  // A spot round anchor `a` (or by `near`); `kind` 'tree' plants a tree there (no node of its own:
  // every forest tile becomes wood below).
  const place = (kind, a, near = null) => {
    for (let tries = 0; tries < 160; tries++) {
      let tx; let ty;
      if (near && tries < 40) { tx = near.x + Math.floor(rng.next() * 5) - 2; ty = near.y + Math.floor(rng.next() * 5) - 2; } else {
        const ang = rng.next() * Math.PI * 2; const r = a.rMin + rng.next() * (a.rMax - a.rMin + (tries >> 4));
        tx = Math.round(a.x + Math.cos(ang) * r); ty = Math.round(a.y + Math.sin(ang) * r);
      }
      if (tx < 2 || ty < 2 || tx >= w - 2 || ty >= h - 2) continue;
      if (a.xMax != null && tx > a.xMax) continue;
      if (a.xMin != null && tx < a.xMin) continue;
      const i = ty * w + tx;
      if (kind === 'tree') {
        if (taken[i] || tiles[i] === TILE.FOREST || !nodeGround(tiles[i], kind)) continue;
        tiles[i] = TILE.FOREST; // a grove is woodland
        return { x: tx, y: ty };
      }
      if (!fits(kind, i)) continue;
      return addNode(kind, tx, ty);
    }
    return null;
  };
  const cluster = (a) => {
    // A grove (trees side by side), stone (the old ore spot too), gold, herds, maybe cattle and fish.
    let grove = null;
    for (let k = 0; k < mix.grove; k++) grove = place('tree', a, grove) || grove;
    for (let k = 0; k < mix.stone; k++) place('stone', a);
    place('stone', a); // the old ore spot
    place('gold', a);
    for (let k = 0; k < mix.herds; k++) place('herd', a);
    if (mix.cattle) place('cattle', a);
    if (mix.berries) place('berries', a);
    if (mix.fish) place('fish', { ...a, rMax: a.rMax + 8 });
  };
  anchors.forEach(cluster);
  // The contested middle: worth taking.
  const middle = { x: Math.floor(w / 2), y: midY, rMin: 0, rMax: Math.floor(h / 2) - 4, xMin: Math.floor(w * 0.36), xMax: Math.floor(w * 0.64) };
  for (let k = 0; k < mix.gold + 1; k++) place('gold', middle);
  place('stone', middle);
  for (let k = 0; k < mix.extraStone; k++) place('stone', middle); // the old ore spots
  place('herd', middle);
  let midGrove = null;
  for (let k = 0; k < Math.max(4, mix.grove - 4); k++) midGrove = place('tree', middle, midGrove) || midGrove;
  // Scattered over the field (W12: "not enough resources"): pairs mirrored east-west across the
  // middle, so neither side's half is richer, kept out of both headquarters' build circles.
  scatterPairs({ w, h, tiles, rng, mix, fits, addNode, zoneX1: map.attackerZone?.x1, hqs: [{ x: anchors[0].x, y: anchors[0].y }, { x: keep.x, y: keep.y }] });
  // Every tree is wood (W12): the forest tiles of each WOOD_CELL square, one node.
  const blocked = new Uint8Array(w * h);
  (structures || []).forEach((s) => (s.footprint || []).forEach((c) => { blocked[c] = 1; }));
  campFootprint.forEach((c) => { blocked[c] = 1; });
  woodNodes({ w, h, tiles, blocked, hqs: [{ x: anchors[0].x, y: anchors[0].y }, { x: keep.x, y: keep.y }] }).forEach((n) => nodes.push({ ...n, id: nodes.length }));

  // Stockpiles and housing.
  const supply = inputs?.supply || sides.map((s) => unitsSupply(s.units));
  const development = inputs?.development || [0, 0];
  const stock = [START_STOCK.attacker, START_STOCK.defender].map((base, side) => {
    const m = stockMult(supply[side], development[side]);
    return Object.fromEntries(RESOURCES.map((r) => [r, Math.round((base[r] || 0) * m) * MILLI]));
  });
  const regiments = sides.map((s) => (s.units || []).filter((u) => u.strength > 0).length);
  return {
    version: 3, // 2: four resources (U01), stone where ore stood (X29), the camp further in (X08); 3: every tree is wood, scattered pairs, berries (W12)
    ageIds,
    stock,
    stockMult: [stockMult(supply[0], development[0]), stockMult(supply[1], development[1])],
    nodes,
    camp: { tx: camp.tx, ty: camp.ty, size, footprint: campFootprint, x: centre(camp.tx) + ((size - 1) * Q >> 1), y: centre(camp.ty) + ((size - 1) * Q >> 1) },
    regiments,
    // The housing each side starts with (the camp's 20 and its supply train's 10 a regiment; the
    // defender's town hall and real houses, or a camp's worth in a field battle).
    housing: [CAMP_HOUSING + CAMP_HOUSING_PER_REGIMENT * regiments[0], city ? null : HALL_HOUSING + CAMP_HOUSING_PER_REGIMENT * regiments[1]]
  };
};
