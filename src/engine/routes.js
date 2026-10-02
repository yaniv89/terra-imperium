// src/engine/routes.js
// Marching anywhere over several turns (plan §4g, the CK3 way). The player picks an army and any
// province; the game plans the cheapest land route and the army walks it at End Turn, a few
// provinces a turn, paying for the march in supplies and gold.
//
//   Pace        movement points per turn: the slowest unit's MARCH_POINTS (+1 with Forced March).
//   Step cost   entering a province costs TERRAIN_STEP_COST by its terrain (src/data/terrain.js):
//               open land 1, hills and forest 2, mountains, desert and arctic 4. Roads (any
//               Logistics building) in your own or a friend's province cut it by ROAD_FACTOR.
//               Enemy land costs at least ENEMY_STEP_COST. So infantry (2 a turn) cover 2 open
//               provinces of their own, 3 on roads, 1 of hills or enemy land, and a mountain every
//               other turn; cavalry (3) a little more, siege trains (1) much less.
//   Banking     unspent points carry over (up to BANK_CAP), so a slow army still crosses mountains.
//   Access      at peace a route may only cross your land, a vassal's or a military ally's (and
//               unclaimed land). At war it may enter the enemy's land, but it halts at the border
//               of every enemy province you do not hold yet: attacking still goes through the attack
//               card (Auto or Command), and winning moves the army in, so the march goes on.
//               An enemy army standing in the next province halts it too.
//   Costs       giving the order is free. Every land unit that marched this turn eats
//               MARCH_SUPPLY_PER_UNIT supplies (double in enemy land) on top of the campaign rule
//               (supplies.js) and costs MARCH_UPKEEP_SHARE more gold upkeep (economy). A step into
//               mountains, desert or arctic land costs MARCH_ATTRITION of the unit's strength.
//
// Unit fields: `route` (the provinces still to go, in order), `routeBank` (banked points),
// `routePace` (the stack's pace, fixed when ordered so the stack stays together), `routeHalt`
// ('attack' | 'enemy' | null: why it waits), `marchedTurn` (the last turn it marched).
// Player armies only. AI armies keep their abstract war model (diplomacy.js resolveWarProgress)
// and the AI operations of aiOperations.js, so AI turns stay fast.
import { REGIONS_DATA } from '../data/regions';
import { getRegionTerrain } from '../data/terrain';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { isAtWarWithPlayer } from './diplomacy';
import { hasPerk } from '../data/promotions';
import { MARCH_SUPPLY_PER_UNIT } from './supplies';

export const MARCH_POINTS = { infantry: 2, ranged: 2, cavalry: 3, siege: 1, support: 1, air: 3 };
export const DEFAULT_MARCH_POINTS = 2;
export const TERRAIN_STEP_COST = { mixed: 1, plains: 1, urban: 1, island: 1, hills: 2, forest: 2, mountains: 4, desert: 4, arctic: 4 };
export const ROAD_FACTOR = 2 / 3;
export const ENEMY_STEP_COST = 2;
export const BANK_CAP = 4;
export { MARCH_SUPPLY_PER_UNIT };
// The planner avoids enemy land on the way to somewhere else: each enemy step counts this much more.
export const ENEMY_PATH_PENALTY = 6;
export const MARCH_UPKEEP_SHARE = 0.25;
export const MARCH_ATTRITION = 0.03;
const HARSH_TERRAIN = new Set(['mountains', 'desert', 'arctic']);
// A route longer than this many steps is refused (keeps the planner and the save small).
export const MAX_ROUTE_STEPS = 60;


// The pace of a stack: its slowest unit.
export const stackPace = (units) => units.reduce((m, u) => Math.min(m, (MARCH_POINTS[u.classId] ?? DEFAULT_MARCH_POINTS) + (hasPerk(u, 'forcedMarch') ? 1 : 0)), Infinity);

// How the player relates to a province: own | friend | wild | enemy | held (enemy land the player
// occupies) | closed (no access).
export const accessOf = (state, regionId) => {
  const me = state.playerNationId;
  const r = state.regions[regionId];
  if (!r || !REGIONS_DATA[regionId]) return 'closed';
  if (r.owner === me) return r.occupiedBy && r.occupiedBy !== me ? 'enemy' : 'own';
  if (!r.owner) return 'wild';
  if (r.owner === REBEL_OWNER_ID) return 'enemy';
  if (isAtWarWithPlayer(state, r.owner)) return r.occupiedBy === me ? 'held' : 'enemy';
  const owner = state.nations[r.owner];
  if (owner && !owner.isEliminated && (owner.vassalOf === me || owner.hasMilitaryPact)) return 'friend';
  return 'closed';
};

// Movement points to enter `regionId`.
export const stepCost = (state, regionId, access = accessOf(state, regionId)) => {
  const terrain = getRegionTerrain(regionId, REGIONS_DATA);
  let cost = TERRAIN_STEP_COST[terrain] ?? 1;
  const hasRoad = (state.regions[regionId]?.buildings?.categories?.logistics ?? -1) >= 0;
  if (hasRoad && (access === 'own' || access === 'friend')) cost *= ROAD_FACTOR;
  if (access === 'enemy' || access === 'held') cost = Math.max(cost, ENEMY_STEP_COST);
  return cost;
};

