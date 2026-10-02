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
import COUNTRY_ADJACENCY from '../../data/geo/countries-adjacency.json';
import { fromLatLon, distanceKm } from '../../data/geo/geodesic';

// A small lat/lon bucket index over city centres (unit vectors), with a radius query in km.
export const buildRadiusIndex = (centres, step = 3) => {
  const buckets = new Map();
  const key = (lat, lon) => `${Math.floor((lat + 90) / step)},${Math.floor((lon + 180) / step)}`;
  const latLon = centres.map((c) => ({ lat: (Math.asin(Math.max(-1, Math.min(1, c[2]))) * 180) / Math.PI, lon: (Math.atan2(c[1], c[0]) * 180) / Math.PI }));
  latLon.forEach((p, i) => { const k = key(p.lat, p.lon); (buckets.get(k) || buckets.set(k, []).get(k)).push(i); });
  const within = (lat, lon, km) => {
    const v = fromLatLon(lat, lon);
    const span = Math.ceil(km / 111 / step) + 1;
    const cosDot = Math.cos(km / 6371);
    const out = [];
    const bl = Math.floor((lat + 90) / step); const bo = Math.floor((lon + 180) / step);
    const cols = Math.ceil(360 / step);
    for (let dl = -span; dl <= span; dl++) {
      for (let dn = -span; dn <= span; dn++) {
        const list = buckets.get(`${bl + dl},${((bo + dn) % cols + cols) % cols}`);
        if (!list) continue;
        list.forEach((i) => { const c = centres[i]; if (c[0] * v[0] + c[1] * v[1] + c[2] * v[2] >= cosDot) out.push(i); });
      }
    }
    return out;
  };
  return { within };
};

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

// City adjacency on a sparse world (B4, D1 until armies walk tiles in workstream 5): two cities
// are neighbours when their land touches, when their centres are within NEAR_RINGS tiles, or,
// for two different peoples whose modern countries border each other, when they are the nearest
// cities of those peoples within BRIDGE_RINGS tiles. The last rule is the bridge that keeps wars,
// trade and AI fronts working on the Dawn world, where only 10% of the land is claimed.
export const NEAR_RINGS = 3;
export const BRIDGE_RINGS = 12;
// City centres never move, so the ring distance between two tiles is memoised for good.
const ringCache = new Map();
const ringsBetween = (tiles, from, to, maxRing) => {
  if (from === to) return 0;
  const key = `${from}|${to}|${maxRing}`;
  const hit = ringCache.get(key);
  if (hit !== undefined) return hit;
  const d = ringsBetweenRaw(tiles, from, to, maxRing);
  ringCache.set(key, d);
  return d;
};
const ringsBetweenRaw = (tiles, from, to, maxRing) => {
  let frontier = [from]; const seen = new Set(frontier);
  for (let d = 1; d <= maxRing; d++) {
    const next = [];
    for (const id of frontier) for (const n of tiles.neighbors[id]) { if (seen.has(n)) continue; if (n === to) return d; seen.add(n); next.push(n); }
    frontier = next;
  }
  return Infinity;
};

// Neighbour lists depend only on which cities exist, their land and their owners: cached on that
// key, so a turn that changes sizes and yields alone rebuilds nothing expensive.
let neighbourCache = { key: null, byCity: null };

