// src/engine/testWorld.js
// Helpers for tests on the tile world (plans/civ-map-rework.md, workstream 3.3). The Dawn start
// gives every nation one city, so a test that needs "a second French city", "a German city that
// borders France" or "five cities with a Bank" founds them here, through the real foundCity, on
// the nearest free land. Not used by the game.
import { getTiles } from '../data/geo/tiles';
import { foundCity, sizeToPeople, ringDistance } from './world/cities';
import { syncWorldRegistry } from './world/registry';
import { getNationCapital, getNeighborIds, getOwnedRegionIds } from '../data/regions';
import { getTouchingIds } from '../data/regions';

export const cap = (nationId) => getNationCapital(nationId);

// Founds a city for `nationId` on the nearest free, settleable land tile to `near` (a tile id or
// a region id) at least 3 tiles from every city. Returns { state, cityId }.
export const addCity = (state, nationId, { near = null, size = 2, name = null, isCapital = false } = {}) => {
  const tiles = getTiles();
  const from = near == null ? state.regions[state.nations[nationId].capitalRegionId].tile : (typeof near === 'string' ? state.regions[near].tile : near);
  const tileOwner = state.world?.tileOwner || {};
  const cityTiles = Object.values(state.regions).map((c) => c.tile);
  let frontier = [from]; const seen = new Set(frontier); let found = null;
  for (let d = 0; d < 30 && !found; d++) {
    const next = [];
    for (const t of frontier) {
      const ok = tiles.land[t] === 1 && tiles.terrainOf(t) !== 'snow' && tiles.featureOf(t) !== 'ice' && !tileOwner[t]
        && cityTiles.every((c) => ringDistance(tiles, c, t, 1) >= 2);
      if (ok) { found = t; break; }
      tiles.neighbors[t].forEach((n) => { if (!seen.has(n)) { seen.add(n); next.push(n); } });
    }
    frontier = next.sort((a, b) => a - b);
  }
  if (found == null) throw new Error(`testWorld.addCity: no free land near ${from}`);
  const world = { cities: state.regions, tileOwner, tileState: state.world?.tileState || {} };
  const r = foundCity(world, tiles, { nationId, tile: found, size, name, turn: state.turnNumber || 1, isCapital });
  const record = { ...r.city, founderId: nationId, owner: nationId, control: 100, currentPopulation: sizeToPeople(size), currentInfrastructure: 0, underInvasion: false, unrest: 0, defenseLevel: 0, climateResilience: 0, dev: { tax: size, production: size, manpower: size }, buildings: r.city.buildings };
  const regions = { ...r.world.cities, [record.id]: record };
  const next = { ...state, regions, world: { ...(state.world || {}), tileOwner: r.world.tileOwner, tileState: r.world.tileState } };
  syncWorldRegistry(next);
  return { state: next, cityId: record.id };
};

// Adds `count` cities to a nation, each near the previous one. Returns { state, cityIds }.
export const addCities = (state, nationId, count, opts = {}) => {
  const cityIds = [];
  let s = state; let near = opts.near ?? null;
  for (let i = 0; i < count; i++) {
    const r = addCity(s, nationId, { ...opts, near });
    s = r.state; cityIds.push(r.cityId); near = r.cityId;
  }
  return { state: s, cityIds };
};

// A city of `a` and a city of `b` that border each other, or null.
export const borderPair = (state, a, b) => {
  for (const id of getOwnedRegionIds(state.regions, a)) {
    const other = getNeighborIds(id).find((n) => state.regions[n]?.owner === b);
    if (other) return [id, other];
  }
  return null;
};

// A city of `nationId` that borders no city of `otherId` (founding one if needed).
export const interiorCity = (state, nationId, otherId) => {
  const existing = getOwnedRegionIds(state.regions, nationId).find((id) => !getNeighborIds(id).some((n) => state.regions[n]?.owner === otherId));
  if (existing) return { state, cityId: existing };
  const r = addCity(state, nationId);
  return r;
};

// A land attack from inside a city needs the two lands to touch (registry `touching`). When they
// do not, this stands every land unit of `fromId` (its owner's) on a land tile beside the target's
// centre, where the attack is valid. Returns the same state when the lands touch.
export const gateTile = (state, fromId, targetId) => {
  if (getTouchingIds(fromId).includes(targetId)) return null;
  const tiles = getTiles();
  const centre = state.regions[targetId]?.tile;
  return centre == null ? null : tiles.neighbors[centre].find((n) => tiles.land[n] === 1) ?? null;
};
export const atGates = (state, fromId, targetId) => {
  const gate = gateTile(state, fromId, targetId);
  if (gate == null) return state;
  const owner = state.regions[fromId]?.owner;
  return { ...state, units: Object.fromEntries(Object.entries(state.units || {}).map(([id, u]) => [id, u.regionId === fromId && u.ownerId === owner && u.domain !== 'naval' && !u.embarkedOn ? { ...u, tile: gate } : u])) };
};
