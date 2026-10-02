// src/engine/armies.js
// Armies on tiles (plans/civ-map-rework.md, D1; workstream 5). A land unit stands on a tile
// (`unit.tile`); its `regionId` is the city whose land it stands on, or, on free land, the nearest
// city of its owner (its supply base and the record every older reader of "which province is this
// unit in" keeps using). Fleets sit on their port's centre tile until the naval wave.
//
//   Move points   MOVE_POINTS by class a turn (foot 2, cavalry 4, siege 1), +1 with Forced March.
//                 Unspent points bank up to BANK_CAP so a slow army still crosses a mountain.
//   Tile cost     entering a tile: 1 on open land, +1 for hills, +1 for forest, jungle or marsh,
//                 +1 for desert or tundra, mountains TILE_COST_MOUNTAINS (4); a river crossing
//                 RIVER_CROSSING more until Stone Bridges; a road on the tile ROAD_COST (0.5), a
//                 railway RAIL_COST (0.25). Enemy land costs at least ENEMY_TILE_COST. Snow and
//                 ice are impassable; so is water (fleets carry armies, naval wave).
//   Access        at peace a route crosses your land, a vassal's or an ally's, and free land. At
//                 war it may plan through the enemy's land, but a march halts at the border of
//                 every enemy tile you do not hold: cities are taken through the attack card, and
//                 winning moves the army in. An enemy army on the next tile halts it too.
//   Zone of control  entering a tile next to an enemy army ends the move for the turn (Civ):
//                 lines, chokepoints and flanks exist on the map.
//   Attacks       a city is attacked from any tile next to its land (invasion.js), and from inside
//                 a neighbouring city's land as before (the registry bridge keeps the sparse Dawn
//                 world connected).
// Pure and deterministic; ties in the path search break on tile id.
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { hasPerk } from '../data/promotions';
import { isWarBetween } from './diplomacy';
import { legacyTerrainOf } from './world/registry';
import { mapEffectsOf } from './techMapEffects';

export const MOVE_POINTS = { infantry: 2, ranged: 2, cavalry: 4, siege: 1, support: 2, settler: 2, air: 4 };
export const DEFAULT_MOVE_POINTS = 2;
export const TILE_COST_MOUNTAINS = 4;
export const RIVER_CROSSING = 1;
export const ROAD_COST = 0.5;
export const RAIL_COST = 0.25;
export const ENEMY_TILE_COST = 2;
export const BANK_CAP = 4;
export const MAX_ROUTE_STEPS = 60;
export const ENEMY_PATH_PENALTY = 6; // each enemy tile on the way to somewhere else counts this much more
export const MARCH_ATTRITION = 0.03;  // of strength, per step into mountains, desert or arctic land
export const BRIDGE_TECH = 'infrastructure_stone_bridges';
export const RAIL_TECH = 'infrastructure_rail_networks';
export const SUPPLY_BASE_RINGS = 20;  // how far a unit on free land looks for its nation's nearest city
const SLOW_FEATURES = new Set(['forest', 'jungle', 'marsh']);
const SLOW_TERRAIN = new Set(['desert', 'tundra']);
const HARSH_TERRAIN = new Set(['mountains', 'desert', 'arctic']);
const MAX_SEARCH = 8000;
const KM_PER_RING = 170; // a safe upper bound of the grid spacing, for the A* heuristic

export const movePoints = (unit) => (MOVE_POINTS[unit.classId] ?? DEFAULT_MOVE_POINTS) + (hasPerk(unit, 'forcedMarch') ? 1 : 0);
// The pace of a stack: its slowest unit.
export const stackPace = (units) => units.reduce((m, u) => Math.min(m, movePoints(u)), Infinity);

/** Land an army may stand on at all. */
export const passableTile = (tiles, tile) => tile != null && tile >= 0 && tiles.land[tile] === 1 && tiles.terrainOf(tile) !== 'snow' && tiles.featureOf(tile) !== 'ice';