export const buildRegistry = (regions) => {
  const tiles = getTiles();
  const out = { regions: {}, coordinates: {}, capitals: {} };
  const owners = {};
  const cities = Object.values(regions).filter((c) => c && c.tile != null);
  cities.forEach((city) => { (city.tiles || [city.tile]).forEach((t) => { owners[t] = city.id; }); });
  // Cities by tile bucket for the distance rules (a 2-degree bucket index like geodesic.js's).
  const index = buildRadiusIndex(cities.map((c) => tiles.centres[c.tile]));
  const nearCities = (city, rings) => {
    const { lat, lon } = tiles.latLonOf(city.tile);
    const km = rings * 150 + 60;
    const found = index.within(lat, lon, km).map((i) => cities[i]).filter((c) => c.id !== city.id);
    return found.filter((c) => ringsBetween(tiles, city.tile, c.tile, rings) <= rings);
  };
  const byNation = {};
  cities.forEach((c) => { (byNation[c.owner] ||= []).push(c); });
  const geoKey = cities.map((c) => `${c.id}:${c.owner}:${c.founderId || ''}:${(c.tiles || [c.tile]).length}:${c.isCapital ? 1 : 0}`).join('|');
  const cachedNeighbours = neighbourCache.key === geoKey ? neighbourCache.byCity : null;
  const neighboursOut = {};
  cities.forEach((city) => {
    const neighbors = new Set(cachedNeighbours ? cachedNeighbours[city.id] : []);
    const nation = city.founderId || city.owner;
    if (!cachedNeighbours) {
    (city.tiles || [city.tile]).forEach((t) => tiles.neighbors[t].forEach((n) => {
      const o = owners[n];
      if (o && o !== city.id) neighbors.add(o);
    }));
    nearCities(city, NEAR_RINGS).forEach((c) => neighbors.add(c.id));
    // The bridge links a people's CAPITAL to the nearest city of each neighbouring people, one
    // link per pair of peoples, so a nation's other cities can still be "interior".
    if (city.isCapital) (COUNTRY_ADJACENCY[nation] || []).forEach((other) => {
      const candidates = (byNation[other] || []).filter((c) => (c.founderId || c.owner) === other);
      let best = null; let bestD = Infinity;
      candidates.forEach((c) => { const d = ringsBetween(tiles, city.tile, c.tile, BRIDGE_RINGS); if (d < bestD) { bestD = d; best = c; } });
      if (best) { neighbors.add(best.id); }
    });
    }
    const { lat, lon } = tiles.latLonOf(city.tile);
    // Coastal when the city's land touches the sea (a lake does not count) through its centre or
    // through a tile of the founder's own country: on a 147 km grid Bern's first ring reaches a
    // Lombard tile that touches the Ligurian Sea, which must not make Switzerland a sea power.
    const coastal = (city.tiles || [city.tile]).some((t) => tiles.land[t] === 1 && (t === city.tile || tiles.countryOf(t) === nation)
      && tiles.neighbors[t].some((n) => !tiles.land[n] && tiles.terrainOf(n) !== 'lake'));
    out.regions[city.id] = {
      id: city.id,
      ownerNow: city.owner,
      name: city.name,
      startOwner: city.founderId || city.owner,
      population: sizeToPeople(city.size || 1),
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
  // A landlocked city with no neighbour at all (Brasília or Canberra at the Dawn start) links to
  // the nearest city anywhere, so no city is cut off from the world before armies walk tiles. A
  // coastal one (an island, Tokyo) is reached by sea instead (src/data/navalReach.js).
  cities.forEach((city) => {
    const r = out.regions[city.id];
    if (cachedNeighbours || r.neighbors.length || r.isCoastal) return;
    let best = null; let bestD = Infinity;
    cities.forEach((c) => {
      if (c.id === city.id) return;
      const d = distanceKm(tiles.centres[city.tile], tiles.centres[c.tile]);
      if (d < bestD || (d === bestD && c.id < best)) { bestD = d; best = c.id; }
    });
    if (best) r.neighbors.push(best);
  });
  // Symmetric: the bridge rule picks one nearest city per side, so close the pairs.
  Object.values(out.regions).forEach((r) => r.neighbors.forEach((n) => { const other = out.regions[n]; if (other && !other.neighbors.includes(r.id)) other.neighbors.push(r.id); }));
  Object.values(out.regions).forEach((r) => r.neighbors.sort());
  if (!cachedNeighbours) { Object.values(out.regions).forEach((r) => { neighboursOut[r.id] = r.neighbors; }); neighbourCache = { key: geoKey, byCity: neighboursOut }; }
  return out;
};

// Rebuilds the registry in place when `state.regions` is a different object than last time.
export const syncWorldRegistry = (state) => {
  if (!state || !state.regions) return state;
  if (WORLD_REGISTRY.source === state.regions) return state;
  const built = buildRegistry(state.regions);
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
  const built = buildRegistry(regions);
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
