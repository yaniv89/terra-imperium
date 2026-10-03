// src/engine/routes.js
// Marching anywhere over several turns (plan §4g, the CK3 way), on tiles since workstream 5. The
// player picks an army and any place (a city, or a tile of free land); the game plans the cheapest
// land route over tiles (armies.js findTilePath) and the army walks it at End Turn, as many tiles
// as its movement points allow, paying for the march in supplies and gold.
//
//   Pace        movement points per turn: the slowest unit's MOVE_POINTS (+1 with Forced March).
//   Step cost   armies.js tileStepCost: open land 1, hills, forest and desert more, mountains 4,
//               a river crossing +1, a road 0.5. Enemy land costs at least ENEMY_TILE_COST.
//   Banking     unspent points carry over (up to BANK_CAP), so a slow army still crosses mountains.
//   Access      at peace a route may only cross your land, a vassal's or a military ally's (and free
//               land). At war it may plan into the enemy's land, but it halts at the border of every
//               enemy tile you do not hold: attacking still goes through the attack card (Auto or
//               Command), and winning moves the army in, so the march goes on. An enemy army on the
//               next tile halts it too, and entering a tile next to one ends the turn's move (ZOC).
//   Costs       giving the order is free. Every land unit that marched this turn eats
//               MARCH_SUPPLY_PER_UNIT supplies (double in enemy land) on top of the campaign rule
//               (supplies.js) and costs MARCH_UPKEEP_SHARE more gold upkeep (economy). A step into
//               mountains, desert or arctic land costs MARCH_ATTRITION of the unit's strength.
//
// Unit fields: `route` (the tiles still to go, in order), `routeBank` (banked points), `routePace`
// (the stack's pace, fixed when ordered so the stack stays together), `routeHalt` ('attack' |
// 'enemy' | null: why it waits), `marchedTurn` (the last turn it marched).
// Player armies only. AI armies keep their city-hopping operations (aiOperations.js) until the
// front planner of workstream 9, so AI turns stay fast.
import { getTiles } from '../data/geo/tiles';
import { MARCH_SUPPLY_PER_UNIT } from './supplies';
import { getResearched } from './nationState';
import { enemyFleetAt, findSeaPath, fleetPace, isFleet, portsBeside, portWaters } from './fleets';
import {
  BANK_CAP, DEFAULT_MOVE_POINTS, ENEMY_TILE_COST, MARCH_ATTRITION, MAX_ROUTE_STEPS, MOVE_POINTS,
  enemyArmyAt, findTilePath, inEnemyZoc, isHarsh, regionAccess, regionForTile, stackPace, tileAccess, tileStepCost, unitTile
} from './armies';

export { MARCH_SUPPLY_PER_UNIT, BANK_CAP, MAX_ROUTE_STEPS, MARCH_ATTRITION, stackPace };
export const MARCH_POINTS = MOVE_POINTS;
export const DEFAULT_MARCH_POINTS = DEFAULT_MOVE_POINTS;
export const ENEMY_STEP_COST = ENEMY_TILE_COST;
export const MARCH_UPKEEP_SHARE = 0.25;

// How the player relates to a city: own | friend | wild | enemy | held | closed.
export const accessOf = (state, regionId) => regionAccess(state, regionId, state.playerNationId);

// Movement points for the player to enter `tile` from `from`.
export const stepCost = (state, tile, from = null, access = tileAccess(state, tile, state.playerNationId)) => tileStepCost(state, getTiles(), from, tile, access, getResearched(state, state.playerNationId));

/** The name of a tile for the player: its own, its city's land, or its kind. */
export const placeName = (state, tile) => {
  const tiles = getTiles();
  const city = state.regions[state.world?.tileOwner?.[tile]];
  if (city?.tile === tile) return city.name;
  if (tiles.names[tile]) return tiles.names[tile];
  if (city) return `the land of ${city.name}`;
  return tiles.rivers[tile] ? `the ${tiles.riverNames[tile] || 'river'}` : 'open country';
};

/** The tile a march target means: a city id (its centre) or a tile id. */
export const targetTile = (state, target) => (typeof target === 'number' ? target : state.regions[target]?.tile ?? null);