/** The tile a unit stands on: its own (land for an army, water for a fleet at sea and its cargo),
 * else its region's centre (a unit an older mover placed by city). */
export const unitTile = (state, unit) => {
  const t = unit.tile;
  if (t != null && t >= 0) {
    if (getTiles().land[t] === 1) return t;
    if (unit.domain === 'naval' || unit.embarkedOn) return t;
  }
  return state.regions[unit.regionId]?.tile ?? null;
};

// How `nationId` relates to the city `regionId`: own | friend | wild | enemy | held (enemy land it
// occupies) | closed (no access).
export const regionAccess = (state, regionId, nationId = state.playerNationId) => {
  const r = state.regions[regionId];
  if (!r) return 'closed';
  if (r.owner === nationId) return r.occupiedBy && r.occupiedBy !== nationId ? 'enemy' : 'own';
  if (!r.owner) return 'wild';
  if (r.owner === REBEL_OWNER_ID) return 'enemy';
  if ((state.wars || []).some((w) => w.active && isWarBetween(w, nationId, r.owner))) return r.occupiedBy === nationId ? 'held' : 'enemy';
  const owner = state.nations[r.owner];
  if (owner && !owner.isEliminated && (owner.vassalOf === nationId || state.nations[nationId]?.vassalOf === r.owner || owner.hasMilitaryPact || owner.openBordersWith?.[nationId])) return 'friend';
  return 'closed';
};

/** How `nationId` relates to a tile: free land is 'wild', owned land follows its city. */
export const tileAccess = (state, tile, nationId = state.playerNationId) => {
  const city = state.world?.tileOwner?.[tile];
  return city == null ? 'wild' : regionAccess(state, city, nationId);
};

/** Movement points to step from `from` onto `to`. `researched`: the mover's tech ids. */
export const tileStepCost = (state, tiles, from, to, access = 'wild', researched = []) => {
  const road = state.world?.tileState?.[to];
  const fx = mapEffectsOf(researched); // techs that ease the ground (techMapEffects.js)
  let cost;
  if (road?.road && !road.pillaged) cost = researched.includes(RAIL_TECH) ? RAIL_COST : Math.max(0.2, ROAD_COST + fx.roadCost);
  else if (tiles.reliefOf(to) === 'mountains') cost = Math.max(1, TILE_COST_MOUNTAINS + fx.mountainCost);
  else {
    cost = 1;
    if (tiles.reliefOf(to) === 'hills') cost += Math.max(0, 1 + fx.hillsCost);
    if (SLOW_FEATURES.has(tiles.featureOf(to))) cost += 1;
    if (SLOW_TERRAIN.has(tiles.terrainOf(to))) cost += 1;
  }
  if (from != null && tiles.riverBetween(from, to) && !researched.includes(BRIDGE_TECH)) cost += RIVER_CROSSING;
  if (access === 'enemy' || access === 'held') cost = Math.max(cost, ENEMY_TILE_COST);
  return cost;
};

export const isHarsh = (tiles, tile) => HARSH_TERRAIN.has(legacyTerrainOf(tiles, tile));

// A land unit of a nation at war with `nationId` (or rebels) standing on `tile`.
export const enemyArmyAt = (state, tile, nationId, units = state.units) => Object.values(units).some((u) => u.domain !== 'naval' && !u.embarkedOn && u.strength > 0 && u.classId !== 'settler'
  && u.ownerId !== nationId && unitTile(state, u) === tile
  && (u.ownerId === REBEL_OWNER_ID || (state.wars || []).some((w) => w.active && isWarBetween(w, nationId, u.ownerId))));

/** True when an enemy army stands on a tile next to `tile` (zone of control). */
export const inEnemyZoc = (state, tiles, tile, nationId, units = state.units) => tiles.neighbors[tile].some((n) => enemyArmyAt(state, n, nationId, units));

// A tiny binary heap for the path search.
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

