// src/engine/world/registry.js
// The bridge between the tile world and the code written for static provinces
// (plans/civ-map-rework.md, workstream 3.3). Dozens of modules read `REGIONS_DATA[id].name`,
// `getNeighborIds(id)`, `getNationCapital(nationId)` and `REGION_COORDINATES[id]` as static
// facts of the map. On the tile world those facts belong to CITIES, which are founded and
// change borders during play. So `src/data/regions.js` now exposes a registry that is rebuilt
// from game state whenever `state.regions` changes (gameReducer, resolveTurn, createInitialState
// all call syncWorldRegistry on what they return), which keeps every one of those readers
// working unchanged while they are migrated one by one to read the city itself.
//
// Deterministic and derived: everything here is a pure function of state.regions and the static
// grid, so two sessions with the same state build the same registry. Never read it for a state
// that was not the last one synced; callers that build states by hand in tests call
// syncWorldRegistry themselves.
import { getTiles } from '../../data/geo/tiles';
import { sizeToPeople, foundCity, emptyWorld } from './cities';
import { buildScenarioStarts, DEFAULT_SCENARIO_ID } from '../../data/scenarios';
import { getHistoricalPopulationShare } from '../../data/historicalPopulation';

export const WORLD_REGISTRY = {
  regions: {},      // cityId -> the static-looking record (name, neighbors, startOwner, ...)
  coordinates: {},  // cityId -> { lat, lng, extent }
  capitals: {},     // nationId -> original capital city id
  source: null      // the state.regions object this registry was built from
};

// The old terrain vocabulary (src/data/terrain.js, combatWidth.js) from a tile's classes.
export const legacyTerrainOf = (tiles, tile) => {
  const relief = tiles.reliefOf(tile); const feature = tiles.featureOf(tile); const terrain = tiles.terrainOf(tile);
  if (relief === 'mountains') return 'mountains';
  if (terrain === 'snow' || feature === 'ice' || terrain === 'tundra') return 'arctic';
  if (terrain === 'desert' && feature !== 'floodplain' && feature !== 'oasis') return 'desert';
  if (feature === 'forest' || feature === 'jungle') return 'forest';
  if (relief === 'hills') return 'hills';
  if (tiles.coastal[tile] && tiles.neighbors[tile].every((n) => !tiles.land[n] || tiles.coastal[n])) return 'island';
  if (terrain === 'plains') return 'plains';
  return 'mixed';
};

export const buildRegistry = (regions, year = -2000) => {
  const tiles = getTiles();
  const out = { regions: {}, coordinates: {}, capitals: {} };
  const owners = {};
  Object.values(regions).forEach((city) => {
    if (city?.tiles) city.tiles.forEach((t) => { owners[t] = city.id; });
  });
  const share = getHistoricalPopulationShare(year);
  Object.values(regions).forEach((city) => {
    if (!city || city.tile == null) return;
    const neighbors = new Set();
    (city.tiles || [city.tile]).forEach((t) => tiles.neighbors[t].forEach((n) => {
      const o = owners[n];
      if (o && o !== city.id) neighbors.add(o);
    }));
    const { lat, lon } = tiles.latLonOf(city.tile);
    const coastal = tiles.coastal[city.tile] === 1 || tiles.neighbors[city.tile].some((n) => !tiles.land[n]);
    out.regions[city.id] = {
      id: city.id,
      name: city.name,
      startOwner: city.founderId || city.owner,
      population: sizeToPeople(city.size || 1, share),
      neighbors: [...neighbors].sort(),
      terrain: legacyTerrainOf(tiles, city.tile),
      isCoastal: coastal,
      isCapital: !!city.isCapital,
      resources: { gold: city.size || 1, hr: city.size || 1 },
      fortification: city.walls || 0,
      infrastructure: 0,
      strategicValue: city.size || 1,
      description: city.name,
      includes: city.tiles || [city.tile],
      tile: city.tile,
      gdpMillions: (city.size || 1) * 10
    };
    out.coordinates[city.id] = { lat, lng: lon, extent: 2 };
    if (city.isCapital && city.founderId && !out.capitals[city.founderId]) out.capitals[city.founderId] = city.id;
  });
  return out;
};

// Rebuilds the registry in place when `state.regions` is a different object than last time.
export const syncWorldRegistry = (state) => {
  if (!state || !state.regions) return state;
  if (WORLD_REGISTRY.source === state.regions) return state;
  const built = buildRegistry(state.regions, state.year);
  // Mutate in place: the exported objects are shared by reference with src/data/regions.js and
  // src/data/regionCoordinates.js.
  Object.keys(WORLD_REGISTRY.regions).forEach((k) => { delete WORLD_REGISTRY.regions[k]; });
  Object.assign(WORLD_REGISTRY.regions, built.regions);
  Object.keys(WORLD_REGISTRY.coordinates).forEach((k) => { delete WORLD_REGISTRY.coordinates[k]; });
  Object.assign(WORLD_REGISTRY.coordinates, built.coordinates);
  // Capitals are the original ones: keep an entry once set, so a moved or lost capital still
  // reports the nation's native home (getNationCapital's contract).
  Object.entries(built.capitals).forEach(([nationId, cityId]) => { if (!WORLD_REGISTRY.capitals[nationId] || !WORLD_REGISTRY.regions[WORLD_REGISTRY.capitals[nationId]]) WORLD_REGISTRY.capitals[nationId] = cityId; });
  WORLD_REGISTRY.source = state.regions;
  return state;
};

// The default world: before any game exists (module-level code such as src/data/events.js's
// getNationCapital calls, and tests that read REGIONS_DATA directly), the registry holds the full
// Dawn world of 240 one-city nations, exactly what createInitialState produces. Built lazily on
// first read through the exported objects' own prototype-free lookups, so the cost is paid once.
let seeded = false;
export const ensureDefaultWorld = () => {
  if (seeded || WORLD_REGISTRY.source) return;
  seeded = true;
  const tiles = getTiles();
  const { starts } = buildScenarioStarts(tiles, DEFAULT_SCENARIO_ID);
  let world = emptyWorld();
  const regions = {};
  Object.keys(starts).sort().forEach((nationId) => {
    starts[nationId].cities.forEach(({ tile, size }, i) => {
      const r = foundCity(world, tiles, { nationId, tile, size, turn: 1, isCapital: i === 0 });
      world = r.world;
      regions[r.city.id] = { ...r.city, founderId: nationId, owner: nationId };
    });
  });
  Object.values(world.cities).forEach((c) => { regions[c.id] = { ...regions[c.id], tiles: c.tiles }; });
  const built = buildRegistry(regions, -2000);
  Object.assign(WORLD_REGISTRY.regions, built.regions);
  Object.assign(WORLD_REGISTRY.coordinates, built.coordinates);
  Object.assign(WORLD_REGISTRY.capitals, built.capitals);
};

// Forgets everything (tests that build several worlds in one process).
export const resetWorldRegistry = () => {
  Object.keys(WORLD_REGISTRY.regions).forEach((k) => { delete WORLD_REGISTRY.regions[k]; });
  Object.keys(WORLD_REGISTRY.coordinates).forEach((k) => { delete WORLD_REGISTRY.coordinates[k]; });
  Object.keys(WORLD_REGISTRY.capitals).forEach((k) => { delete WORLD_REGISTRY.capitals[k]; });
  WORLD_REGISTRY.source = null;
};

ensureDefaultWorld();
