// src/engine/supplyMeter.js
// The supply meter of an army on tiles (plans/civ-map-rework.md, D3; workstream 5). Every land
// unit carries `supply`, 0 to SUPPLY_MAX, and the turn moves it by where the unit stands:
//   home      its own land, a vassal's or an ally's: +SUPPLY_HOME_GAIN a turn, up to the cap
//   held      enemy land it occupies, or next to a city it holds: no change
//   wild      free land: -SUPPLY_WILD_LOSS
//   enemy     enemy land: -SUPPLY_ENEMY_LOSS; -SUPPLY_LINE_LOSS when a supply line reaches it (own
//             land within SUPPLY_LINE_RINGS tiles, more with the supply range modifiers)
// A nation whose supplies stock is empty (supplies.js `hungry`) loses SUPPLY_HUNGER_LOSS more
// everywhere outside home. A stack above the tile's cap (combat width x STACK_WIDTH_MULT units
// of one nation) loses STACK_OVER_LOSS more: big stacks eat the land bare.
// Losses are scaled by the owner's attrition modifier (national.attrition), halved by Forager
// and again by a logistician commander. At 0 the unit starves: STARVE_STRENGTH of its strength
// (floored, so it can die) and STARVE_MORALE morale a turn. Deep sieges are a plan, not a click.
// Ripples: strength feeds every battle; morale feeds morale recovery (resolveTurn) and breaks;
// the national supplies stock (supplies.js) still pays the campaign cost, and when it is empty
// the meter falls faster. Pure of randomness.
import { getTiles } from '../data/geo/tiles';
import { getCombatWidth } from '../data/combatWidth';
import { hasPerk } from '../data/promotions';
import { legacyTerrainOf } from './world/registry';
import { isSettler } from './settlers';
import { tileAccess, unitTile } from './armies';
import { mapEffectsFor } from './techMapEffects';

export const SUPPLY_MAX = 100;
export const SUPPLY_HOME_GAIN = 20;
export const SUPPLY_WILD_LOSS = 10;
export const SUPPLY_ENEMY_LOSS = 20;
export const SUPPLY_LINE_LOSS = 10;
export const SUPPLY_LINE_RINGS = 8;
export const SUPPLY_HUNGER_LOSS = 10;
export const STACK_WIDTH_MULT = 2;
export const STACK_OVER_LOSS = 10;
export const STARVE_STRENGTH = 0.05;
export const STARVE_MORALE = 10;

export const supplyOf = (unit, max = SUPPLY_MAX) => (unit.supply == null ? max : Math.min(max, unit.supply));

/** How many land units of one nation a tile holds without supply trouble. */
export const stackCap = (tiles, tile, extra = 0) => getCombatWidth(legacyTerrainOf(tiles, tile)) * STACK_WIDTH_MULT + extra;

// Own land of `nationId` within `rings` of `tile`, over land (a supply line).
const lineReaches = (state, tiles, tile, nationId, rings) => {
  const tileOwner = state.world?.tileOwner || {};
  const owned = (t) => { const c = tileOwner[t]; return c != null && state.regions[c]?.owner === nationId && !state.regions[c].occupiedBy; };
  let frontier = [tile]; const seen = new Set(frontier);
  for (let d = 0; d <= rings; d++) {
    const next = [];
    for (const t of frontier) {
      if (owned(t)) return true;
      for (const n of tiles.neighbors[t]) if (!seen.has(n) && tiles.land[n]) { seen.add(n); next.push(n); }
    }
    frontier = next;
  }
  return false;
};

/** The zone a unit stands in and this turn's change of its meter, before scaling:
 * { zone: 'home' | 'held' | 'wild' | 'enemy', delta }. */
export const supplyZone = (state, tiles, unit, { lineRings = SUPPLY_LINE_RINGS } = {}) => {
  const tile = unitTile(state, unit);
  if (tile == null) return { zone: 'home', delta: 0 };
  const access = tileAccess(state, tile, unit.ownerId);
  if (access === 'own' || access === 'friend') return { zone: 'home', delta: SUPPLY_HOME_GAIN };
  if (access === 'held' || tiles.neighbors[tile].some((n) => tileAccess(state, n, unit.ownerId) === 'held')) return { zone: 'held', delta: 0 };
  if (access === 'wild' || access === 'closed') return { zone: 'wild', delta: -SUPPLY_WILD_LOSS };
  return { zone: 'enemy', delta: lineReaches(state, tiles, tile, unit.ownerId, lineRings) ? -SUPPLY_LINE_LOSS : -SUPPLY_ENEMY_LOSS };
};

/** Land units of one nation per tile (settlers and cargo aside). */
const stackSizes = (state, units) => {
  const sizes = new Map();
  Object.values(units).forEach((u) => {
    if (u.domain === 'naval' || u.embarkedOn || isSettler(u) || !(u.strength > 0)) return;
    const key = `${u.ownerId}|${unitTile(state, u)}`;
    sizes.set(key, (sizes.get(key) || 0) + 1);
  });
  return sizes;
};

/**
 * The supply phase of a turn on the turn's working `units` (mutated in place, like the other
 * phases). `hungryFor(nationId)`: the nation's supplies stock is empty; `attritionMultFor(nationId)`:
 * its national.attrition multiplier (1 = none); `lineRingsFor(nationId)`: its supply line reach.
 * Returns { starving: Map nationId -> count, dead: Map nationId -> count }.
 */
export const applySupplyMeter = (state, units, { hungryFor = () => false, attritionMultFor = () => 1, lineRingsFor = () => SUPPLY_LINE_RINGS } = {}) => {
  const tiles = getTiles();
  const fxOf = (nationId) => mapEffectsFor(state, nationId); // techs: a wider stack, a bigger meter, longer lines (techMapEffects.js)
  const sizes = stackSizes(state, units);
  const starving = new Map(); const dead = new Map();
  Object.keys(units).sort().forEach((id) => {
    const u = units[id];
    if (!u || u.domain === 'naval' || u.embarkedOn || isSettler(u)) return;
    if (!state.nations[u.ownerId]) return; // rebels live off the land
    const fx = fxOf(u.ownerId);
    const max = SUPPLY_MAX + fx.supplyMax;
    const { zone, delta } = supplyZone(state, tiles, u, { lineRings: lineRingsFor(u.ownerId) + fx.lineRings });
    let change = delta;
    if (zone !== 'home') {
      if (hungryFor(u.ownerId)) change -= SUPPLY_HUNGER_LOSS;
      const tile = unitTile(state, u);
      if (tile != null && (sizes.get(`${u.ownerId}|${tile}`) || 0) > stackCap(tiles, tile, fx.stackCap)) change -= STACK_OVER_LOSS;
      let mult = Math.max(0, attritionMultFor(u.ownerId));
      if (hasPerk(u, 'forager')) mult *= 0.5;
      if (state.hiredCommanders?.[u.commanderId]?.personality === 'logistician') mult *= 0.5;
      change = Math.round(change * mult);
    }
    const supply = Math.max(0, Math.min(max, supplyOf(u, max) + change));
    let next = { ...u, supply };
    if (supply <= 0) {
      const strength = Math.max(0, Math.floor(u.strength * (1 - STARVE_STRENGTH)));
      if (strength <= 0) { delete units[id]; dead.set(u.ownerId, (dead.get(u.ownerId) || 0) + 1); return; }
      next = { ...next, strength, morale: Math.max(0, (u.morale ?? 100) - STARVE_MORALE) };
      starving.set(u.ownerId, (starving.get(u.ownerId) || 0) + 1);
    }
    units[id] = next;
  });
  return { starving, dead };
};