// The cheapest path for the player from tile `from` to a target (a city id or a tile).
export const findRoute = (state, from, target) => {
  const to = targetTile(state, target);
  if (to == null) return { reason: 'Unknown place.' };
  return findTilePath(state, from, to, state.playerNationId, { researched: getResearched(state, state.playerNationId) });
};

// On which turn (1 = this End Turn) the army enters each step, ignoring halts.
export const scheduleSteps = (state, from, steps, pace, bank = 0) => {
  const turns = [];
  let turn = 0; let b = bank; let at = from;
  steps.forEach((tile) => {
    const cost = stepCost(state, tile, at);
    while (b + 1e-9 < cost) { turn += 1; b = Math.min(BANK_CAP + pace, b + pace); }
    b -= cost; at = tile;
    turns.push(Math.max(1, turn));
  });
  return turns;
};

// The player's own land units that would march from the city `fromId` (all of them, or `unitIds`).
export const marchingUnits = (state, fromId, unitIds = null, { naval = false } = {}) => Object.values(state.units).filter((u) => u.ownerId === state.playerNationId
  && u.regionId === fromId && (naval ? u.domain === 'naval' : u.domain !== 'naval') && !u.embarkedOn && u.strength > 0 && u.classId !== 'settler' && (!unitIds || unitIds.includes(u.id)));

