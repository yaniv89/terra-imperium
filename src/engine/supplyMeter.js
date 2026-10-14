// src/engine/supplyMeter.js
// The supply meter of an army on tiles (plans/civ-map-rework.md, D3; workstream 5). Every land
// unit carries `supply`, 0 to SUPPLY_MAX, and the turn moves it by where the unit stands:
//   home      its own land, a vassal's or an ally's: +SUPPLY_HOME_GAIN a turn, up to the cap
//   held      enemy land it occupies, or next to a city it holds: no change
//   wild      free land: -SUPPLY_WILD_LOSS
//   enemy     enemy land: -SUPPLY_ENEMY_LOSS; -SUPPLY_LINE_LOSS when a supply line reaches it (own
//             land within SUPPLY_LINE_RINGS tiles (SUPPLY_LINE_KM), more with the supply range modifiers)
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
import { isSettler, isExplorer } from './settlers';
import { tileAccess, unitTile } from './armies';
import { mapEffectsFor } from './techMapEffects';
import { ringsForKm, ringsFromF75 } from '../data/geo/gridScale';
import { getModifier } from './modifiers/sheet';
import { getEffectiveAgeId } from '../data/ages';
import { computeSupplyFlow } from './supplies';

export const SUPPLY_MAX = 100;
export const SUPPLY_HOME_GAIN = 50; // home land refills a stack in two turns (plans/playtest-1.md P2.2)
export const SUPPLY_WILD_LOSS = 10;
export const SUPPLY_ENEMY_LOSS = 20;
export const SUPPLY_LINE_LOSS = 10;
export const SUPPLY_LINE_KM = 816; // km (8 rings at frequency 75)
export const SUPPLY_LINE_RINGS = ringsForKm(SUPPLY_LINE_KM);
export const ROAD_LINE_BONUS_KM = 204; // a stack on a road is reached by a line about 200 km further
export const ROAD_LINE_BONUS = ringsForKm(ROAD_LINE_BONUS_KM);
export const SUPPLY_LOW = 30; // the next prompt warns under this while the meter falls
export const SUPPLY_HUNGER_LOSS = 10;
export const STACK_WIDTH_MULT = 2;
export const STACK_OVER_LOSS = 10;
export const STARVE_STRENGTH = 0.05;
export const STARVE_MORALE = 10;
// A unit this many turns in a row at an empty meter is flagged by the state audit (a warning, not
// a broken invariant: starving is legal, a long run of it is worth a look. Playtest audit I004).
export const LONG_STARVE_TURNS = 10;

export const supplyOf = (unit, max = SUPPLY_MAX) => (unit.supply == null ? max : Math.min(max, unit.supply));

/** How many land units of one nation a tile holds without supply trouble. */
export const stackCap = (tiles, tile, extra = 0) => getCombatWidth(legacyTerrainOf(tiles, tile)) * STACK_WIDTH_MULT + extra;

// The ring distance over land from `tile` to the nearest own land of `nationId`, or null past
// `maxRings` (0 on own land).
export const lineDistance = (state, tiles, tile, nationId, maxRings) => {
  const tileOwner = state.world?.tileOwner || {};
  const owned = (t) => { const c = tileOwner[t]; return c != null && state.regions[c]?.owner === nationId && !state.regions[c].occupiedBy; };
  let frontier = [tile]; const seen = new Set(frontier);
  for (let d = 0; d <= maxRings; d++) {
    const next = [];
    for (const t of frontier) {
      if (owned(t)) return d;
      for (const n of tiles.neighbors[t]) if (!seen.has(n) && tiles.land[n]) { seen.add(n); next.push(n); }
    }
    frontier = next;
  }
  return null;
};
/** The line's reach from `tile`: the base rings plus ROAD_LINE_BONUS on an unburnt road. */
export const lineRingsAt = (state, tile, rings) => rings + (state.world?.tileState?.[tile]?.road && !state.world?.tileState?.[tile]?.pillaged ? ROAD_LINE_BONUS : 0);

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
  return { zone: 'enemy', delta: lineReaches(state, tiles, tile, unit.ownerId, lineRingsAt(state, tile, lineRings)) ? -SUPPLY_LINE_LOSS : -SUPPLY_ENEMY_LOSS };
};

