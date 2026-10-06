// src/battle/setup/economySetup.js
// The battle economy's part of a BattleSetup (phase R1; master plan 6.3, 6.4): where the resource
// nodes lie, where the attacker's expedition camp stands, each side's starting stockpile and the
// housing it starts with. Computed once, before the sim; pure of the battle seed (the same tile is
// always the same ground: the nodes come from the map and the tile, like mapgen.js).
//
// Nodes (decision 35): every side gets a safe starter cluster by its base (a grove, stone, ore, a
// gold vein, herds, fish where there is water) and the middle of the field holds a few contested
// ones (gold, stone, ore, a herd), more or fewer by the tile and its neighbours: woods give groves,
// hills and mountains stone and ore, desert gold and few trees, plains and grassland herds and
// cattle, a coast, river or lake fish.
//
// The campaign seam (R2 builds the full bridge): `inputs` = { supply: [a, d], development: [a, d] }
// in 0..1, from which each side's stockpile multiplier comes (data/economy.js stockMult). With no
// inputs, buildSetupFromArmies reads the supply meter of the units each side brings.
import { createRng } from '../../utils/rng';
import { TILE, isPassable, hashString } from './mapgen';
import { NODE_KINDS, BUILDINGS, START_STOCK, stockMult, toMilli, CAMP_HOUSING, CAMP_HOUSING_PER_REGIMENT, HALL_HOUSING, MILLI } from '../data/economy';
import { Q } from '../sim/constants';
const SUPPLY_MAX = 100; // src/engine/supplyMeter.js SUPPLY_MAX (not imported: it pulls the tile world into the battle bundle)

const centre = (t) => t * Q + (Q >> 1);

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
  return {
    trees: near.has('forest') ? 6 : terrain === 'desert' || terrain === 'arctic' ? 2 : 4,
    stone: near.has('mountains') || near.has('hills') ? 2 : 1,
    ore: near.has('mountains') ? 2 : 1,
    gold: terrain === 'desert' || near.has('mountains') ? 2 : 1,
    herds: near.has('plains') || terrain === 'plains' || terrain === 'mixed' ? 2 : 1,
    cattle: terrain === 'plains' || terrain === 'mixed',
    fish: water
  };
};

// Ground a node may stand on: open, sand or (for groves) forest; never a road, a building or water.
const nodeGround = (t, kind) => (kind === 'fish' ? t === TILE.WATER : t === TILE.OPEN || t === TILE.SAND || (kind === 'tree' && t === TILE.FOREST));

/**
 * Place the economy on a generated map. Writes map.tiles (the camp's footprint becomes BUILDING;
 * a grove on open ground becomes forest). Returns the setup's `economy` object.
 */
