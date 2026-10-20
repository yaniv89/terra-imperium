// src/engine/routes.js
// Marching anywhere over several turns (plan §4g, the CK3 way), on tiles since workstream 5. The
// player picks an army and any place (a city, or a tile of free land); the game plans the cheapest
// land route over tiles (armies.js findTilePath) and the army walks it as many tiles a turn as its
// movement points allow, paying for the march in supplies and gold.
//
//   When        the Civilization way: the order steps at once with this turn's points (gameReducer
//               SET_ROUTE: stepMarchesNow), shown on the map straight away, and the rest of the
//               route is walked at the start of each later turn (resolveTurn's march phase spends
//               the NEW turn's points: `movedNowTurn` = that turn). A stack that already moved this
//               turn (Move now, an earlier order, the turn's start walk) or has no move left (it
//               fought) sets out at the next turn's start: never a double move.
//               Turn counts (planMarch.turns, routeEta, the march lines) are End Turns: 0 = it gets
//               there now, 1 = at the start of the next turn.
//
//   Pace        movement points per turn: the slowest unit's MOVE_POINTS (+1 with Forced March).
//   Step cost   armies.js tileStepCost: open land 1, hills, forest and desert more, mountains 4
//               (a pass as hills), a river crossing 0.5 / 1 / 2 by size (less on a road edge or
//               with Stone Bridges), a road 0.5. Enemy land costs at least ENEMY_TILE_COST.
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
// 'enemy' | null: why it waits), `marchedTurn` (the last turn it marched), `routeAttack` (a march to
// attack: the city it goes to assault, marchAttack.js; dropped with the route).
// Player armies only. AI armies keep their city-hopping operations (aiOperations.js) until the
// front planner of workstream 9, so AI turns stay fast.
import { getTiles } from '../data/geo/tiles';
import { msg, sub, cityRef, place as placeRef, reasonOf } from './messages';
import { MARCH_SUPPLY_PER_UNIT } from './supplies';
import { getResearched } from './nationState';
import { enemyFleetAt, findSeaPath, fleetPace, isFleet, portsBeside, portWaters } from './fleets';
import {
  BANK_CAP, DEFAULT_MOVE_POINTS, ENEMY_TILE_COST, MARCH_ATTRITION, MAX_ROUTE_STEPS, MOVE_POINTS,
  enemyArmyAt, findTilePath, inEnemyZoc, isHarsh, movePoints, regionAccess, regionForTile, stackPace, tileAccess, tileStepCost, unitTile
} from './armies';
import { isStationedIn } from './unitLocation';

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
/** placeName as a name in a message (messages.js): the same English, a ref the UI can translate. */
export const placeRefOf = (state, tile) => {
  const tiles = getTiles();
  const cityId = state.world?.tileOwner?.[tile];
  const city = state.regions[cityId];
  if (city?.tile === tile) return cityRef(cityId, city.name);
  if (tiles.names[tile]) return placeRef(tiles.names[tile]);
  if (city) return sub('m.battle.landOf', { city: cityRef(cityId, city.name) });
  if (!tiles.rivers[tile]) return sub('m.battle.openCountry');
  return tiles.riverNames[tile] ? sub('m.battle.theRiverNamed', { river: placeRef(tiles.riverNames[tile]) }) : sub('m.battle.theRiver');
};

/** The tile a march target means: a city id (its centre) or a tile id. */
export const targetTile = (state, target) => (typeof target === 'number' ? target : state.regions[target]?.tile ?? null);

// The cheapest path for the player from tile `from` to a target (a city id or a tile).
export const findRoute = (state, from, target) => {
  const to = targetTile(state, target);
  if (to == null) return reasonOf('m.why.unknownPlace');
  return findTilePath(state, from, to, state.playerNationId, { researched: getResearched(state, state.playerNationId) });
};

/** Has the unit already spent this turn's movement (Move now, a march stepped now, the walk at the
 * start of this turn)? It then waits for the next turn (playtest audit I065: no double move). */