/**
 * This turn's real change of a unit's meter: the zone's delta, then, outside home land, hunger
 * (the nation's supplies stock is empty), an over-full stack, the owner's attrition modifier, and
 * the unit's Forager perk and logistician general. The ONE formula: the turn (applySupplyMeter)
 * and the forecast (supplyReport) both call it, so the sheet's "a turn" is what the turn does
 * (playtest audit I005). `stackSize`: the nation's land units on the unit's tile.
 * Returns { zone, delta (the zone alone), change (what the meter moves by), hungry, overStack, mult }.
 */
export const supplyChange = (state, tiles, unit, { lineRings = SUPPLY_LINE_RINGS, hungry = false, stackSize = 0, stackCapExtra = 0, attritionMult = 1 } = {}) => {
  const { zone, delta } = supplyZone(state, tiles, unit, { lineRings });
  if (zone === 'home') return { zone, delta, change: delta, hungry: false, overStack: false, mult: 1 };
  let change = delta;
  if (hungry) change -= SUPPLY_HUNGER_LOSS;
  const tile = unitTile(state, unit);
  const overStack = tile != null && stackSize > stackCap(tiles, tile, stackCapExtra);
  if (overStack) change -= STACK_OVER_LOSS;
  let mult = Math.max(0, attritionMult);
  if (hasPerk(unit, 'forager')) mult *= 0.5;
  if (state.hiredCommanders?.[unit.commanderId]?.personality === 'logistician') mult *= 0.5;
  return { zone, delta, change: Math.round(change * mult), hungry: !!hungry, overStack, mult };
};

/** What the army sheet says about a stack's supply (plans/playtest-1.md P2.2): the meter, this
 * turn's real change (supplyChange: the same number the turn applies), the turns left, whether it
 * starves, the distance to your border, the line's reach and the lever to pull.
 * `hungry`, `attritionMult`, `stackCapExtra`: as the turn passes them (resolveTurn's supply phase). */
export const supplyReport = (state, unit, { lineRings = SUPPLY_LINE_RINGS, max = SUPPLY_MAX, hungry = false, attritionMult = 1, stackCapExtra = 0 } = {}) => {
  const tiles = getTiles();
  const tile = unitTile(state, unit);
  const stackSize = tile == null ? 0 : Object.values(state.units || {}).filter((u) => u.ownerId === unit.ownerId && u.domain !== 'naval' && !u.embarkedOn && !isSettler(u) && !isExplorer(u) && u.strength > 0 && unitTile(state, u) === tile).length;
  const { zone, delta, change, overStack } = supplyChange(state, tiles, unit, { lineRings, hungry, stackSize, stackCapExtra, attritionMult });
  const reach = tile != null ? lineRingsAt(state, tile, lineRings) : lineRings;
  const borderDistance = tile != null ? lineDistance(state, tiles, tile, unit.ownerId, reach + 6) : 0;
  const supply = supplyOf(unit, max);
  const starving = supply <= 0 && zone !== 'home';
  const turnsLeft = change < 0 && supply > 0 ? Math.ceil(supply / -change) : null;
  let hint;
  if (zone === 'home') hint = supply >= max ? 'Fully supplied in your own land.' : 'In your land: the meter refills, full in two turns.';
  else if (zone === 'held') hint = 'Holding enemy land you have taken: the meter holds.';
  else if (zone === 'wild') hint = 'In the wilderness: the meter drains slowly. A march home refills it.';
  else if (delta === -SUPPLY_LINE_LOSS) hint = `A supply line from your border (${borderDistance} tile${borderDistance === 1 ? '' : 's'} away, a line reaches ${reach}) halves the drain of enemy land; it does not refill the meter. A Road Post or a road would reach further.`;
  else hint = borderDistance == null ? `Far beyond your border: no supply line reaches here (a line reaches ${reach} tiles). March back or take a city to hold.` : `Your border is ${borderDistance} tiles away and a line reaches only ${reach}: the stack drains fast. A Road Post at the border or a road under the army reaches ${reach + ROAD_LINE_BONUS}; taking the city here would hold the meter.`;
  if (hungry && zone !== 'home') hint += ' Your supplies stock is empty: every army abroad drains faster.';
  if (overStack) hint += ' Too many units on this tile: the stack eats the land bare.';
  // The line the sheet shows: the meter, the real change, and what an empty meter costs.
  const pct = Math.round(STARVE_STRENGTH * 100);
  const text = starving
    ? `Supply 0/${max}: starving. The stack loses ${pct}% of its strength and ${STARVE_MORALE} morale every turn, and takes no recruits, until it stands in your own land. ${hint}`
    : `Supply ${Math.round(supply)}/${max}, ${change >= 0 ? '+' : ''}${change} a turn${turnsLeft != null ? ` (${turnsLeft} turn${turnsLeft === 1 ? '' : 's'} until it starves)` : ''}. ${hint}`;
  return { supply, max, delta, change, zone, borderDistance, reach, turnsLeft, starving, starvedTurns: unit.starvedTurns || 0, overStack, hint, text };
};

