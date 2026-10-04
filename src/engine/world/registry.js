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
import { distanceKm, EARTH_RADIUS_KM } from '../../data/geo/geodesic';
import { sinCosDeg } from '../../utils/exactMath';
import { ringsForKm } from '../../data/geo/gridScale';

// A radius index over city centres (unit vectors): a 3-D grid of cubes CELL_KM wide on the chord,
// so there is no pole or longitude problem and no trigonometry (the same on every engine, unlike
// asin/atan2 buckets). `near(v, km)` lists the indices within `km` of the great circle from `v`,
// sorted, so callers that sum over them add in the same order everywhere.
const RADIUS_CELL_KM = 600;
export const buildRadiusIndex = (centres) => {
  const h = RADIUS_CELL_KM / EARTH_RADIUS_KM;
  const cell = (x) => Math.floor(x / h);
  const keyOf = (ix, iy, iz) => ((ix + 64) * 128 + (iy + 64)) * 128 + (iz + 64);
  const buckets = new Map();
  centres.forEach((c, i) => { const k = keyOf(cell(c[0]), cell(c[1]), cell(c[2])); (buckets.get(k) || buckets.set(k, []).get(k)).push(i); });
  const near = (v, km) => {
    // The chord of `km` of arc: 2 sin(km / 2R), compared squared.
    const chord = 2 * sinCosDeg((km / EARTH_RADIUS_KM / 2) * (180 / Math.PI))[0];
    const limit = km >= Math.PI * EARTH_RADIUS_KM ? 4 : chord * chord;
    const span = Math.ceil(Math.min(2, chord) / h);
    const cx = cell(v[0]); const cy = cell(v[1]); const cz = cell(v[2]);
    const out = [];
    for (let dx = -span; dx <= span; dx++) {
      for (let dy = -span; dy <= span; dy++) {
        for (let dz = -span; dz <= span; dz++) {
          const list = buckets.get(keyOf(cx + dx, cy + dy, cz + dz));
          if (!list) continue;
          list.forEach((i) => {
            const c = centres[i]; const ex = c[0] - v[0]; const ey = c[1] - v[1]; const ez = c[2] - v[2];
            if (ex * ex + ey * ey + ez * ez <= limit) out.push(i);
          });
        }
      }
    }
    return out.sort((a, b) => a - b);
  };
  return { near };
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
// In km, as rings of the loaded grid (gridScale.js): 4 and 17 rings at frequency 75.
export const NEAR_RINGS = ringsForKm(410);
export const BRIDGE_RINGS = ringsForKm(1740);
// City centres never move, so the ring distance between two tiles is memoised for good (one map
// per ring limit, keyed by a number: a string key per lookup was a third of the rebuild).
const ringCache = new Map();
const ringsBetween = (tiles, from, to, maxRing) => {
  if (from === to) return 0;
  let memo = ringCache.get(maxRing);
  if (!memo) { memo = new Map(); ringCache.set(maxRing, memo); }
  const key = from * tiles.count + to;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const d = ringsBetweenRaw(tiles, from, to, maxRing);
  memo.set(key, d);
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

// Static facts of a tile, memoised for good: the tiles within NEAR_RINGS of a centre, its old
// terrain word, its lat/lon, and whether it touches the sea (a lake does not count).
const nearTilesMemo = new Map();
const bridgeMemo = new Map(); // `${capital tile}|${people}` -> { sig, bestId }
const centreFacts = new Map();
let seaTouch = null; // Int8Array: -1 unknown, 0 no, 1 yes
let staticFor = null; // the grid the memos above belong to
const forGrid = (tiles) => {
  if (staticFor === tiles) return;
  staticFor = tiles; ringCache.clear(); nearTilesMemo.clear(); bridgeMemo.clear(); centreFacts.clear(); seaTouch = new Int8Array(tiles.count).fill(-1);
};
const nearTilesOf = (tiles, centre) => {
  let hit = nearTilesMemo.get(centre);
  if (hit) return hit;
  const out = []; let frontier = [centre]; const seen = new Set(frontier);
  for (let d = 1; d <= NEAR_RINGS; d++) {
    const next = [];
    for (const id of frontier) for (const n of tiles.neighbors[id]) { if (!seen.has(n)) { seen.add(n); next.push(n); out.push(n); } }
    frontier = next;
  }
  hit = Int32Array.from(out);
  nearTilesMemo.set(centre, hit);
  return hit;
};
const centreFactsOf = (tiles, tile) => {
  let hit = centreFacts.get(tile);
  if (!hit) { const { lat, lon } = tiles.latLonOf(tile); hit = { lat, lon, terrain: legacyTerrainOf(tiles, tile) }; centreFacts.set(tile, hit); }
  return hit;
};
const touchesSea = (tiles, t) => {
  if (seaTouch[t] < 0) seaTouch[t] = tiles.neighbors[t].some((n) => !tiles.land[n] && tiles.terrainOf(n) !== 'lake') ? 1 : 0;
  return seaTouch[t] === 1;
};
// Scratch buffers, one slot per tile, reused by every rebuild: the city index owning a tile and
// the city index centred on it (-1 for none).
let ownerBuf = null; let centreBuf = null; let markBuf = null;

// Rebuilt from scratch on every call, in time linear in the claimed tiles plus the cities: the
// ownership and centre lookups are flat typed arrays, everything static about a tile is memoised.
export const buildRegistry = (regions) => {
  const tiles = getTiles();
  const out = { regions: {}, coordinates: {}, capitals: {} };
  const cities = Object.values(regions).filter((c) => c && c.tile != null);
  forGrid(tiles);
  if (!ownerBuf || ownerBuf.length !== tiles.count) { ownerBuf = new Int32Array(tiles.count); centreBuf = new Int32Array(tiles.count); }
  ownerBuf.fill(-1); centreBuf.fill(-1);
  // Per city: the indices of its neighbours and of the cities it touches, deduplicated with two
  // stamp arrays (no Set of strings per city).
  if (!markBuf || markBuf.length < 2 * cities.length) markBuf = new Int32Array(2 * cities.length + 64);
  markBuf.fill(-1);
  const touchMark = markBuf.subarray(cities.length);
  cities.forEach((city, i) => { const own = city.tiles || [city.tile]; for (let k = 0; k < own.length; k++) ownerBuf[own[k]] = i; centreBuf[city.tile] = i; });
  const byNation = {};
  cities.forEach((c) => { (byNation[c.owner] ||= []).push(c); });
  const neighbourLists = cities.map(() => []);
  const indexOf = new Map(cities.map((c, i) => [c.id, i]));
  cities.forEach((city, i) => {
    const neighbors = neighbourLists[i];
    const add = (o) => { if (markBuf[o] !== i) { markBuf[o] = i; neighbors.push(o); } };
    // `touching`: cities whose land touches this one's (no near rule, no bridge): what a land
    // attack from inside a city needs (invasion.js); wars, trade and diffusion keep `neighbors`.
    const touching = [];
    const nation = city.founderId || city.owner;
    const own = city.tiles || [city.tile];
    for (let k = 0; k < own.length; k++) {
      const ns = tiles.neighbors[own[k]];
      for (let j = 0; j < ns.length; j++) { const o = ownerBuf[ns[j]]; if (o >= 0 && o !== i) { add(o); if (touchMark[o] !== i) { touchMark[o] = i; touching.push(cities[o].id); } } }
    }
    // Cities whose centres are within NEAR_RINGS rings of this one's.
    const near = nearTilesOf(tiles, city.tile);
    for (let k = 0; k < near.length; k++) { const o = centreBuf[near[k]]; if (o >= 0 && o !== i) add(o); }
    // The bridge links a people's CAPITAL to the nearest city of each neighbouring people, one
    // link per pair of peoples, so a nation's other cities can still be "interior".
    // Memoised per (capital, people) on the candidates' ids: it changes only when that people
    // founds, loses or wins back a city.
    if (city.isCapital) (COUNTRY_ADJACENCY[nation] || []).forEach((other) => {
      const candidates = (byNation[other] || []).filter((c) => (c.founderId || c.owner) === other);
      const memoKey = `${city.tile}|${other}`;
      let sig = ''; for (let k = 0; k < candidates.length; k++) sig += `${candidates[k].id},${candidates[k].tile};`;
      let hit = bridgeMemo.get(memoKey);
      if (!hit || hit.sig !== sig) {
        let best = null; let bestD = Infinity;
        candidates.forEach((c) => { const d = ringsBetween(tiles, city.tile, c.tile, BRIDGE_RINGS); if (d < bestD) { bestD = d; best = c; } });
        hit = { sig, bestId: best ? best.id : null };
        bridgeMemo.set(memoKey, hit);
      }
      if (hit.bestId != null) add(indexOf.get(hit.bestId));
    });
    const { lat, lon, terrain } = centreFactsOf(tiles, city.tile);
    // Coastal when the city's land touches the sea (a lake does not count) through its centre or
    // through a tile of the founder's own country: on a 147 km grid Bern's first ring reaches a
    // Lombard tile that touches the Ligurian Sea, which must not make Switzerland a sea power.
    const coastal = own.some((t) => tiles.land[t] === 1 && (t === city.tile || tiles.countryOf(t) === nation) && touchesSea(tiles, t));
    out.regions[city.id] = {
      id: city.id,
      ownerNow: city.owner,
      name: city.name,
      startOwner: city.founderId || city.owner,
      population: sizeToPeople(city.size || 1),
      neighbors: null,
      touching: touching.sort(),
      terrain,
      isCoastal: coastal,
      isCapital: !!city.isCapital,
      resources: { gold: city.size || 1, hr: city.size || 1 },
      fortification: city.walls || 0,
      infrastructure: 0,
      strategicValue: city.size || 1,
      description: city.name,
      includes: own,
      tile: city.tile,
      gdpMillions: (city.size || 1) * 10
    };
    out.coordinates[city.id] = { lat, lng: lon, extent: 2 };
    if (city.isCapital && city.founderId && !out.capitals[city.founderId]) out.capitals[city.founderId] = city.id;
  });
  // A landlocked city with no neighbour at all (Brasília or Canberra at the Dawn start) links to
  // the nearest city anywhere, so no city is cut off from the world before armies walk tiles. A
  // coastal one (an island, Tokyo) is reached by sea instead (src/data/navalReach.js).
  cities.forEach((city, i) => {
    if (neighbourLists[i].length || out.regions[city.id].isCoastal) return;
    let best = null; let bestD = Infinity;
    cities.forEach((c) => {
      if (c.id === city.id) return;
      const d = distanceKm(tiles.centres[city.tile], tiles.centres[c.tile]);
      if (d < bestD || (d === bestD && c.id < best)) { bestD = d; best = c.id; }
    });
    if (best) neighbourLists[i].push(indexOf.get(best));
  });
  // Symmetric: the bridge rule picks one nearest city per side, so close the pairs.
  const forward = neighbourLists.map((l) => l.slice());
  forward.forEach((list, i) => list.forEach((o) => { if (!neighbourLists[o].includes(i)) neighbourLists[o].push(i); }));
  cities.forEach((city, i) => { out.regions[city.id].neighbors = neighbourLists[i].map((o) => cities[o].id).sort(); });
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
    starts[nationId].cities.forEach(({ tile, size, name }, i) => {
      const r = foundCity(world, tiles, { nationId, tile, name, size, turn: 1, isCapital: i === 0 });
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