export const buildEconomySetup = ({ map, terrain, tileContext = null, regionKey = 'battle', sides, structures, city = null, inputs = null, ageIds = ['bronze', 'bronze'] }) => {
  const { w, h, tiles, keep } = map;
  const rng = createRng(hashString(`eco:${tileContext ? `tile:${tileContext.tile}` : regionKey}`));
  const mix = terrainMix(terrain, tileContext);
  const taken = new Uint8Array(w * h); // tiles a node or the camp already claims (and their margin)
  // The town's own ground is the city's (cityBattle.js): no nodes inside its houses' reach.
  (structures || []).forEach((s) => (s.footprint || []).forEach((c) => { taken[c] = 1; }));
  const claim = (tx, ty, r) => { for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (x >= 0 && y >= 0 && x < w && y < h) taken[y * w + x] = 1; };
  const midY = Math.floor(h / 2);

  // The attacker's expedition camp: at the back of its zone, off the centre line (the roads).
  const edge = map.attackerEdge || 1;
  const size = BUILDINGS.camp.size;
  let camp = null;
  for (let k = 0; k < 40 && !camp; k++) {
    const dy = (k % 2 ? 1 : -1) * (8 + Math.floor(k / 2));
    const tx = edge + 1; const ty = midY + dy - (size >> 1);
    if (ty < 2 || ty + size > h - 2) continue;
    let ok = true;
    for (let y = ty; y < ty + size && ok; y++) for (let x = tx; x < tx + size && ok; x++) { const t = tiles[y * w + x]; if (!isPassable(t) || t === TILE.ROAD || t === TILE.FORD) ok = false; }
    if (ok) camp = { tx, ty };
  }
  if (!camp) camp = { tx: edge + 1, ty: Math.max(2, midY - 10) };
  const campFootprint = [];
  for (let y = camp.ty; y < camp.ty + size; y++) for (let x = camp.tx; x < camp.tx + size; x++) { campFootprint.push(y * w + x); tiles[y * w + x] = TILE.BUILDING; }
  claim(camp.tx + (size >> 1), camp.ty + (size >> 1), size);

  const nodes = [];
  const anchors = [
    { x: camp.tx + size / 2, y: camp.ty + size / 2, rMin: 3, rMax: 9, xMax: Math.floor(w * 0.3) },
    { x: keep.x, y: keep.y, rMin: city ? 9 + Math.round((city.scale || 0) * 2) : 5, rMax: city ? 22 : 11, xMin: Math.floor(w * 0.62) }
  ];
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
      if (taken[i] || !nodeGround(tiles[i], kind)) continue;
      // A fish shoal must touch the shore (a worker stands on land beside it).
      if (kind === 'fish' && ![i - 1, i + 1, i - w, i + w].some((j) => isPassable(tiles[j]))) continue;
      const def = NODE_KINDS[kind];
      if (kind === 'tree' && tiles[i] !== TILE.FOREST) tiles[i] = TILE.FOREST; // a grove is woodland
      claim(tx, ty, kind === 'tree' ? 0 : 1);
      nodes.push({ id: nodes.length, kind, res: def.res, x: centre(tx), y: centre(ty), tile: i, amount: toMilli(def.amount), max: toMilli(def.amount), slots: def.slots, rate: def.rate, side: -1, radius: Math.round(0.45 * Q) });
      return { x: tx, y: ty };
    }
    return null;
  };
  const cluster = (a) => {
    // A grove (trees side by side), stone, ore, gold, herds, maybe cattle and fish.
    let grove = null;
    for (let k = 0; k < mix.trees; k++) grove = place('tree', a, grove) || grove;
    for (let k = 0; k < mix.stone; k++) place('stone', a);
    place('ore', a);
    place('gold', a);
    for (let k = 0; k < mix.herds; k++) place('herd', a);
    if (mix.cattle) place('cattle', a);
    if (mix.fish) place('fish', { ...a, rMax: a.rMax + 8 });
  };
  anchors.forEach(cluster);
  // The contested middle: worth taking.
  const middle = { x: Math.floor(w / 2), y: midY, rMin: 0, rMax: Math.floor(h / 2) - 4, xMin: Math.floor(w * 0.36), xMax: Math.floor(w * 0.64) };
  for (let k = 0; k < mix.gold + 1; k++) place('gold', middle);
  place('stone', middle);
  for (let k = 0; k < mix.ore; k++) place('ore', middle);
  place('herd', middle);
  let midGrove = null;
  for (let k = 0; k < Math.max(2, mix.trees - 2); k++) midGrove = place('tree', middle, midGrove) || midGrove;

  // Stockpiles and housing.
  const supply = inputs?.supply || sides.map((s) => unitsSupply(s.units));
  const development = inputs?.development || [0, 0];
  const stock = [START_STOCK.attacker, START_STOCK.defender].map((base, side) => {
    const m = stockMult(supply[side], development[side]);
    return { food: Math.round(base.food * m) * MILLI, materials: Math.round(base.materials * m) * MILLI, gold: Math.round(base.gold * m) * MILLI };
  });
  const regiments = sides.map((s) => (s.units || []).filter((u) => u.strength > 0).length);
  return {
    version: 1,
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
