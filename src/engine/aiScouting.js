// src/engine/aiScouting.js
// Peacetime scouting for AI majors (lane CB09, I122). Contact needs sight (fog.js), and an AI army
// only ever left home for a war, so a major met one or two others in 150 turns and diplomacy
// stayed empty. Now a major at peace sends one scout at a time, on its own schedule:
//   when      every AI_SCOUT_PERIOD turns (spread by a hash of its id), with no scout out
//   who       one land unit from a city that keeps another unit home (never a settler): the one
//             with the most move points, then the weakest, then by id
//   where     the nearest land tile it has NOT explored, within AI_SCOUT_KM of steps over land its
//             march may enter at peace (free land, its own or a friend's: routes.js access), by
//             steps then tile id (scoutPath, a bounded search); nothing left to find, no scout
//   how       an ordinary march (routes.js: move points, supplies and the marching upkeep are paid
//             as for any army); its sight explores and meets peoples on the way (fog.js)
//   legs      where a march ends it picks the next unexplored tile from there, up to AI_SCOUT_LEGS
//             marches in all (scoutTarget keeps the AI_SCOUT_KM reach from where it stands)
//   back      then (or when nothing is left in reach) it marches home and the scout is over
// No omniscience: the target is picked from the nation's own explored map and its own access.
// `unit.scout = { home: cityId }` marks a scout (absent on every other unit). Pure; ties by id.
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { ringsAround } from './world/cities';
import { isExplored } from './fog';
import { stackPace, unitTile, tileAccess, passableTile } from './armies';
import { getResearched } from './nationState';
import { isUnitInBattle } from './invasion';
import { canFight } from './hostility';
import { advanceMarches } from './routes';

export const AI_SCOUT_PERIOD = 10;
export const AI_SCOUT_KM = 1500;
export const AI_SCOUT_RINGS = ringsForKm(AI_SCOUT_KM);
export const AI_SCOUT_MAX_STEPS = 2 * AI_SCOUT_RINGS;
export const AI_SCOUT_LEGS = 4;

const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
export const scoutsThisTurn = (nationId, turn) => (turn + hash(nationId)) % AI_SCOUT_PERIOD === 0;

const OPEN = new Set(['wild', 'own', 'friend']);

/**
 * A bounded breadth-first search over passable land `nationId` may enter at peace (OPEN access),
 * at most `maxDepth` steps from `from`: the path (`from` first) to the nearest tile `isGoal`
 * accepts, the lowest tile id among the nearest, or null. Bounded, so a target behind the sea or a
 * closed border costs a few hundred tiles, never a full path search. The steps ignore terrain cost
 * (the march pays it, routes.js).
 */
export const scoutPath = (state, nationId, from, isGoal, maxDepth = AI_SCOUT_RINGS) => {
  const tiles = getTiles();
  const prev = new Map([[from, -1]]);
  let level = [from];
  for (let depth = 1; depth <= maxDepth && level.length; depth++) {
    const nextLevel = [];
    let goal = null;
    for (const id of level) {
      for (const n of tiles.neighbors[id]) {
        if (prev.has(n) || !passableTile(tiles, n) || !OPEN.has(tileAccess(state, n, nationId))) continue;
        prev.set(n, id);
        nextLevel.push(n);
        if (isGoal(n) && (goal == null || n < goal)) goal = n;
      }
    }
    if (goal != null) {
      const path = [goal];
      while (path[0] !== from) path.unshift(prev.get(path[0]));
      return path;
    }
    level = nextLevel;
  }
  return null;
};

/** The nearest unexplored land tile `nationId` may march to at peace from `from`, or null. */
export const scoutTarget = (state, nationId, from) => {
  const path = scoutPath(state, nationId, from, (t) => !isExplored(state, t, nationId));
  return path ? path[path.length - 1] : null;
};

/**
 * Walks `nationId`'s marches at peace (routes.js advanceMarches) over only its marching units and
 * the units it could fight (independents, rebels) within SCOUT_NEAR_RINGS of them: the march checks
 * every unit it is given for an enemy army at each step, and walking over the whole map's units
 * cost 25 ms a turn (4 ms this way). Writes the moved units back into `next.units` in place.
 */