// Units of a nation at war with the player standing in `regionId`.
const enemyArmyIn = (state, regionId, units = state.units) => Object.values(units).some((u) => u.regionId === regionId && u.domain !== 'naval' && !u.embarkedOn && u.strength > 0
  && u.ownerId !== state.playerNationId && (u.ownerId === REBEL_OWNER_ID || isAtWarWithPlayer(state, u.ownerId)));

// A tiny binary heap for Dijkstra.
const heapPush = (h, item) => {
  h.push(item);
  let i = h.length - 1;
  while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; }
};
const heapPop = (h) => {
  const top = h[0]; const last = h.pop();
  if (h.length) {
    h[0] = last; let i = 0;
    for (;;) {
      const l = 2 * i + 1; const r = l + 1; let m = i;
      if (l < h.length && h[l][0] < h[m][0]) m = l;
      if (r < h.length && h[r][0] < h[m][0]) m = r;
      if (m === i) break;
      [h[m], h[i]] = [h[i], h[m]]; i = m;
    }
  }
  return top;
};

// The cheapest land path from `fromId` to `toId` (both ends included), by step cost. Enemy land
// is allowed (the march halts at it); closed land is not. Ties break on region id so the result
// is deterministic. Returns { path } or { reason }.
export const findRoute = (state, fromId, toId) => {
  if (fromId === toId) return { reason: 'The army is already there.' };
  if (!REGIONS_DATA[toId]) return { reason: 'Unknown province.' };
  const targetAccess = accessOf(state, toId);
  if (targetAccess === 'closed') {
    const owner = state.nations[state.regions[toId]?.owner];
    return { reason: `No access to ${owner?.name || 'that land'}: declare war or form an alliance.` };
  }
  const dist = new Map([[fromId, 0]]);
  const prev = new Map();
  const heap = [[0, fromId]];
  while (heap.length) {
    const [d, id] = heapPop(heap);
    if (d > (dist.get(id) ?? Infinity)) continue;
    if (id === toId) break;
    const neighbors = [...(REGIONS_DATA[id]?.neighbors || [])].sort();
    for (const n of neighbors) {
      const access = accessOf(state, n);
      if (access === 'closed') continue;
      // Each enemy province means a halt and a battle, so a friendly way round is preferred.
      const penalty = access === 'enemy' && n !== toId ? ENEMY_PATH_PENALTY : 0;
      const nd = d + stepCost(state, n, access) + penalty;
      if (nd < (dist.get(n) ?? Infinity) - 1e-9) { dist.set(n, nd); prev.set(n, id); heapPush(heap, [nd, n]); }
    }
  }
  if (!dist.has(toId)) return { reason: 'No land route: this needs a fleet to carry the army.' };
  const path = [toId];
  while (path[0] !== fromId) path.unshift(prev.get(path[0]));
  if (path.length - 1 > MAX_ROUTE_STEPS) return { reason: 'Too far for one march: pick a closer province.' };
  return { path, cost: dist.get(toId) };
};

// On which turn (1 = this End Turn) the army enters each step, ignoring halts.
export const scheduleSteps = (state, steps, pace, bank = 0) => {
  const turns = [];
  let turn = 0; let b = bank;
  steps.forEach((id) => {
    const cost = stepCost(state, id);
    while (b + 1e-9 < cost) { turn += 1; b = Math.min(BANK_CAP + pace, b + pace); }
    b -= cost;
    turns.push(Math.max(1, turn));
  });
  return turns;
};

// The player's own land units that would march from `fromId` (all of them, or `unitIds`).
export const marchingUnits = (state, fromId, unitIds = null) => Object.values(state.units).filter((u) => u.ownerId === state.playerNationId
  && u.regionId === fromId && u.domain !== 'naval' && !u.embarkedOn && u.strength > 0 && (!unitIds || unitIds.includes(u.id)));

// Everything the map needs to preview a march: the path, the turn of each step, the arrival turn,
// the supplies it will eat, and where it will halt (the first enemy province). Pure.
export const planMarch = (state, fromId, toId, unitIds = null) => {
  const units = marchingUnits(state, fromId, unitIds);
  if (!units.length) return { ok: false, reason: 'No army here can march.' };
  const found = findRoute(state, fromId, toId);
  if (!found.path) return { ok: false, reason: found.reason };
  const steps = found.path.slice(1);
  const pace = stackPace(units);
  const stepTurns = scheduleSteps(state, steps, pace);
  const turns = stepTurns[stepTurns.length - 1];
  const haltIndex = steps.findIndex((id) => accessOf(state, id) === 'enemy');
  const enemySteps = steps.filter((id) => ['enemy', 'held'].includes(accessOf(state, id))).length;
  const supplies = Math.round(units.length * MARCH_SUPPLY_PER_UNIT * (turns + Math.min(turns, enemySteps)) * 10) / 10;
  return { ok: true, path: found.path, steps, stepTurns, turns, pace, units: units.map((u) => u.id), supplies, haltAt: haltIndex >= 0 ? steps[haltIndex] : null };
};

