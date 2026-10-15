// src/engine/scouting.js
// Cheap scouts for the player (playtest audit I122, W11 task 7; the user said yes on 14 October).
// Contact needs sight (fog.js), and a player whose armies run short of supplies could not explore
// at all. The AI already sends one scout in peacetime (aiScouting.js); the player now gets the
// same kind of unit, bought on purpose:
//   unit     `unit.explorer` on a Support-class unit ("Scouts"): built in any city, any age, for
//            EXPLORER_COST_SHARE of a Spearman's price (world/cities.js), EXPLORER_STRENGTH men,
//            EXPLORER_MOVE_KM a turn (armies.js movePoints). It pays normal gold upkeep.
//   supply   none: a scout lives off the land. It eats no march supplies, has no supply meter and
//            never makes the nation hungry (supplies.js, supplyMeter.js).
//   order    Explore (EXPLORE_ORDER): a march to the nearest land tile the nation has not explored
//            (`unit.explore = { auto: true }`), or to a tile the player picks. With `auto` the
//            scout picks the next unexplored tile when it arrives, until nothing is left in reach.
//   access   the same land the AI scout may cross at peace: free land, its own or a friend's
//            (aiScouting.js scoutPath). It never enters a stranger's land, never attacks, and
//            routes.js stops it at any tile that is not free, own or friend (a war cannot drag
//            it into a battle). It is never asked to fight: it holds no attack order.
//   idle     a scout on auto-explore is busy (standingOrders.js 'exploring').
// Pure. Ties go to the lowest tile id (scoutPath).
import { fogOn, isExplored } from './fog';
import { unitTile, movePoints, tileAccess, EXPLORER_MOVE_KM } from './armies';
import { getResearched } from './nationState';
import { isUnitInBattle } from './invasion';
import { scoutPath, AI_SCOUT_RINGS } from './aiScouting';
import { isExplorer } from './settlers';
import { msg } from './messages';

export const EXPLORER_STRENGTH = 300;
export { EXPLORER_MOVE_KM };
/** How far (in steps) a scout looks for something unexplored, or for a tile you picked. */
export const EXPLORE_REACH = 2 * AI_SCOUT_RINGS;

export { isExplorer };
/** The tiles a scout may stand on or enter: free land, its own nation's, a friend's. */
export const SCOUT_ACCESS = new Set(['wild', 'own', 'friend']);
export const scoutMayEnter = (state, tile, nationId) => SCOUT_ACCESS.has(tileAccess(state, tile, nationId));

/** The path (from the scout's tile) to the nearest unexplored tile it may reach, or to `toTile`;
 * { path } or { reason }. */
export const explorePath = (state, unit, toTile = null) => {
  const me = unit.ownerId;
  if (!fogOn(state)) return { reason: 'There is no fog on this map: nothing is left to find.' };
  const from = unitTile(state, unit);
  if (from == null) return { reason: 'The scouts are lost.' };
  if (toTile != null) {
    if (toTile === from) return { reason: 'The scouts are already there.' };
    const path = scoutPath(state, me, from, (t) => t === toTile, EXPLORE_REACH);
    return path ? { path } : { reason: 'The scouts cannot walk there at peace: scouts keep to free land and the land of friends.' };
  }
  const path = scoutPath(state, me, from, (t) => !isExplored(state, t, me), EXPLORE_REACH);
  return path ? { path } : { reason: 'Nothing unexplored lies within the scouts\' reach by land.' };
};

const routed = (u, path, pace, auto) => ({ ...u, hold: false, siegeOf: null, route: path.slice(1), routeBank: 0, routePace: pace, routeHalt: null, explore: { auto } });

/** EXPLORE_ORDER: the player's scouts among `unitIds` go exploring (`toTile` null: the nearest
 * unexplored land, and on from there). Returns { units, count } or { reason }. */
export const orderExplore = (state, unitIds, toTile = null) => {
  const mine = (unitIds || []).map((id) => state.units[id]).filter((u) => isExplorer(u) && u.ownerId === state.playerNationId && u.strength > 0 && !u.embarkedOn && !isUnitInBattle(state, u.id));
  if (!mine.length) return { reason: 'Only scouts can explore.' };
  const researched = getResearched(state, state.playerNationId);
  const units = { ...state.units };
  let reason = null;
  mine.forEach((u) => {
    const found = explorePath(state, u, toTile);
    if (found.path) units[u.id] = routed(u, found.path, movePoints(u, researched), toTile == null);
    else reason = reason || found.reason;
  });
  const count = mine.filter((u) => units[u.id] !== state.units[u.id]).length;
  return count ? { units, count } : { reason };
};

/** EXPLORE_ORDER with stop: the scouts stop where they stand and stop exploring. */
export const stopExplore = (state, unitIds) => {
  const mine = (unitIds || []).map((id) => state.units[id]).filter((u) => isExplorer(u) && u.ownerId === state.playerNationId && (u.explore || u.route?.length));
  if (!mine.length) return null;
  const units = { ...state.units };
  mine.forEach((u) => { units[u.id] = { ...u, route: null, routeBank: 0, routePace: null, routeHalt: null, explore: null }; });
  return units;
};

/**
 * End of turn, after the fog grew: every scout on auto-explore whose march is over picks the next
 * unexplored tile; one with nothing left in reach stops and says so. Same state when none apply.
 */
export const continueExplorers = (state) => {
  let units = null; let logs = null;
  const researched = getResearched(state, state.playerNationId);
  for (const id of Object.keys(state.units)) {
    const u = state.units[id];
    if (!u.explore?.auto || u.route?.length || u.ownerId !== state.playerNationId || !(u.strength > 0) || u.embarkedOn) continue;
    const found = explorePath(state, u);
    units = units || { ...state.units };
    if (found.path) { units[id] = routed(u, found.path, movePoints(u, researched), true); continue; }
    units[id] = { ...u, explore: null };
    logs = logs || [];
    logs.push({ year: state.year, ...msg('m.world.scoutsDone'), type: 'action' });
  }
  if (!units) return state;
  return { ...state, units, logs: logs ? [...state.logs, ...logs] : state.logs };
};

/** For the march (routes.js advanceMarches): a scout never steps onto land it may not enter. */
export const scoutBlocked = (state, unit, tile) => isExplorer(unit) && !scoutMayEnter(state, tile, unit.ownerId);