export const SCOUT_NEAR_RINGS = 6; // past a turn's march plus its zone of control
export const marchScouts = (next, nationId) => {
  const sub = {};
  const tiles = getTiles();
  const near = new Set();
  for (const id in next.units) {
    const u = next.units[id];
    if (u.ownerId !== nationId || !u.route?.length) continue;
    sub[id] = u;
    const at = unitTile(next, u);
    if (at != null) ringsAround(tiles, at, SCOUT_NEAR_RINGS).forEach((_, t) => near.add(t));
  }
  const hostile = new Map();
  for (const id in next.units) {
    const u = next.units[id];
    if (u.ownerId === nationId || !near.has(unitTile(next, u))) continue;
    let h = hostile.get(u.ownerId);
    if (h === undefined) { h = canFight(next, nationId, u.ownerId); hostile.set(u.ownerId, h); }
    if (h) sub[id] = u;
  }
  advanceMarches({ ...next, playerNationId: nationId }, sub, { year: next.year });
  for (const id in sub) if (sub[id] !== next.units[id]) next.units[id] = sub[id];
};

const route = (u, path, pace) =>({ ...u, route: path.slice(1), routeBank: 0, routePace: pace, routeHalt: null });

/**
 * One nation's scouting step at peace, on `next.units` (a working copy, written in place).
 * Returns true when a scout is on the road (the caller walks the marches).
 */
export const aiScout = (next, nationId) => {
  if (!next.fog || next.fog.on === false) return false;
  const researched = getResearched(next, nationId);
  const unexplored = (t) => !isExplored(next, t, nationId);
  const mine = Object.values(next.units).filter((u) => u.ownerId === nationId && u.domain === 'land' && !u.embarkedOn && u.strength > 0);
  const out = mine.filter((u) => u.scout);
  // A scout whose march is over heads home, and is done once home.
  let marching = false;
  for (const u of out) {
    if (u.route?.length) { marching = true; continue; }
    const home = next.regions[u.scout.home];
    const at = unitTile(next, u);
    // Another leg from where it stands, up to AI_SCOUT_LEGS, while something is left to find.
    if (!u.scout.returning && (u.scout.legs || 1) < AI_SCOUT_LEGS && at != null) {
      const path = scoutPath(next, nationId, at, unexplored);
      if (path) { next.units[u.id] = { ...route(u, path, stackPace([u], researched)), scout: { home: u.scout.home, legs: (u.scout.legs || 1) + 1 } }; marching = true; continue; }
    }
    if (!home || home.owner !== nationId || home.tile == null || at === home.tile) { next.units[u.id] = { ...u, scout: undefined }; continue; }
    const path = scoutPath(next, nationId, at, (t) => t === home.tile, AI_SCOUT_MAX_STEPS);
    if (!path) { next.units[u.id] = { ...u, scout: undefined }; continue; }
    next.units[u.id] = { ...route(u, path, stackPace([u], researched)), scout: { home: home.id, returning: true } };
    marching = true;
  }
  if (out.length || !scoutsThisTurn(nationId, next.turnNumber || 0)) return marching;
  // Who can go: a unit in one of its cities that keeps another unit home.
  const inCity = new Map();
  mine.forEach((u) => {
    const city = next.regions[u.regionId];
    if (u.classId === 'settler' || u.route?.length || u.indepOp || !city || city.owner !== nationId || unitTile(next, u) !== city.tile) return;
    const list = inCity.get(city.id) || []; list.push(u); inCity.set(city.id, list);
  });
  const pool = [...inCity.values()].filter((l) => l.length >= 2).flat().filter((u) => !isUnitInBattle(next, u.id));
  if (!pool.length) return marching;
  const paceOf = (u) => stackPace([u], researched);
  const scout = pool.sort((a, b) => paceOf(b) - paceOf(a) || (a.strength || 0) - (b.strength || 0) || (a.id < b.id ? -1 : 1))[0];
  const from = next.regions[scout.regionId].tile;
  const path = scoutPath(next, nationId, from, unexplored);
  if (!path) return marching;
  next.units[scout.id] = { ...route(scout, path, paceOf(scout)), scout: { home: scout.regionId } };
  return true;
};