/** Land units of one nation per tile (settlers and cargo aside). */
const stackSizes = (state, units) => {
  const sizes = new Map();
  Object.values(units).forEach((u) => {
    if (u.domain === 'naval' || u.embarkedOn || isSettler(u) || isExplorer(u) || !(u.strength > 0)) return;
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
    if (!u || u.domain === 'naval' || u.embarkedOn || isSettler(u) || isExplorer(u)) return;
    if (!state.nations[u.ownerId]) return; // rebels live off the land
    const fx = fxOf(u.ownerId);
    const max = SUPPLY_MAX + fx.supplyMax;
    const { change } = supplyChange(state, tiles, u, {
      lineRings: lineRingsFor(u.ownerId) + ringsForKm(fx.lineRings, { min: 0 }),
      hungry: hungryFor(u.ownerId), stackSize: sizes.get(`${u.ownerId}|${unitTile(state, u)}`) || 0, stackCapExtra: fx.stackCap, attritionMult: attritionMultFor(u.ownerId)
    });
    const supply = Math.max(0, Math.min(max, supplyOf(u, max) + change));
    // `starvedTurns`: turns in a row at an empty meter (stateAudit.js warns on a long run of them);
    // written only for a unit that starves or has starved, so a fed unit's record is untouched.
    let next = { ...u, supply, ...(supply <= 0 ? { starvedTurns: (u.starvedTurns || 0) + 1 } : u.starvedTurns ? { starvedTurns: 0 } : {}) };
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

/**
 * The Military tab's supply summary (ECON-02): the armies on campaign, the armies at home, what the
 * national stock pays next turn and how fast the meters fall. It reads the turn's own selectors
 * and nothing else: computeSupplyFlow with the turn's arguments (campaigning, consumed, hungry:
 * the stock) and applySupplyMeter's per-unit supplyChange (abroad, draining, starving), so the
 * tab can never say "0 campaigning" over a hungry army.
 * Returns { campaigning, home, abroad, draining, starving, drain, produced, consumed, marching, stock, hungry, metalId }.
 */
export const armySupplySummary = (state, nationId = state.playerNationId) => {
  const tiles = getTiles();
  const flow = computeSupplyFlow({ regions: state.regions, units: state.units, nationId, ageId: getEffectiveAgeId(state.age, state.techAgeId), resources: state.resources, turnNumber: state.turnNumber, tileOwner: state.world?.tileOwner });
  const mine = Object.values(state.units).filter((u) => u.ownerId === nationId && u.domain !== 'naval' && !u.embarkedOn && !isExplorer(u) && u.strength > 0);
  const fx = mapEffectsFor(state, nationId);
  const max = SUPPLY_MAX + fx.supplyMax;
  const lineRings = SUPPLY_LINE_RINGS + ringsFromF75(Math.max(0, Math.round(getModifier(state, nationId, 'national.supplyRange').total))) + ringsForKm(fx.lineRings, { min: 0 });
  const attritionMult = Math.max(0, 1 + getModifier(state, nationId, 'national.attrition').total);
  const sizes = stackSizes(state, state.units);
  let abroad = 0; let draining = 0; let starving = 0; let drain = 0;
  mine.filter((u) => !isSettler(u)).forEach((u) => {
    const { zone, change } = supplyChange(state, tiles, u, { lineRings, hungry: flow.hungry, stackSize: sizes.get(`${u.ownerId}|${unitTile(state, u)}`) || 0, stackCapExtra: fx.stackCap, attritionMult });
    if (zone !== 'home') abroad += 1;
    if (change < 0) { draining += 1; drain += -change; }
    if (zone !== 'home' && supplyOf(u, max) + Math.min(0, change) <= 0) starving += 1;
  });
  return {
    campaigning: flow.campaigning, home: Math.max(0, mine.length - flow.campaigning), abroad, draining, starving, drain,
    produced: flow.produced, consumed: flow.consumed, marching: flow.marching, stock: state.resources?.supplies || 0, hungry: flow.hungry, metalId: flow.metalId
  };
};
