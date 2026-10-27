// src/engine/sight.js
// What a nation sees on the tile map (plans/civ-map-rework.md, D1 "fog of war", first slice):
// the tiles within SIGHT_LAND of its cities' land, within SIGHT_ARMY of its land units (+1 on
// hills), within SIGHT_FLEET of its fleets, and the same around the cities of its allies and
// vassals (sight is shared). Foreign armies outside this set are fog (mapMarkers.js); intel
// (intel.js) still reveals a whole nation. The greyed "seen before" memory and the darkened map
// arrive with the lenses of workstream 12. Pure; cached on the state's units and cities.
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { unitTile, aboardShip } from './armies';
import { mapEffectsFor } from './techMapEffects';
import { navalLineOf, navalSightBonus } from '../data/navalLines';

// In km; a reach is summed in km (tech and naval-line bonuses are km too) and turned into rings
// of the loaded grid once (gridScale.js): 2, 2, 1 and 2 rings at frequency 75, 3, 3, 1, 3 at 100.
export const SIGHT_LAND_KM = 200;
export const SIGHT_ARMY_KM = 200;
export const SIGHT_HILLS_BONUS_KM = 100;
export const SIGHT_FLEET_KM = 200;
export const SIGHT_LAND = ringsForKm(SIGHT_LAND_KM);
export const SIGHT_ARMY = ringsForKm(SIGHT_ARMY_KM);
export const SIGHT_HILLS_BONUS = ringsForKm(SIGHT_HILLS_BONUS_KM);
export const SIGHT_FLEET = ringsForKm(SIGHT_FLEET_KM);

const cache = new WeakMap(); // state.units -> { regions, nationId, set }

// `seen` is what this walk already visited; an army passes its own so tiles the nation already
// sees do not cut its radius short.
const grow = (tiles, seeds, rings, out, seen = out) => {
  let frontier = seeds;
  frontier.forEach((t) => { seen.add(t); out.add(t); });
  for (let d = 0; d < rings; d++) {
    const next = [];
    for (const t of frontier) for (const n of tiles.neighbors[t]) if (!seen.has(n)) { seen.add(n); out.add(n); next.push(n); }
    frontier = next;
  }
};

const friendsOf = (state, nationId) => {
  const me = state.nations[nationId];
  const out = new Set([nationId]);
  Object.values(state.nations).forEach((n) => {
    if (n.isEliminated) return;
    if (n.vassalOf === nationId || me?.vassalOf === n.id || (n.hasMilitaryPact && me?.hasMilitaryPact)) out.add(n.id);
  });
  return out;
};

/** The set of tiles `nationId` can see this turn. */
export const visibleTiles = (state, nationId = state.playerNationId) => {
  const hit = cache.get(state.units);
  if (hit && hit.regions === state.regions && hit.nations === state.nations && hit.techTree === state.techTree && hit.nationId === nationId) return hit.set;
  const tiles = getTiles();
  const set = new Set();
  const extra = mapEffectsFor(state, nationId).sight; // techs that see further (techMapEffects.js)
  const friends = friendsOf(state, nationId);
  const landSeeds = [];
  Object.values(state.regions).forEach((c) => { if (friends.has(c.owner) && c.tile != null) landSeeds.push(...(c.tiles || [c.tile])); });
  grow(tiles, landSeeds, ringsForKm(SIGHT_LAND_KM + extra), set);
  Object.values(state.units).forEach((u) => {
    if (u.ownerId !== nationId || aboardShip(u)) return;
    const t = unitTile(state, u);
    if (t == null) return;
    grow(tiles, [t], unitRings(tiles, u, t, extra), set, new Set());
  });
  cache.set(state.units, { regions: state.regions, nations: state.nations, techTree: state.techTree, nationId, set });
  return set;
};

const unitRings = (tiles, u, t, extra) => ringsForKm(extra + (u.domain === 'naval' ? SIGHT_FLEET_KM + navalSightBonus(navalLineOf(u)) : SIGHT_ARMY_KM + (tiles.reliefOf(t) === 'hills' ? SIGHT_HILLS_BONUS_KM : 0)));

