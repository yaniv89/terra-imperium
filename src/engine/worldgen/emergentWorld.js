// src/engine/worldgen/emergentWorld.js
// World scenarios on the tile grid (plans/civ-map-rework.md, B6). Mode 'peoples' (new games, phase
// W0) builds its cities from peoplesWorld.js: the majors drawn from the 150-people pool, one equal
// city each at the Dawn start. The legacy modes build from src/data/scenarios.js's starts: the
// full world is all 240 countries with one city each at the Dawn start; an emergent world is a
// subset of `nationCount` of them chosen for geographic spread (the player always included), the
// rest dormant until emergence (emergence.js). Old saves keep their legacy mode.
// Deterministic: the spread pick uses the seeded rng only for tie-breaks.
import { getTiles } from '../../data/geo/tiles';
import { buildScenarioStarts, DEFAULT_SCENARIO_ID, SCENARIOS } from '../../data/scenarios';
import { foundCity, emptyWorld, sizeToPeople } from '../world/cities';
import { makeSettler } from '../settlers';
import { createRng } from '../../utils/rng';
import { distanceKm } from '../../data/geo/geodesic';
import { buildPeoplesStarts } from './peoplesWorld';
import { DEFAULT_WORLD_SIZE } from '../../data/worldSizes';

export const NATION_COUNTS = [15, 30, 45, 60, 75];
export const GENERATION_VERSION = 2;

// Which nations take part in an emergent world: the player, then repeatedly the nation whose
// capital is farthest from every chosen capital (ties by the seeded roll).
export const generateStarts = (playerNationId, nationCount, seed) => {
  if (!NATION_COUNTS.includes(nationCount)) throw new Error('Unsupported nation count');
  const tiles = getTiles();
  if (tiles.capitals[playerNationId] == null) throw new Error('Unknown player nation');
  const rng = createRng(seed);
  const all = Object.keys(tiles.capitals).sort();
  const chosen = [playerNationId];
  const candidates = all.filter((id) => id !== playerNationId).map((id) => ({ id, tie: rng.next() }));
  const sep = (a, b) => distanceKm(tiles.centres[tiles.capitals[a]], tiles.centres[tiles.capitals[b]]);
  while (chosen.length < nationCount && candidates.length) {
    let best = null;
    candidates.forEach((c) => {
      const score = Math.min(...chosen.map((s) => sep(s, c.id)));
      if (!best || score > best.score || (score === best.score && c.tie > best.tie)) best = { ...c, score };
    });
    chosen.push(best.id);
    candidates.splice(candidates.findIndex((c) => c.id === best.id), 1);
  }
  const starts = {};
  chosen.forEach((id) => { starts[id] = tiles.capitals[id]; });
  return { starts, relocations: [] };
};

// Turns scenario starts into the city world: regions (one record per city, with the fields the
// rest of the engine reads), world.tileOwner, nations' capitals, and one starting army each.
// `starts`: scenarios.js buildScenarioStarts' shape (the legacy worlds) or peoplesWorld.js's.
const buildCityWorld = (initial, starts) => {
  const tiles = getTiles();
  let world = emptyWorld();
  const nations = { ...initial.nations };
  const units = {};
  const founded = {}; // nationId -> [cityId]
  // 1. Found every city (a later capital takes precedence over an earlier ring, see foundCity).
  Object.keys(starts).sort().forEach((nationId) => {
    if (!nations[nationId]) return;
    founded[nationId] = [];
    starts[nationId].cities.forEach(({ tile, size, name }, i) => {
      const r = foundCity(world, tiles, { nationId, tile, name, size, turn: 1, isCapital: i === 0 });
      world = r.world;
      founded[nationId].push(r.city.id);
    });
  });
  // 2. The scenario's wider claims (rings by age) go to the nearest city of their nation.
  const tileOwner = { ...world.tileOwner };
  const extraTiles = {};
  Object.keys(founded).sort().forEach((nationId) => {
    const cityIds = founded[nationId];
    starts[nationId].tiles.forEach((t) => {
      if (tileOwner[t]) return;
      let best = cityIds[0]; let bestD = Infinity;
      cityIds.forEach((cid) => { const d = distanceKm(tiles.centres[t], tiles.centres[world.cities[cid].tile]); if (d < bestD) { bestD = d; best = cid; } });
      tileOwner[t] = best;
      (extraTiles[best] ||= []).push(t);
    });
  });
  // 3. Records: the city plus the fields the rest of the engine reads.
  const regions = {};
  Object.keys(founded).sort().forEach((nationId) => {
    const base = nations[nationId];
    founded[nationId].forEach((cid, i) => {
      const city = world.cities[cid];
      const size = city.size;
      regions[cid] = {
        ...city,
        tiles: [...city.tiles, ...(extraTiles[cid] || [])],
        founderId: nationId,
        owner: nationId,
        control: 100,
        currentPopulation: sizeToPeople(size),
        currentInfrastructure: 0,
        underInvasion: false,
        unrest: 0,
        defenseLevel: 0,
        climateResilience: 0,
        dev: { tax: size, production: size, manpower: size },
        buildings: city.buildings
      };
      if (i === 0) {
        nations[nationId] = { ...base, capitalRegionId: cid, startRegionCount: founded[nationId].length, frontierClaims: 0 };
        if (nationId !== initial.playerNationId) nations[nationId].economy = { ...initial.resources, supplies: 20 };
        const unitId = `start_${nationId}`;
        units[unitId] = { id: unitId, ownerId: nationId, regionId: cid, homeRegionId: cid, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null };
        // The Dawn settlers of the five great river peoples (scenarios.js DAWN_SETTLER_NATIONS).
        for (let k = 0; k < (starts[nationId].settlers || 0); k++) units[`settler_${nationId}${k ? k : ''}`] = makeSettler(`settler_${nationId}${k ? k : ''}`, regions[cid], nationId);
      }
    });
  });
  return { regions, nations, units, world: { tileOwner, tileState: world.tileState }, activeNationIds: Object.keys(founded).sort() };
};

