// src/engine/fleets.js
// Fleets on sea tiles (plans/civ-map-rework.md, D1 and D5b; workstream 5). A fleet is in PORT
// when it stands on a city's centre tile (its `regionId`), and AT SEA when its `tile` is a water
// tile (its `regionId` stays its last port, the record every older reader keeps using). Cargo
// rides along: an embarked unit's tile is its carrier's.
//   Pace       NAVAL_MOVES_BY_AGE water tiles a turn (NAVAL_KM_BY_AGE in km) by the owner's effective age (3 at Dawn, 8
//              in the Modern age); every water tile costs 1.
//   Depth      coast and shelf tiles ('coast') are open to everyone; the deep ocean ('ocean')
//              opens with the Age of Gunpowder (DEEP_OK_FROM, the old sea-lane rule); lakes never.
//   Ports      a route starts from a port by stepping onto any water tile next to the city's land
//              and ends in a port the same way; an own or allied port is entered, an enemy port
//              at war halts the fleet outside (the engagement is an action), a closed one refuses.
//   Landing    a fleet next to a coast disembarks onto that tile (DISEMBARK_UNIT `tile`) on own,
//              allied or free land; a landing on enemy land is AMPHIBIOUS_ASSAULT (invasion.js),
//              from a port in reach as before or from any tile next to the city's land.
//   Blockade   an enemy warship on a water tile next to a city's land, with no warship of the
//              owner there, blockades it: its sea trade stops (tradeRoutes.js); siege regen is
//              workstream 6's.
// Pure; ties in the path search break on tile id.
import { getTiles, onWorldChange } from '../data/geo/tiles';
import { ringsForKm, cellsForAreaKm2, minStepsBetween } from '../data/geo/gridScale';
import { getEffectiveAgeId } from '../data/ages';
import { canAttack, canFight } from './hostility';
import { getTechAgeId } from './nationState';
import { regionAccess, unitTile } from './armies';
import { mapEffectsFor } from './techMapEffects';

// A fleet's pace in km a turn by age, turned into water tiles of the loaded grid (gridScale.js):
// 4, 6, 7, 8, 11 tiles at frequency 75 and 5, 8, 9, 11, 15 at frequency 100. Tech bonuses
// (techMapEffects navalMoves) are km too and are added before the conversion.
export const NAVAL_KM_BY_AGE = { bronze: 409, classical: 613, kingdoms: 715, gunpowder: 818, modern: 1124 };
export const NAVAL_MOVES_BY_AGE = Object.fromEntries(Object.entries(NAVAL_KM_BY_AGE).map(([age, km]) => [age, ringsForKm(km)]));
export const DEEP_OK_FROM = ['gunpowder', 'modern'];
// The shelf (ocean tiles beside the coast) opens from the Classical age, or earlier with a tech
// that sails further (techMapEffects navalMoves); the deep ocean from the Age of Gunpowder or a
// tech that opens the ocean (deepOcean).
export const SHELF_OK_FROM = ['classical', 'kingdoms', 'gunpowder', 'modern'];
// A voyage's reach and the search budget in km and km² of the loaded grid (gridScale.js).
export const MAX_SEA_STEPS = ringsForKm(17_400);        // 170 steps at frequency 75
const MAX_SEARCH = cellsForAreaKm2(108_810_000);       // 12000 tiles at frequency 75

export const isFleet = (u) => u?.domain === 'naval';
export const fleetAge = (state, nationId) => getEffectiveAgeId(state.age, getTechAgeId(state, nationId));
export const fleetPace = (state, unit) => ringsForKm((NAVAL_KM_BY_AGE[fleetAge(state, unit.ownerId)] || NAVAL_KM_BY_AGE.bronze) + mapEffectsFor(state, unit.ownerId).navalMoves); // techs that sail further (techMapEffects.js)
export const deepOk = (ageId, deepTech = false) => deepTech || DEEP_OK_FROM.includes(ageId);
export const shelfOk = (ageId, shelfTech = false) => shelfTech || SHELF_OK_FROM.includes(ageId) || deepOk(ageId);

/** The depth class of a water tile: 'lake', 'coast' (the coast terrain), 'shelf' (ocean beside
 * the coast), 'deep' (the open ocean); null on land. Memoised per tile. */
const depthMemo = new Map();
onWorldChange(() => depthMemo.clear());
export const seaDepth = (tiles, tile) => {
  if (tile == null || tile < 0 || tiles.land[tile] === 1) return null;
  let d = depthMemo.get(tile);
  if (d) return d;
  const ter = tiles.terrainOf(tile);
  d = ter === 'lake' ? 'lake' : ter !== 'ocean' ? 'coast' : tiles.neighbors[tile].some((n) => tiles.land[n] !== 1 && tiles.terrainOf(n) !== 'ocean' && tiles.terrainOf(n) !== 'lake') ? 'shelf' : 'deep';
  depthMemo.set(tile, d);
  return d;
};

/** Water a fleet of this age may sail (`deepTech`: the nation's techs open the ocean). */
export const seaPassable = (tiles, tile, ageId, deepTech = false, shelfTech = false) => {
  const d = seaDepth(tiles, tile);
  return d === 'coast' || (d === 'shelf' && shelfOk(ageId, shelfTech)) || (d === 'deep' && deepOk(ageId, deepTech));
};

/** True when a fleet stands at sea (not in a port). */
export const atSea = (state, unit) => { const t = unit.tile; return t != null && t >= 0 && getTiles().land[t] !== 1; };

