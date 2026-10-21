// src/engine/worldgen/emergentWorld.js
// World scenarios on the tile grid (plans/civ-map-rework.md, B6). The peoples world (phase W0)
// builds its cities from peoplesWorld.js: the majors drawn from the 150-people pool, one equal
// city each (or a band, U23).
import { getTiles } from '../../data/geo/tiles';
import { DEFAULT_SCENARIO_ID, SCENARIOS } from '../../data/scenarios';
import { foundCity, emptyWorld, sizeToPeople } from '../world/cities';
import { distanceKm } from '../../data/geo/geodesic';
import { makeSettler, makeBand } from '../settlers';
import { buildPeoplesStarts } from './peoplesWorld';
import { DEFAULT_WORLD_SIZE } from '../../data/worldSizes';
import { withTechsResearched } from '../research';
import { hearthOfTile, AGRICULTURE_TECH } from '../../data/hearths';
import { isIndependentNation } from '../../data/independents';

export const GENERATION_VERSION = 2;

// Turns scenario starts into the city world: regions (one record per city, with the fields the
// rest of the engine reads), world.tileOwner, nations' capitals, and one starting army each.
// `starts`: peoplesWorld.js's shape.
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
// `band` (a new game, eight-ages plan U23): no city yet; each major is a band and a party of Hunters
// at its home (settlers.js makeBand), and founds its first village in the first turns.
const bandWorld = (initial, starts) => {
  const nations = { ...initial.nations };
  const units = {};
  Object.keys(starts).sort().forEach((id) => {
    const home = starts[id].cities[0];
    nations[id] = { ...nations[id], capitalRegionId: null, startRegionCount: 0, frontierClaims: 0 };
    if (id !== initial.playerNationId) nations[id].economy = { ...initial.resources, supplies: 20 };
    units[`band_${id}`] = makeBand(`band_${id}`, id, home);
    units[`start_${id}`] = { id: `start_${id}`, ownerId: id, regionId: null, homeRegionId: null, tile: home.tile, domain: 'land', classId: 'ranged', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null };
  });
  return { regions: {}, nations, units, world: { tileOwner: {}, tileState: {} }, activeNationIds: Object.keys(starts).sort() };
};

// A band start (U23) with independents (U34): the majors are bands, the independents already stand
// as size 1 villages (the plan: "independents start as camps or size 1 villages").
const bandedWorld = (initial, starts) => {
  const indep = Object.keys(starts).filter((id) => isIndependentNation(initial.nations[id]));
  const pick = (ids) => Object.fromEntries(ids.map((id) => [id, starts[id]]));
  const villages = buildCityWorld(initial, Object.fromEntries(indep.map((id) => [id, { ...starts[id], size: 1, cities: starts[id].cities.map((c) => ({ ...c, size: 1 })) }])));
  const bands = bandWorld(initial, pick(Object.keys(starts).filter((id) => !indep.includes(id))));
  return {
    regions: villages.regions,
    nations: { ...bands.nations, ...Object.fromEntries(indep.map((id) => [id, villages.nations[id]])) },
    units: { ...villages.units, ...bands.units },
    world: villages.world,
    activeNationIds: Object.keys(starts).sort()
  };
};

const applyPeoplesScenario = (initial, { size = DEFAULT_WORLD_SIZE, seed = 1, start = DEFAULT_SCENARIO_ID, map = { kind: 'earth' }, sites = null, band = false }) => {
  if (start !== 'dawn') throw new Error('The peoples world starts at Dawn only');
  const ids = Object.keys(initial.nations).sort();
  const peoplesStarts = buildPeoplesStarts(ids, sites);
  // A people whose home is an agricultural hearth (hearths.js, U24) already farms.
  const farming = ids.filter((id) => hearthOfTile(getTiles(), peoplesStarts[id].capital)).reduce((s, id) => withTechsResearched(s, id, [AGRICULTURE_TECH]), initial);
  const built = band ? bandedWorld(farming, peoplesStarts) : buildCityWorld(farming, peoplesStarts);
  const starts = {};
  built.activeNationIds.forEach((id) => { starts[id] = built.nations[id].capitalRegionId; });
  return {
    ...farming,
    nations: built.nations,
    regions: built.regions,
    units: built.units,
    world: built.world,
    resources: { ...initial.resources, supplies: 20 },
    scenario: { mode: 'peoples', start, ...(band ? { band: true } : {}), generationVersion: GENERATION_VERSION, seed, worldSize: size, nationCount: ids.length, activeNationIds: built.activeNationIds, starts, relocations: [], dormantNationIds: [], map, ...(sites ? { sites } : {}) }
  };
};

export const applyScenario = (initial, { mode, seed = 1, start = DEFAULT_SCENARIO_ID, size, map = { kind: 'earth' }, sites = null, band = false } = {}) => {
  if (!SCENARIOS[start]) throw new Error(`Unsupported start ${start}`);
  if (mode !== 'peoples') throw new Error('Unsupported world mode: every world is a peoples world');
  return applyPeoplesScenario(initial, { size, seed, start, map, sites, band });
};