/**
 * The cheapest land path from tile `from` to tile `to` for `nationId` (A* by step cost, both ends
 * included). Enemy land is allowed (a march halts at it), closed land is not. Returns { path,
 * cost } or { reason }.
 */
export const findTilePath = (state, from, to, nationId = state.playerNationId, { researched = [], maxSteps = MAX_ROUTE_STEPS } = {}) => {
  const tiles = getTiles();
  if (from === to) return { reason: 'The army is already there.' };
  if (!passableTile(tiles, to)) return { reason: tiles.land[to] ? 'No army can cross that.' : 'No land route: this needs a fleet to carry the army.' };
  const targetAccess = tileAccess(state, to, nationId);
  if (targetAccess === 'closed') {
    const owner = state.nations[state.regions[state.world?.tileOwner?.[to]]?.owner];
    return { reason: `No access to ${owner?.name || 'that land'}: declare war or form an alliance.` };
  }
  const minStep = researched.includes(RAIL_TECH) ? RAIL_COST : ROAD_COST;
  const h = (t) => (distanceKm(tiles.centres[t], tiles.centres[to]) / KM_PER_RING) * minStep;
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const heap = [[h(from), 0, from]];
  let visited = 0;
  while (heap.length) {
    const [, d, id] = heapPop(heap);
    if (d > (dist.get(id) ?? Infinity)) continue;
    if (id === to) break;
    if (++visited > MAX_SEARCH) break;
    for (const n of tiles.neighbors[id]) {
      if (!passableTile(tiles, n)) continue;
      const access = tileAccess(state, n, nationId);
      if (access === 'closed') continue;
      const penalty = access === 'enemy' && n !== to ? ENEMY_PATH_PENALTY : 0;
      const nd = d + tileStepCost(state, tiles, id, n, access, researched) + penalty;
      if (nd < (dist.get(n) ?? Infinity) - 1e-9) { dist.set(n, nd); prev.set(n, id); heapPush(heap, [nd + h(n), nd, n]); }
    }
  }
  if (!dist.has(to)) return { reason: 'No land route: this needs a fleet to carry the army.' };
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0]));
  if (path.length - 1 > maxSteps) return { reason: 'Too far for one march: pick a closer place.' };
  return { path, cost: dist.get(to) };
};

// Nearest city of `nationId` to `tile` within SUPPLY_BASE_RINGS rings, or null.
const nearestCity = (state, tiles, tile, nationId) => {
  const tileOwner = state.world?.tileOwner || {};
  let frontier = [tile]; const seen = new Set(frontier);
  for (let d = 0; d <= SUPPLY_BASE_RINGS; d++) {
    const next = [];
    for (const t of frontier) {
      const city = tileOwner[t];
      if (city != null && state.regions[city]?.owner === nationId) return city;
      for (const n of tiles.neighbors[t]) if (!seen.has(n)) { seen.add(n); next.push(n); }
    }
    frontier = next.sort((a, b) => a - b);
  }
  return null;
};

/** The region record a unit of `nationId` standing on `tile` belongs to: the tile's city when it
 * is the nation's own, else the nearest own city (its base). `fallback` when nothing is in reach:
 * enemy and free land never become a unit's region. */
export const regionForTile = (state, tile, nationId, fallback = null) => {
  const owner = state.world?.tileOwner?.[tile];
  if (owner != null && state.regions[owner]?.owner === nationId) return owner;
  return nearestCity(state, getTiles(), tile, nationId) ?? fallback;
};

export const REINFORCE_RINGS = 3;   // how far from a city's centre idle troops can join its battle
export const FALLBACK_RINGS = 12;   // how far a beaten garrison looks for a city of its own to fall back to

/** Land units of `nationId` standing within `rings` of `centre` (the centre itself excluded),
 * sorted by id: the troops near a battle, a city or a siege. Settlers and cargo never count. */
