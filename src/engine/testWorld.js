// src/engine/testWorld.js
// Helpers for tests on the tile world (plans/civ-map-rework.md, workstream 3.3). The Dawn start
// gives every nation one city, so a test that needs "a second French city", "a German city that
// borders France" or "five cities with a Bank" founds them here, through the real foundCity, on
// the nearest free land. Not used by the game.
import { getTiles } from '../data/geo/tiles';
import { foundCity, sizeToPeople, canFoundCity, ringDistance } from './world/cities';
import { syncWorldRegistry } from './world/registry';
import { getNationCapital, getNeighborIds, getOwnedRegionIds } from '../data/regions';
import { getTouchingIds } from '../data/regions';
import { createInitialState } from './gameReducer';

export const cap = (nationId) => getNationCapital(nationId);

// Founds a city for `nationId` on the nearest free, settleable land tile to `near` (a tile id or
// a region id) that the settling rule allows (cities.canFoundCity: clear of every city, 4 rings on
// one landmass, 3 across water), as a settler's city must be. `loose`: only not beside another
// city (the old fixture rule), for tests that need cities packed tighter than the game allows
// (two lands that touch after a conquest); such a state fails the audit's city_spacing check.
// Returns { state, cityId }.
export const addCity = (state, nationId, { near = null, size = 2, name = null, isCapital = false, loose = false } = {}) => {
  const tiles = getTiles();
  const from = near == null ? state.regions[state.nations[nationId].capitalRegionId].tile : (typeof near === 'string' ? state.regions[near].tile : near);
  const tileOwner = state.world?.tileOwner || {};
  const world = { cities: state.regions, tileOwner, tileState: state.world?.tileState || {} };
  const cityTiles = Object.values(state.regions).map((c) => c.tile);
  const clear = (t) => (loose
    ? tiles.terrainOf(t) !== 'snow' && tiles.featureOf(t) !== 'ice' && cityTiles.every((c) => ringDistance(tiles, c, t, 1) >= 2)
    : canFoundCity(world, tiles, t, nationId).ok);
  let frontier = [from]; const seen = new Set(frontier); let found = null;
  for (let d = 0; d < 30 && !found; d++) {
    const next = [];
    for (const t of frontier) {
      const ok = tiles.land[t] === 1 && !tileOwner[t] && clear(t);
      if (ok) { found = t; break; }
      tiles.neighbors[t].forEach((n) => { if (!seen.has(n)) { seen.add(n); next.push(n); } });
    }
    frontier = next.sort((a, b) => a - b);
  }
  if (found == null) throw new Error(`testWorld.addCity: no free land near ${from}`);
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

// A city of `a` and a city of `b` whose lands touch (registry `touching`, no Dawn bridge), or null.
export const touchingPair = (state, a, b) => {
  for (const id of getOwnedRegionIds(state.regions, a)) {
    const other = getTouchingIds(id).find((n) => state.regions[n]?.owner === b);
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

// A grown realm for late-game fixtures: every city of `nationId` takes the free land within two
// rings, is set to `size` and gets the building tiers in `categories` (a Dawn city owns a few
// tiles and makes a few gold; a modern nation needs more). Returns the state.
export const growCities = (state, nationId, { size = 8, categories = { science: 3, economy: 3, industry: 2 } } = {}) => {
  const tiles = getTiles();
  const regions = { ...state.regions }; const tileOwner = { ...state.world.tileOwner };
  Object.values(regions).forEach((c) => {
    if (c.owner !== nationId || c.tile == null) return;
    const ring2 = [...new Set(tiles.neighbors[c.tile].flatMap((t) => [t, ...tiles.neighbors[t]]))];
    const extra = ring2.filter((t) => t !== c.tile && tiles.land[t] === 1 && tileOwner[t] == null);
    extra.forEach((t) => { tileOwner[t] = c.id; });
    regions[c.id] = { ...c, tiles: [...new Set([...(c.tiles || [c.tile]), ...extra])], size, buildings: { ...(c.buildings || {}), categories: { ...(c.buildings?.categories || {}), ...categories } } };
  });
  return syncWorldRegistry({ ...state, regions, world: { ...state.world, tileOwner } });
};

// ---- A small fixed-seed peoples world (the only kind of world a new game starts) ----
// The replacement for `createInitialState({ playerNationId: 'fr' })`, which builds the retired
// 240-country world (plans/legacy-world-retirement.md). Same arguments give the same world, and a
// state is built once per argument set and shared: tests spread over it and never mutate it.
// `independents: false` leaves the independent cities out (majors only), the cheap default.
const peoplesCache = new Map();
export const peoplesWorld = ({ player = 'akkad', seed = 11, size = 'small', independents = false, fog = true } = {}) => {
  const key = `${player}|${seed}|${size}|${independents}|${fog}`;
  if (!peoplesCache.has(key)) peoplesCache.set(key, createInitialState({ playerNationId: player, rngSeed: seed, fog, scenario: { mode: 'peoples', size, seed, independents } }));
  return peoplesCache.get(key);
};

// The major nations of a world, the player first, then by id (never the independent cities).
export const majorIds = (state) => Object.values(state.nations)
  .filter((n) => n.kind !== 'independent')
  .map((n) => n.id)
  .sort((a, b) => (a === state.playerNationId ? -1 : b === state.playerNationId ? 1 : a < b ? -1 : 1));

// The first major that is not the player (a stand-in for "the rival", "Germany" in old tests).
export const rivalOf = (state, n = 0) => majorIds(state).filter((id) => id !== state.playerNationId)[n];

// A copy of a world a test may change in place (regions, nations, units, wars deep-copied). The fog
// stays shared: its arrays are classes (a structured clone would strip their JSON form).
export const cloneWorld = (state) => ({
  ...state,
  regions: structuredClone(state.regions),
  nations: structuredClone(state.nations),
  units: structuredClone(state.units || {}),
  wars: structuredClone(state.wars || []),
  world: structuredClone(state.world)
});

// The world with a city of `b` founded beside a city of `a`, so the two borders touch (the peoples
// start has every people far from the rest). Returns the same state when they already border.
export const withBorder = (state, a, b) => {
  if (borderPair(state, a, b)) return state;
  let s = addCity(state, b, { near: state.nations[a].capitalRegionId }).state;
  if (!borderPair(s, a, b)) s = addCity(s, a, { near: getOwnedRegionIds(s.regions, b).slice(-1)[0] }).state;
  if (!borderPair(s, a, b)) throw new Error('testWorld.withBorder: the two peoples still do not border');
  return s;
};

// Moves a nation's capital to another of its cities (flags, record and registry).
export const makeCapital = (state, nationId, cityId) => {
  const regions = { ...state.regions };
  Object.values(regions).forEach((c) => { if (c.owner === nationId && c.isCapital && c.id !== cityId) regions[c.id] = { ...c, isCapital: false }; });
  regions[cityId] = { ...regions[cityId], isCapital: true };
  const next = { ...state, regions, nations: { ...state.nations, [nationId]: { ...state.nations[nationId], capitalRegionId: cityId } } };
  syncWorldRegistry(next);
  return next;
};

// A peoples world where the player's people border its first `rivals` rivals (a city of each is
// founded beside the player's capital; `capitals: true` also makes it the rival's capital), for tests that fought over borders in the old country world.
// Cached like peoplesWorld; the same arguments give the same world.
const neighbourCache = new Map();
export const neighbourWorld = ({ rivals = 4, capitals = false, ...opts } = {}) => {
  const base = peoplesWorld(opts);
  const key = `${rivals}|${capitals}|${JSON.stringify(opts)}`;
  if (!neighbourCache.has(key)) {
    let s = base;
    for (let i = 0; i < rivals; i++) {
      const rival = rivalOf(base, i);
      s = withBorder(s, base.playerNationId, rival);
      // With capitals: true the city beside the player's land becomes the rival's capital, so two capitals border (Paris and Berlin in the old fixture).
      if (capitals) s = makeCapital(s, rival, borderPair(s, base.playerNationId, rival)[1]);
    }
    neighbourCache.set(key, s);
  }
  return neighbourCache.get(key);
};