// The tile most of a stack stands on (ties: the lowest id).
const mainTile = (state, units) => {
  const count = new Map();
  units.forEach((u) => { const t = unitTile(state, u); count.set(t, (count.get(t) || 0) + 1); });
  return [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
};

// Everything the map needs to preview a march: the path (tiles), the turn of each step, the arrival
// turn, the supplies it will eat, and where it will halt (the first enemy tile, and its city). Pure.
export const planMarch = (state, fromId, target, unitIds = null, { naval = false } = {}) => {
  const units = marchingUnits(state, fromId, unitIds, { naval });
  if (!units.length) return { ok: false, reason: naval ? 'No fleet here can sail.' : 'No army here can march.' };
  const from = mainTile(state, units);
  const to = targetTile(state, target);
  const found = naval ? (to == null ? { reason: 'Unknown place.' } : findSeaPath(state, from, to, state.playerNationId)) : findRoute(state, from, target);
  if (!found.path) return { ok: false, reason: found.reason };
  const steps = found.path.slice(1);
  const pace = naval ? units.reduce((m, u) => Math.min(m, fleetPace(state, u)), Infinity) : stackPace(units, getResearched(state, units[0]?.ownerId));
  const stepTurns = naval ? steps.map((_, i) => Math.floor(i / pace) + 1) : scheduleSteps(state, from, steps, pace);
  const turns = stepTurns[stepTurns.length - 1];
  const me = state.playerNationId;
  const centres = new Set(Object.values(state.regions).map((c) => c.tile));
  const haltIndex = steps.findIndex((t) => tileAccess(state, t, me) === 'enemy' && centres.has(t));
  const enemySteps = steps.filter((t) => ['enemy', 'held'].includes(tileAccess(state, t, me))).length;
  const supplies = Math.round(units.length * MARCH_SUPPLY_PER_UNIT * (turns + Math.min(turns, enemySteps)) * 10) / 10;
  const haltTile = haltIndex >= 0 ? steps[haltIndex] : null;
  return { ok: true, naval, from, path: found.path, steps, stepTurns, turns, pace, units: units.map((u) => u.id), supplies, haltTile, haltAt: haltTile != null ? state.world?.tileOwner?.[haltTile] ?? null : null };
};

// Give the order (gameReducer SET_ROUTE). Units standing elsewhere in the city's land get a route
// of their own. Returns { units, plan } or { reason }.
export const orderMarch = (state, fromId, target, unitIds = null, { naval = false } = {}) => {
  const plan = planMarch(state, fromId, target, unitIds, { naval });
  if (!plan.ok) return { reason: plan.reason };
  const units = { ...state.units };
  const to = plan.path[plan.path.length - 1];
  plan.units.forEach((id) => {
    const u = units[id];
    const at = unitTile(state, u);
    if (at === plan.from) { units[id] = { ...u, route: plan.steps, routeBank: 0, routePace: plan.pace, routeHalt: null }; return; }
    const own = at === to ? null : naval ? findSeaPath(state, at, to, state.playerNationId) : findRoute(state, at, to);
    if (own?.path) units[id] = { ...u, route: own.path.slice(1), routeBank: 0, routePace: plan.pace, routeHalt: null };
  });
  return { units, plan };
};

const clearRoute = (u) => ({ ...u, route: null, routeBank: 0, routePace: null, routeHalt: null });
export const cancelRoute = clearRoute;

/** Where a marching unit is going, for the UI. */
export const routeDestination = (unit) => (unit.route?.length ? unit.route[unit.route.length - 1] : null);

// A fleet's turn on its route (fleets.js): `routePace` water tiles, in and out of ports, halting
// before an enemy fleet or outside an enemy port. Cargo moves with it.
const sailFleet = (state, units, u, { reached, halted }) => {
  const tiles = getTiles();
  const me = state.playerNationId;
  let route = u.route;
  let at = unitTile(state, u);
  const here = route.indexOf(at);
  if (here >= 0) route = route.slice(here + 1);
  // The first step leaves a port by any of its waters, or follows on from the fleet's tile.
  const inPort = at != null && tiles.land[at] === 1;
  const startsRight = at != null && route.length && (inPort ? portWaters(state, tiles, u.regionId).includes(route[0]) : tiles.neighbors[at].includes(route[0]));
  if (!startsRight) { units[u.id] = clearRoute(u); return; }
  const pace = u.routePace || fleetPace(state, u);
  let left = pace; let moved = false; let halt = null; let regionId = u.regionId;
  while (route.length && left > 0) {
    const next = route[0];
    if (tiles.land[next] === 1) {
      // Putting in at a port.
      const port = state.world?.tileOwner?.[next];
      const access = port ? regionAccess(state, port, me) : 'closed';
      if (access === 'closed' || access === 'wild') { halt = 'closed'; break; }
      if (access === 'enemy') { halt = 'attack'; break; }
      regionId = port;
    } else if (enemyFleetAt(state, next, me, units)) { halt = 'enemy'; break; }
    else { const ports = portsBeside(state, tiles, next).filter((c) => state.regions[c]?.owner === me); if (ports.length) regionId = ports[0]; }
    at = next; route = route.slice(1); left -= 1; moved = true;
  }
  const place = { tile: at, regionId, ...(moved ? { marchedTurn: state.turnNumber } : {}) };
  if (halt === 'closed') { units[u.id] = { ...clearRoute(u), ...place }; halted.set(`closed|${at}`, (halted.get(`closed|${at}`) || 0) + 1); }
  else if (!route.length) { units[u.id] = { ...clearRoute(u), ...place }; reached.set(at, (reached.get(at) || 0) + 1); }
  else {
    const newHalt = halt === 'attack' || halt === 'enemy' ? halt : null;
    if (newHalt && u.routeHalt !== newHalt) halted.set(`${newHalt}|${route[0]}`, (halted.get(`${newHalt}|${route[0]}`) || 0) + 1);
    units[u.id] = { ...u, ...place, route, routeHalt: newHalt };
  }
  // Cargo rides along.
  Object.values(units).forEach((c) => { if (c.embarkedOn === u.id) units[c.id] = { ...c, tile: at, regionId }; });
};

// The march phase, run at the start of resolveTurn on the turn's working `units` (mutated in
// place, like resolveTurn's other phases). Units are walked in id order; a stack ordered together
// shares route, pace and bank, so it stays together. Returns { logs, marched } (marched = how
// many units moved at least one step).
export const advanceMarches = (state, units, { year } = {}) => {
  const tiles = getTiles();
  const me = state.playerNationId;
  const researched = getResearched(state, me);
  const logs = [];
  let marched = 0;
  const reached = new Map(); // destination -> count, for one log line per stack
  const halted = new Map();
  Object.keys(units).sort().forEach((id) => {
    const u = units[id];
    if (!u?.route?.length || u.ownerId !== me) return;
    if (u.embarkedOn || !(u.strength > 0)) { units[id] = clearRoute(u); return; }
    if (isFleet(u)) { sailFleet(state, units, u, { reached, halted }); return; }
    // An attack (or a manual move) put the unit somewhere on its route: drop the steps behind it.
    let route = u.route;
    let at = unitTile(state, u);
    const here = route.indexOf(at);
    if (here >= 0) route = route.slice(here + 1);
    if (!route.length) { units[id] = clearRoute(u); return; }
    // The route must still start next door.
    if (at == null || !tiles.neighbors[at].includes(route[0])) { units[id] = clearRoute(u); return; }
    const pace = u.routePace || DEFAULT_MOVE_POINTS;
    let bank = Math.min(BANK_CAP + pace, (u.routeBank || 0) + pace);
    let strength = u.strength; let moved = false; let halt = null;
    while (route.length) {
      const next = route[0];
      const access = tileAccess(state, next, me);
      if (access === 'closed') { halt = 'closed'; break; }
      // Enemy land is walked at war (a siege is an army beside the city); the city itself is taken
      // through the attack card.
      if (access === 'enemy' && state.regions[state.world?.tileOwner?.[next]]?.tile === next) { halt = 'attack'; break; }
      if (enemyArmyAt(state, next, me, units)) { halt = 'enemy'; break; }
      const cost = tileStepCost(state, tiles, at, next, access, researched);
      if (bank + 1e-9 < cost) break;
      bank -= cost; at = next; route = route.slice(1); moved = true;
      if (isHarsh(tiles, next)) strength = Math.max(1, Math.round(strength * (1 - MARCH_ATTRITION)));
      // Zone of control: next to an enemy army the move ends for the turn.
      if (inEnemyZoc(state, tiles, next, me, units)) { bank = 0; break; }
    }
    const regionId = moved ? regionForTile(state, at, me, u.regionId) : u.regionId;
    const place = { tile: at, regionId, strength, ...(moved ? { marchedTurn: state.turnNumber } : {}) };
    if (halt === 'closed') {
      units[id] = { ...clearRoute(u), ...place };
      halted.set(`closed|${at}`, (halted.get(`closed|${at}`) || 0) + 1);
    } else if (!route.length) {
      units[id] = { ...clearRoute(u), ...place, marchedTurn: state.turnNumber };
      reached.set(at, (reached.get(at) || 0) + 1);
    } else {
      // A halted army does not bank points while it waits.
      const newHalt = halt === 'attack' || halt === 'enemy' ? halt : null;
      if (newHalt && u.routeHalt !== newHalt) halted.set(`${newHalt}|${route[0]}`, (halted.get(`${newHalt}|${route[0]}`) || 0) + 1);
      units[id] = { ...u, ...place, route, routeBank: newHalt ? 0 : bank, routeHalt: newHalt };
    }
    if (moved) marched += 1;
    // Cargo never marches on land, so nothing rides along.
  });
  const name = (tile) => placeName(state, Number(tile));
  // A fleet's log names the port it reached when it put in.

  const plural = (n) => (n > 1 ? `${n} units` : 'Your army');
  reached.forEach((n, tile) => logs.push({ year, message: `${plural(n)} reached ${name(tile)}.`, type: 'action' }));
  halted.forEach((n, key) => {
    const [kind, tile] = key.split('|');
    const msg = kind === 'attack' ? `${plural(n)} stand${n > 1 ? '' : 's'} before ${name(tile)}: lay siege, or attack it to march on.`
      : kind === 'enemy' ? `${plural(n)} halted: an enemy army stands at ${name(tile)}.`
      : `${plural(n)} stopped at ${name(tile)}: no access any more.`;
    logs.push({ year, message: msg, type: kind === 'closed' ? 'action' : 'combat' });
  });
  return { logs, marched };
};

// Extra gold upkeep for the land units that marched this turn (`units`: a map or an array).
export const marchUpkeep = (units, nationId, turnNumber, perUnitUpkeep, ownedUnits = null) => Math.round((ownedUnits || Object.values(units))
  .filter((u) => u.ownerId === nationId && u.marchedTurn === turnNumber && u.domain !== 'naval').length * perUnitUpkeep * MARCH_UPKEEP_SHARE);