// Give the order (gameReducer SET_ROUTE). Returns the next units map, or null when refused.
export const orderMarch = (state, fromId, toId, unitIds = null) => {
  const plan = planMarch(state, fromId, toId, unitIds);
  if (!plan.ok) return { reason: plan.reason };
  const units = { ...state.units };
  plan.units.forEach((id) => { units[id] = { ...units[id], route: plan.steps, routeBank: 0, routePace: plan.pace, routeHalt: null }; });
  return { units, plan };
};

const clearRoute = (u) => ({ ...u, route: null, routeBank: 0, routePace: null, routeHalt: null });
export const cancelRoute = clearRoute;

// The march phase, run at the start of resolveTurn on the turn's working `units` (mutated in
// place, like resolveTurn's other phases). Units are walked in id order; a stack ordered together
// shares route, pace and bank, so it stays together. Returns { logs, marched } (marched = how
// many units moved at least one step).
export const advanceMarches = (state, units, { year } = {}) => {
  const logs = [];
  let marched = 0;
  const reached = new Map(); // destination -> count, for one log line per stack
  const halted = new Map();
  Object.keys(units).sort().forEach((id) => {
    const u = units[id];
    if (!u?.route?.length || u.ownerId !== state.playerNationId) return;
    if (u.embarkedOn || u.domain === 'naval' || !(u.strength > 0)) { units[id] = clearRoute(u); return; }
    // An attack (or a manual move) put the unit somewhere on its route: drop the steps behind it.
    let route = u.route;
    const here = route.indexOf(u.regionId);
    if (here >= 0) route = route.slice(here + 1);
    if (!route.length) { units[id] = clearRoute(u); return; }
    // The route must still start next door.
    if (!(REGIONS_DATA[u.regionId]?.neighbors || []).includes(route[0])) { units[id] = clearRoute(u); return; }
    const pace = u.routePace || DEFAULT_MARCH_POINTS;
    let bank = Math.min(BANK_CAP + pace, (u.routeBank || 0) + pace);
    let at = u.regionId; let strength = u.strength; let moved = false; let halt = null;
    while (route.length) {
      const next = route[0];
      const access = accessOf(state, next);
      if (access === 'closed') { halt = 'closed'; break; }
      if (access === 'enemy') { halt = 'attack'; break; }
      if (enemyArmyIn(state, next, units)) { halt = 'enemy'; break; }
      const cost = stepCost(state, next, access);
      if (bank + 1e-9 < cost) break;
      bank -= cost; at = next; route = route.slice(1); moved = true;
      if (HARSH_TERRAIN.has(getRegionTerrain(next, REGIONS_DATA))) strength = Math.max(1, Math.round(strength * (1 - MARCH_ATTRITION)));
    }
    if (halt === 'closed') {
      units[id] = { ...clearRoute(u), regionId: at, strength, ...(moved ? { marchedTurn: state.turnNumber } : {}) };
      halted.set(`closed|${at}`, (halted.get(`closed|${at}`) || 0) + 1);
    } else if (!route.length) {
      units[id] = { ...clearRoute(u), regionId: at, strength, marchedTurn: state.turnNumber };
      reached.set(at, (reached.get(at) || 0) + 1);
    } else {
      // A halted army does not bank points while it waits.
      const newHalt = halt === 'attack' || halt === 'enemy' ? halt : null;
      if (newHalt && u.routeHalt !== newHalt) halted.set(`${newHalt}|${route[0]}`, (halted.get(`${newHalt}|${route[0]}`) || 0) + 1);
      units[id] = { ...u, regionId: at, strength, route, routeBank: newHalt ? 0 : bank, routeHalt: newHalt, ...(moved ? { marchedTurn: state.turnNumber } : {}) };
    }
    if (moved) marched += 1;
    // Cargo never marches on land, so nothing rides along.
  });
  const name = (rid) => REGIONS_DATA[rid]?.name || rid;
  const plural = (n) => (n > 1 ? `${n} units` : 'Your army');
  reached.forEach((n, rid) => logs.push({ year, message: `${plural(n)} reached ${name(rid)}.`, type: 'action' }));
  halted.forEach((n, key) => {
    const [kind, rid] = key.split('|');
    const msg = kind === 'attack' ? `${plural(n)} wait${n > 1 ? '' : 's'} at the border of ${name(rid)}: attack it to march on.`
      : kind === 'enemy' ? `${plural(n)} halted: an enemy army stands in ${name(rid)}.`
      : `${plural(n)} stopped at ${name(rid)}: no access any more.`;
    logs.push({ year, message: msg, type: kind === 'closed' ? 'action' : 'combat' });
  });
  return { logs, marched };
};

// Extra gold upkeep for the land units that marched this turn (`units`: a map or an array).
export const marchUpkeep = (units, nationId, turnNumber, perUnitUpkeep) => Math.round(Object.values(units)
  .filter((u) => u.ownerId === nationId && u.marchedTurn === turnNumber && u.domain !== 'naval').length * perUnitUpkeep * MARCH_UPKEEP_SHARE);