export const unitsWithinRings = (state, centre, nationId, rings, units = state.units) => {
  const tiles = getTiles();
  const near = new Set();
  let frontier = [centre]; const seen = new Set(frontier);
  for (let d = 1; d <= rings; d++) {
    const next = [];
    for (const t of frontier) for (const n of tiles.neighbors[t]) if (!seen.has(n)) { seen.add(n); near.add(n); next.push(n); }
    frontier = next;
  }
  return Object.values(units)
    .filter((u) => u.ownerId === nationId && u.domain !== 'naval' && !u.embarkedOn && u.classId !== 'settler' && u.strength > 0 && near.has(unitTile(state, u)))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
};

/** The nearest city `nationId` owns and holds, by rings from `regionId`'s centre, within
 * `maxRing` (the city itself excluded); null when there is none: where a garrison falls back to. */
export const nearestHeldCity = (state, regionId, nationId, maxRing = FALLBACK_RINGS) => {
  const tiles = getTiles();
  const centre = state.regions[regionId]?.tile;
  if (centre == null) return null;
  let frontier = [centre]; const seen = new Set(frontier);
  for (let d = 1; d <= maxRing; d++) {
    const next = [];
    for (const t of frontier) for (const n of tiles.neighbors[t]) if (!seen.has(n)) { seen.add(n); next.push(n); }
    frontier = next.sort((a, b) => a - b);
    for (const t of frontier) {
      const city = state.world?.tileOwner?.[t];
      if (city && city !== regionId && state.regions[city]?.tile === t && state.regions[city]?.owner === nationId && !state.regions[city]?.occupiedBy) return city;
    }
  }
  return null;
};

/** True when `tile` touches the land of city `cityId` (or is part of it). */
export const touchesCity = (state, tiles, tile, cityId) => {
  const tileOwner = state.world?.tileOwner || {};
  return tileOwner[tile] === cityId || tiles.neighbors[tile].some((n) => tileOwner[n] === cityId);
};

/** Puts a unit on a city's centre (the shape every mover that still thinks in cities uses). */
export const placeInCity = (unit, regions, regionId) => ({ ...unit, regionId, tile: regions[regionId]?.tile ?? unit.tile ?? null });

/**
 * Makes every unit's tile and region agree: a unit without a tile (an older mover or a fresh
 * recruit) stands on its region's centre; one standing on land its own nation's other city now
 * holds (border growth, a city founded next to it) belongs to that city; one in foreign or free
 * land keeps its base (the nearest own city when its base is gone). Enemy land never becomes a
 * unit's region: the garrison readers (invasion.js, defense.js) count units by region.
 * Returns the same object when nothing changed.
 */
export const normalizeUnitTiles = (state) => {
  const tiles = getTiles();
  const regions = state.regions || {};
  const tileOwner = state.world?.tileOwner || {};
  let units = state.units || {};
  let changed = false;
  const all = state.units || {};
  Object.values(all).forEach((u) => {
    const centre = regions[u.regionId]?.tile ?? null;
    let tile = u.tile;
    let regionId = u.regionId;
    if (u.embarkedOn) {
      // Cargo rides its carrier (fleets.js).
      const ship = all[u.embarkedOn];
      if (ship) { tile = ship.tile != null && ship.tile >= 0 ? ship.tile : (regions[ship.regionId]?.tile ?? centre); regionId = ship.regionId; }
      else tile = centre;
    } else if (u.domain === 'naval') tile = tile != null && tile >= 0 && tiles.land[tile] !== 1 ? tile : centre; // at sea, or in port
    else if (tile == null || tile < 0 || !tiles.land[tile]) tile = centre;
    else {
      const here = tileOwner[tile];
      if (here != null && here !== regionId && regions[here]?.owner === u.ownerId) regionId = here;
      else if (!regions[regionId]) regionId = regionForTile(state, tile, u.ownerId, regionId);
    }
    if (tile === u.tile && regionId === u.regionId) return;
    if (!changed) { units = { ...units }; changed = true; }
    units[u.id] = { ...u, tile, regionId };
  });
  return changed ? { ...state, units } : state;
};