export const marchedThisTurn = (state, u) => u?.movedNowTurn != null && u.movedNowTurn === state.turnNumber;

/** May the unit step on a march right now, with this turn's points? Not when it already moved this
 * turn or used its move (a battle, a landing), nor aboard a ship, nor dead. */
export const canStepNow = (state, u) => !!u && !u.embarkedOn && u.strength > 0 && (u.movesLeft ?? 1) > 0 && !marchedThisTurn(state, u);

// After how many End Turns the army enters each step, ignoring halts. `now`: the stack steps at once
// with this turn's points (a fresh order: stepMarchesNow), so the steps they pay are 0 (now);
// without, every step waits for a turn's start (at least 1). The one schedule every preview
// (planMarch, the march lines, the army sheet's ETA: routeEta) and advanceMarches share.
export const scheduleSteps = (state, from, steps, pace, bank = 0, { now = false } = {}) => {
  const turns = [];
  let turn = 0; let b = now ? Math.min(BANK_CAP + pace, bank + pace) : bank; let at = from;
  steps.forEach((tile) => {
    const cost = stepCost(state, tile, at);
    while (b + 1e-9 < cost) { turn += 1; b = Math.min(BANK_CAP + pace, b + pace); }
    b -= cost; at = tile;
    turns.push(now ? turn : Math.max(1, turn));
  });
  return turns;
};

/** End Turns until a marching unit reaches the end of its route (1 = at the start of the next turn),
 * by the same schedule the march walks (its pace, its banked points); null off a route. What this
 * turn's points paid was walked when the order was given, so the rest waits for a turn's start. */
export const routeEta = (state, unit) => {
  if (!unit?.route?.length) return null;
  const at = unitTile(state, unit);
  const here = unit.route.indexOf(at);
  const steps = here >= 0 ? unit.route.slice(here + 1) : unit.route;
  if (!steps.length) return null;
  if (isFleet(unit)) return Math.max(1, Math.ceil(steps.length / Math.max(1, unit.routePace || fleetPace(state, unit))));
  const turns = scheduleSteps(state, at, steps, unit.routePace || DEFAULT_MOVE_POINTS, unit.routeBank || 0);
  return turns[turns.length - 1];
};

/**
 * Move now: may this land unit walk to its nation's own city `toRegionId` THIS turn (gameReducer
 * MOVE_ARMY)? The same route and the same schedule as a march (findRoute, scheduleSteps): it is
 * offered only when the whole way fits in the unit's movement of one turn, so "this turn" on the
 * preview and "arrives now" are the same promise, and a march of 2 turns is never a jump
 * (playtest audit I065, plan W03 task 3: no teleport path). The way must be safe: no enemy land,
 * no enemy army or fort beside it (those are a march's business: zone of control, forts.js).
 * Returns { ok, path, harshSteps } or { ok: false, reason, turns }.
 */
export const moveNowCheck = (state, unit, toRegionId) => {
  const city = state.regions[toRegionId];
  if (!unit || !city || city.owner !== unit.ownerId) return { ok: false, ...reasonOf('m.why.moveOwnCity') };
  if ((unit.movesLeft ?? 1) <= 0 || marchedThisTurn(state, unit)) return { ok: false, ...reasonOf('m.why.alreadyMoved') };
  const from = unitTile(state, unit);
  if (from == null) return { ok: false, ...reasonOf('m.why.unknownPlace') };
  if (from === city.tile) return { ok: false, ...reasonOf('m.why.armyThere') };
  const researched = getResearched(state, unit.ownerId);
  const found = findTilePath(state, from, city.tile, unit.ownerId, { researched });
  if (!found.path) return { ok: false, reason: found.reason, reasonMsg: found.reasonMsg };
  const tiles = getTiles();
  const steps = found.path.slice(1);
  // The schedule of a fresh order (scheduleSteps now): 0 = the whole way fits in this turn's points.
  const turns = scheduleSteps(state, from, steps, movePoints(unit, researched), 0, { now: true });
  const eta = turns[turns.length - 1];
  if (eta > 0) return { ok: false, turns: eta, ...reasonOf('m.why.tooFarMove', { turns: eta }) };
  const unsafe = steps.some((t) => ['enemy', 'held', 'closed'].includes(tileAccess(state, t, unit.ownerId)) || enemyArmyAt(state, t, unit.ownerId) || inEnemyZoc(state, tiles, t, unit.ownerId));
  if (unsafe) return { ok: false, turns: eta, ...reasonOf('m.why.notSafe') };
  return { ok: true, turns: 0, path: found.path, harshSteps: steps.filter((t) => isHarsh(tiles, t)).length };
};