const landOwnersCache = new WeakMap(); // state.regions -> Map(tile -> [owner]): the land visibleTiles grows from
const landOwners = (regions) => {
  let m = landOwnersCache.get(regions);
  if (m) return m;
  m = new Map();
  Object.values(regions).forEach((c) => { if (c.tile == null) return; (c.tiles || [c.tile]).forEach((t) => { const l = m.get(t); if (l) l.push(c.owner); else m.set(t, [c.owner]); }); });
  landOwnersCache.set(regions, m);
  return m;
};

// The tiles around `tile` ring by ring ([[tile], ring 1, ...] up to `reach`), memoised per grid:
// geometry only, asked for the few hundred tiles armies stand on.
const ringMemo = new WeakMap(); // tiles -> Map(tile -> rings)
const ringsOf = (tiles, tile, reach) => {
  let m = ringMemo.get(tiles);
  if (!m) { m = new Map(); ringMemo.set(tiles, m); }
  const hit = m.get(tile);
  if (hit && hit.reach >= reach) return hit.rings;
  const rings = [[tile]]; const seen = new Set([tile]);
  for (let d = 0; d < reach; d++) {
    const next = [];
    for (const t of rings[d]) for (const n of tiles.neighbors[t] || []) if (!seen.has(n)) { seen.add(n); next.push(n); }
    rings.push(next);
  }
  m.set(tile, { reach, rings });
  return rings;
};

const byOwnerCache = new WeakMap(); // state.units -> Map(ownerId -> [unit])
const unitsByOwner = (units) => {
  let m = byOwnerCache.get(units);
  if (m) return m;
  m = new Map();
  Object.values(units).forEach((u) => { const l = m.get(u.ownerId); if (l) l.push(u); else m.set(u.ownerId, [u]); });
  byOwnerCache.set(units, m);
  return m;
};

const testCache = new WeakMap(); // state.units -> { regions, nations, techTree, nationId, test }
/** `(tile) => bool`, the same answer as visibleTiles(state, nationId).has(tile) without building the
 * whole set, for a caller that asks about a few tiles (warOdds.js). A tile is seen when friendly land
 * lies within the land reach of it, or one of the nation's units within that unit's reach
 * (neighbours are symmetric, so the walk starts at the asked tile). */
export const sightTest = (state, nationId = state.playerNationId) => {
  const hit = testCache.get(state.units);
  if (hit && hit.regions === state.regions && hit.nations === state.nations && hit.techTree === state.techTree && hit.nationId === nationId) return hit.test;
  const tiles = getTiles();
  const extra = mapEffectsFor(state, nationId).sight;
  const friends = friendsOf(state, nationId);
  const owners = landOwners(state.regions);
  const landRings = ringsForKm(SIGHT_LAND_KM + extra);
  const unitReach = new Map(); // tile -> the farthest reach of the nation's units on it
  let reach = landRings;
  (unitsByOwner(state.units).get(nationId) || []).forEach((u) => {
    if (aboardShip(u)) return;
    const t = unitTile(state, u);
    if (t == null) return;
    const r = unitRings(tiles, u, t, extra);
    if (!(unitReach.get(t) >= r)) unitReach.set(t, r);
    if (r > reach) reach = r;
  });
  const sees = (tile) => {
    const rings = ringsOf(tiles, tile, reach);
    for (let d = 0; d <= reach && d < rings.length; d++) {
      for (const t of rings[d]) {
        if (d <= landRings && owners.get(t)?.some((o) => friends.has(o))) return true;
        if (unitReach.get(t) >= d) return true;
      }
    }
    return false;
  };
  const memo = new Map();
  const test = (tile) => {
    if (tile == null) return false;
    if (!memo.has(tile)) memo.set(tile, sees(tile));
    return memo.get(tile);
  };
  testCache.set(state.units, { regions: state.regions, nations: state.nations, techTree: state.techTree, nationId, test });
  return test;
};

export const canSeeTile = (state, tile, nationId = state.playerNationId) => tile != null && visibleTiles(state, nationId).has(tile);