/** The water tiles next to a city's land. */
export const portWaters = (state, tiles, cityId) => {
  const city = state.regions[cityId];
  if (!city) return [];
  const out = new Set();
  (city.tiles || [city.tile]).forEach((t) => tiles.neighbors[t].forEach((n) => { if (tiles.land[n] !== 1 && tiles.terrainOf(n) !== 'lake') out.add(n); }));
  return [...out].sort((a, b) => a - b);
};

/** The city whose land touches water tile `tile` and that a fleet could enter, by owner. */
export const portsBeside = (state, tiles, tile) => {
  const tileOwner = state.world?.tileOwner || {};
  const out = new Set();
  tiles.neighbors[tile].forEach((n) => { const c = tileOwner[n]; if (c != null && state.regions[c]) out.add(c); });
  return [...out];
};

// A fleet of a nation at war with `nationId` on `tile`.
export const enemyFleetAt = (state, tile, nationId, units = state.units) => Object.values(units).some((u) => isFleet(u) && u.strength > 0 && u.ownerId !== nationId
  && unitTile(state, u) === tile && canFight(state, nationId, u.ownerId));

const heapPush = (h, item) => { h.push(item); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } };
const heapPop = (h) => {
  const top = h[0]; const last = h.pop();
  if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1; const r = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } }
  return top;
};

/**
 * The shortest sea path for a fleet of `nationId` from `from` (a water tile, or a port city's
 * centre) to `to` (a water tile, or a port city's centre). Both ends included. Returns { path,
 * cost } or { reason }.
 */
export const findSeaPath = (state, from, to, nationId = state.playerNationId) => {
  const tiles = getTiles();
  const ageId = fleetAge(state, nationId);
  const effects = mapEffectsFor(state, nationId);
  const deepTech = effects.deepOcean > 0; const shelfTech = effects.navalMoves > 0;
  if (from === to) return { reason: 'The fleet is already there.' };
  const tileOwner = state.world?.tileOwner || {};
  const fromPort = tiles.land[from] === 1 ? tileOwner[from] : null;
  const toPort = tiles.land[to] === 1 ? tileOwner[to] : null;
  if (tiles.land[from] === 1 && !fromPort) return { reason: 'A fleet sails from a port.' };
  if (tiles.land[to] === 1 && (!toPort || state.regions[toPort]?.tile !== to)) return { reason: 'A fleet can only put in at a city.' };
  if (toPort && regionAccess(state, toPort, nationId) === 'closed') {
    const owner = state.nations[state.regions[toPort]?.owner];
    return { reason: `No access to the port of ${state.regions[toPort]?.name || 'that city'}${owner ? ` (${owner.name})` : ''}.` };
  }
  if (!toPort && !seaPassable(tiles, to, ageId, deepTech, shelfTech)) return { reason: tiles.land[to] ? 'A fleet can only put in at a city.' : seaDepth(tiles, to) === 'lake' ? 'No fleet sails a lake.' : seaDepth(tiles, to) === 'shelf' ? 'Waters off the coast need the Classical age or a sailing tech.' : 'The open ocean needs the Age of Gunpowder.' };
  const starts = fromPort ? portWaters(state, tiles, fromPort).filter((t) => seaPassable(tiles, t, ageId, deepTech, shelfTech)) : [from];
  if (!starts.length) return { reason: 'No water in reach of that port.' };
  const goal = toPort ? new Set(portWaters(state, tiles, toPort)) : null;
  const h = (t) => minStepsBetween(t, to, tiles); // every step costs 1: the fewest steps the distance allows
  const dist = new Map(); const prev = new Map(); const heap = [];
  starts.forEach((t) => { dist.set(t, fromPort ? 1 : 0); prev.set(t, fromPort ? from : null); heapPush(heap, [h(t), dist.get(t), t]); });
  let end = null; let visited = 0;
  while (heap.length) {
    const [, d, id] = heapPop(heap);
    if (d > (dist.get(id) ?? Infinity)) continue;
    if (id === to || (goal && goal.has(id))) { end = id; break; }
    if (++visited > MAX_SEARCH) break;
    for (const n of tiles.neighbors[id]) {
      if (!seaPassable(tiles, n, ageId, deepTech, shelfTech)) continue;
      const nd = d + 1;
      if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, id); heapPush(heap, [nd + h(n), nd, n]); }
    }
  }
  if (end == null) return { reason: deepOk(ageId) ? 'No sea route there.' : 'No sea route there before the Age of Gunpowder (the open ocean is closed).' };
  const path = [end];
  while (prev.get(path[0]) != null) path.unshift(prev.get(path[0]));
  if (toPort) path.push(to);
  if (path.length - 1 > MAX_SEA_STEPS) return { reason: 'Too far for one voyage.' };
  return { path, cost: path.length - 1 };
};

/** True when `tile` (water) touches the land of city `cityId`. */
export const touchesCoastOf = (state, tiles, tile, cityId) => tiles.neighbors[tile].some((n) => state.world?.tileOwner?.[n] === cityId);

/** An enemy warship beside the city's coast with no warship of the owner there. */
export const isBlockaded = (state, cityId, units = state.units) => {
  const city = state.regions[cityId];
  if (!city?.owner) return false;
  const tiles = getTiles();
  const waters = new Set(portWaters(state, tiles, cityId));
  let enemy = false; let own = false;
  Object.values(units).forEach((u) => {
    if (!isFleet(u) || !(u.strength > 0)) return;
    const t = unitTile(state, u);
    if (!waters.has(t)) return;
    if (u.ownerId === city.owner) own = true;
    else if (canAttack(state, u.ownerId, city.owner)) enemy = true;
  });
  return enemy && !own;
};