// The player's own land units an order is for. With `unitIds` those units are the order (a stack
// picked on its tile: the army sheet), wherever they are based; without, the units that STAND in
// the city `fromId` (unitLocation.js isStationedIn), never a field army that only has it as its
// base (playtest audit I058: the city's March button moved an army in Sinai too).
export const marchingUnits = (state, fromId, unitIds = null, { naval = false } = {}) => Object.values(state.units).filter((u) => u.ownerId === state.playerNationId
  && (naval ? u.domain === 'naval' : u.domain !== 'naval') && !u.embarkedOn && u.strength > 0 && u.classId !== 'settler'
  && (unitIds ? unitIds.includes(u.id) : isStationedIn(state, u, fromId)));

// The tile most of a stack stands on (ties: the lowest id).
const mainTile = (state, units) => {
  const count = new Map();
  units.forEach((u) => { const t = unitTile(state, u); count.set(t, (count.get(t) || 0) + 1); });
  return [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
};

/** The tile a march order starts from (where the stack stands, not its base), or null. */
export const marchOrigin = (state, fromId, unitIds = null, { naval = false } = {}) => {
  const units = marchingUnits(state, fromId, unitIds, { naval });
  return units.length ? mainTile(state, units) : null;
};

// Everything the map needs to preview a march: the path (tiles), the End Turn of each step (0 = walked
// now, when ordered), the arrival (End Turns, 0 = now), the supplies it will eat, and where it will
// halt (the first enemy tile, and its city). `spent`: the stack cannot step now (it already moved
// this turn), so it sets out at the next turn's start. Pure.
export const planMarch = (state, fromId, target, unitIds = null, { naval = false } = {}) => {
  const units = marchingUnits(state, fromId, unitIds, { naval });
  if (!units.length) return { ok: false, ...reasonOf(naval ? 'm.why.noFleetSail' : 'm.why.noArmyMarch') };
  const from = mainTile(state, units);
  const to = targetTile(state, target);
  const found = naval ? (to == null ? reasonOf('m.why.unknownPlace') : findSeaPath(state, from, to, state.playerNationId)) : findRoute(state, from, target);
  if (!found.path) return { ok: false, reason: found.reason, reasonMsg: found.reasonMsg };
  const steps = found.path.slice(1);
  const pace = naval ? units.reduce((m, u) => Math.min(m, fleetPace(state, u)), Infinity) : stackPace(units, getResearched(state, units[0]?.ownerId));
  // A stack that already moved this turn (or has no move left) sets out at the next turn's start.
  const spent = units.some((u) => !canStepNow(state, u));
  const stepTurns = naval ? steps.map((_, i) => Math.floor(i / pace) + (spent ? 1 : 0)) : scheduleSteps(state, from, steps, pace, 0, { now: !spent });
  const turns = stepTurns[stepTurns.length - 1];
  const me = state.playerNationId;
  const centres = new Set(Object.values(state.regions).map((c) => c.tile));
  const haltIndex = steps.findIndex((t) => tileAccess(state, t, me) === 'enemy' && centres.has(t));
  const enemySteps = steps.filter((t) => ['enemy', 'held'].includes(tileAccess(state, t, me))).length;
  // Supplies are eaten once per turn that ends with the stack marched (supplies.js marchedTurn): the
  // steps walked now and those at the next turn's start fall in the same turn.
  const charged = Math.max(1, turns);
  const supplies = Math.round(units.length * MARCH_SUPPLY_PER_UNIT * (charged + Math.min(charged, enemySteps)) * 10) / 10;
  const haltTile = haltIndex >= 0 ? steps[haltIndex] : null;
  return { ok: true, naval, from, path: found.path, steps, stepTurns, turns, pace, spent, units: units.map((u) => u.id), supplies, haltTile, haltAt: haltTile != null ? state.world?.tileOwner?.[haltTile] ?? null : null };
};

/** A new move order ends a standing one: Hold (`unit.hold`) and Lay siege (`unit.siegeOf`, sieges.js)
 * last until the unit is told to go somewhere. The same object when it had neither. */
export const released = (u) => (u.hold || u.siegeOf ? { ...u, hold: false, siegeOf: null } : u);

// Give the order (gameReducer SET_ROUTE). Units standing elsewhere in the city's land get a route
// of their own. Returns { units, plan } or { reason }.
export const orderMarch = (state, fromId, target, unitIds = null, { naval = false } = {}) => {
  const plan = planMarch(state, fromId, target, unitIds, { naval });
  if (!plan.ok) return { reason: plan.reason, reasonMsg: plan.reasonMsg };
  const units = { ...state.units };
  const to = plan.path[plan.path.length - 1];
  plan.units.forEach((id) => {
    const u = released(units[id]);
    const at = unitTile(state, u);
    if (at === plan.from) { units[id] = { ...u, route: plan.steps, routeBank: 0, routePace: plan.pace, routeHalt: null }; return; }
    const own = at === to ? null : naval ? findSeaPath(state, at, to, state.playerNationId) : findRoute(state, at, to);
    if (own?.path) units[id] = { ...u, route: own.path.slice(1), routeBank: 0, routePace: plan.pace, routeHalt: null };
  });
  return { units, plan };
};

const clearRoute = (u) => ({ ...u, route: null, routeBank: 0, routePace: null, routeHalt: null, ...(u.routeAttack ? { routeAttack: null } : {}) });
export const cancelRoute = clearRoute;

/** Where a marching unit is going, for the UI. */
export const routeDestination = (unit) => (unit.route?.length ? unit.route[unit.route.length - 1] : null);

// A fleet's turn on its route (fleets.js): `routePace` water tiles, in and out of ports, halting
// before an enemy fleet or outside an enemy port. Cargo moves with it.
const sailFleet = (state, units, u, { reached, halted, mark = {} }) => {
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
  const place = { tile: at, regionId, ...(moved ? { marchedTurn: state.turnNumber, ...mark } : {}) };
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
// place, like resolveTurn's other phases), and by stepMarchesNow when an order is given. Units are
// walked in id order; a stack ordered together shares route, pace and bank, so it stays together.
// `turnOf`: the turn whose movement this walk spends (resolveTurn: the coming turn; an order: this
// one). A unit that already moved in that turn is skipped, and a unit that steps is marked with it
// (`movedNowTurn`). Without it (the AI's walks) nothing is marked and units that moved now this
// turn are skipped, as before. `only`: walk just these unit ids (the others still block and
// exert zone of control). Returns { logs, marched } (marched = how many units moved at least one step).
export const advanceMarches = (state, units, { year, turnOf = null, only = null } = {}) => {
  const tiles = getTiles();
  const me = state.playerNationId;
  const researched = getResearched(state, me);
  const logs = [];
  let marched = 0;
  const reached = new Map(); // destination -> count, for one log line per stack
  const halted = new Map();
  Object.keys(units).sort().forEach((id) => {
    const u = units[id];
    if (!u?.route?.length || u.ownerId !== me || (only && !only.has(id))) return;
    if (u.embarkedOn || !(u.strength > 0)) { units[id] = clearRoute(u); return; }
    // It already spent the movement of the turn this walk is for (Move now, an order stepped now):
    // it walks from the next turn, as every preview says.
    if (turnOf != null ? u.movedNowTurn === turnOf : marchedThisTurn(state, u)) return;
    const mark = turnOf != null ? { movedNowTurn: turnOf } : {};
    if (isFleet(u)) { sailFleet(state, units, u, { reached, halted, mark }); return; }
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
      if (access === 'closed' || (u.explorer && !['wild', 'own', 'friend'].includes(access))) { halt = 'closed'; break; }
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
    const place = { tile: at, regionId, strength, ...(moved ? { marchedTurn: state.turnNumber, ...mark } : {}) };
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
  const name = (tile) => placeRefOf(state, Number(tile));
  // A fleet's log names the port it reached when it put in.

  // One army or several: two keys, as the English had two forms.
  const say = (n, key, tile) => msg(`m.battle.${key}${n > 1 ? 'Many' : 'One'}`, { n, place: name(tile) });
  reached.forEach((n, tile) => logs.push({ year, ...say(n, 'marchReached', tile), type: 'action' }));
  halted.forEach((n, key) => {
    const [kind, tile] = key.split('|');
    const line = say(n, kind === 'attack' ? 'marchBefore' : kind === 'enemy' ? 'marchHalted' : 'marchClosed', tile);
    logs.push({ year, ...line, type: kind === 'closed' ? 'action' : 'combat' });
  });
  return { logs, marched };
};

/**
 * A march order steps at once (gameReducer SET_ROUTE, the Civilization way): the ordered units walk
 * their routes now with this turn's points, by the same walk as a turn's start (advanceMarches:
 * costs, rivers, halts before an enemy city or army, zone of control, attrition), and are marked
 * as having moved this turn. A stack where any unit cannot step now (canStepNow) waits whole for the
 * next turn's start, so it stays together. `fortStartTile` keeps where a unit stood before its first
 * step this turn, for the forts the turn's end checks (forts.js, resolveTurn). Returns
 * { units, logs } (the same `state.units` when nobody stepped).
 */
export const stepMarchesNow = (state, unitIds, { year = state.year } = {}) => {
  const ids = (unitIds || []).filter((id) => state.units[id]?.route?.length);
  if (!ids.length || ids.some((id) => !canStepNow(state, state.units[id]))) return { units: state.units, logs: [] };
  const units = { ...state.units };
  const { logs } = advanceMarches(state, units, { year, turnOf: state.turnNumber, only: new Set(ids) });
  // (a fleet's sail is not in advanceMarches' count: compare the units themselves)
  if (!ids.some((id) => units[id] !== state.units[id])) return { units: state.units, logs };
  ids.forEach((id) => {
    const before = state.units[id]; const after = units[id];
    if (after && after !== before && after.movedNowTurn === state.turnNumber && after.fortStartTile?.turn !== state.turnNumber) {
      units[id] = { ...after, fortStartTile: { turn: state.turnNumber, tile: unitTile(state, before) } };
    }
  });
  return { units, logs };
};

/** The units as they stood when the turn began, for forts.js: a unit that stepped now this turn is
 * put back on the tile it left (stepMarchesNow `fortStartTile`). The same map when none did. */
export const unitsAtTurnStart = (state) => {
  let out = null;
  Object.values(state.units).forEach((u) => {
    if (u.fortStartTile?.turn !== state.turnNumber || u.fortStartTile.tile == null) return;
    if (!out) out = { ...state.units };
    out[u.id] = { ...u, tile: u.fortStartTile.tile };
  });
  return out || state.units;
};

// Extra gold upkeep for the land units that marched this turn (`units`: a map or an array).
export const marchUpkeep = (units, nationId, turnNumber, perUnitUpkeep, ownedUnits = null) => Math.round((ownedUnits || Object.values(units))
  .filter((u) => u.ownerId === nationId && u.marchedTurn === turnNumber && u.domain !== 'naval').length * perUnitUpkeep * MARCH_UPKEEP_SHARE);