// The peoples world (peoplesWorld.js): `initial.nations` already holds the drawn majors only.
const applyPeoplesScenario = (initial, { size = DEFAULT_WORLD_SIZE, seed = 1, start = DEFAULT_SCENARIO_ID, map = { kind: 'earth' }, sites = null }) => {
  if (start !== 'dawn') throw new Error('The peoples world starts at Dawn only');
  const ids = Object.keys(initial.nations).sort();
  const built = buildCityWorld(initial, buildPeoplesStarts(ids, sites));
  const starts = {};
  built.activeNationIds.forEach((id) => { starts[id] = built.nations[id].capitalRegionId; });
  return {
    ...initial,
    nations: built.nations,
    regions: built.regions,
    units: built.units,
    world: built.world,
    resources: { ...initial.resources, supplies: 20 },
    scenario: { mode: 'peoples', start, generationVersion: GENERATION_VERSION, seed, worldSize: size, nationCount: ids.length, activeNationIds: built.activeNationIds, starts, relocations: [], dormantNationIds: [], map, ...(sites ? { sites } : {}) }
  };
};

export const applyScenario = (initial, { mode = 'full', nationCount = 45, seed = 1, start = DEFAULT_SCENARIO_ID, size, map = { kind: 'earth' }, sites = null } = {}) => {
  if (!SCENARIOS[start]) throw new Error(`Unsupported start ${start}`);
  if (mode === 'peoples') return applyPeoplesScenario(initial, { size, seed, start, map, sites });
  if (mode !== 'full' && mode !== 'emergent') throw new Error('Unsupported world mode');
  const allIds = Object.keys(initial.nations);
  const nationIds = mode === 'emergent' ? Object.keys(generateStarts(initial.playerNationId, nationCount, seed).starts) : allIds;
  // The player's nation is placed first on its real capital (scenarios.js spreadCapitals); a nation
  // with no room at the start (the legacy full world's crowded small lands) is absent.
  const built = buildCityWorld(initial, buildScenarioStarts(getTiles(), start, nationIds, { priority: initial.playerNationId }).starts);
  const dormantNationIds = allIds.filter((id) => !built.activeNationIds.includes(id));
  // An emergent world carries only its active peoples; the dormant ones return through emergence.
  // The full world leaves out the nations with no room at the start (settle-rules R4, option A):
  // they are listed as dormant and never emerge (emergence runs in emergent worlds only).
  built.nations =Object.fromEntries(built.activeNationIds.map((id) => [id, built.nations[id]]));
  const starts = {};
  built.activeNationIds.forEach((id) => { starts[id] = built.nations[id].capitalRegionId; });
  return {
    ...initial,
    nations: built.nations,
    regions: built.regions,
    units: built.units,
    world: built.world,
    resources: { ...initial.resources, supplies: 20 },
    scenario: { mode, start, generationVersion: GENERATION_VERSION, seed, nationCount: mode === 'emergent' ? nationCount : allIds.length, activeNationIds: built.activeNationIds, starts, relocations: [], dormantNationIds, map: { kind: 'earth' } }
  };
};
