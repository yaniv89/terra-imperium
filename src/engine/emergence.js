// src/engine/emergence.js
// New polities emerge on still-free land (plans/civ-map-rework.md, B6): every 50 turns of an
// emergent world one dormant people founds its capital city, if its capital tile and the ring
// around it are nobody's yet and no city stands within MIN_CITY_SPACING rings of it.
import { createInitialState } from './gameReducer';
import { getTiles } from '../data/geo/tiles';
import { canFoundCity, foundCity, sizeToPeople } from './world/cities';

export const processEmergence = state => {
  if (state.gameStatus !== 'ACTIVE' || state.scenario?.mode !== 'emergent' || state.turnNumber < 50 || state.turnNumber % 50 !== 0) return state;
  const tiles = getTiles();
  const tileOwner = state.world?.tileOwner || {};
  const free = (t) => !tileOwner[t] && tiles.land[t] === 1;
  // the same rule as settling: no city closer than MIN_CITY_SPACING rings (cities.canFoundCity)
  const spaced = (t, n) => canFoundCity({ cities: state.regions, tileOwner, tileState: state.world?.tileState || {} }, tiles, t, n).ok;
  const id = (state.scenario.dormantNationIds || []).find((n) => { const t = tiles.capitals[n]; return t != null && free(t) && tiles.neighbors[t].every((x) => !tileOwner[x]) && spaced(t, n); });
  if (!id) return state;
  const tile = tiles.capitals[id];
  const fresh = createInitialState({ playerNationId: state.playerNationId, rngSeed: state.rngSeed });
  const world = { cities: state.regions, tileOwner, tileState: state.world?.tileState || {} };
  const { world: nextWorld, city } = foundCity(world, tiles, { nationId: id, tile, size: 2, turn: state.turnNumber, isCapital: true });
  const regionId = city.id;
  const region = { ...city, founderId: id, owner: id, control: 100, currentPopulation: sizeToPeople(2), currentInfrastructure: 0, underInvasion: false, unrest: 0, defenseLevel: 0, climateResilience: 0, dev: { tax: 2, production: 2, manpower: 2 } };
  const unitId = `emerged_${id}_${state.turnNumber}`;
  const unit = { id: unitId, ownerId: id, regionId, homeRegionId: regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, rank: 'recruit', commanderId: null, promotions: [], xp: 0 };
  const nation = { ...fresh.nations[id], capitalRegionId: regionId, startRegionCount: 1, militaryStrength: 5000, frontierClaims: 0, economy: { gold: 500, hr: 100, techPoints: 0, adm: 3, dip: 3, mil: 3, supplies: 20 }, tech: { researched: [], ageId: state.age } };
  return {
    ...state,
    rngSeed: fresh.rngSeed,
    nations: { ...state.nations, [id]: nation },
    regions: { ...nextWorld.cities, [regionId]: region },
    world: { ...state.world, tileOwner: nextWorld.tileOwner },
    units: { ...state.units, [unitId]: unit },
    scenario: { ...state.scenario, activeNationIds: [...state.scenario.activeNationIds, id], dormantNationIds: state.scenario.dormantNationIds.filter((n) => n !== id), starts: { ...state.scenario.starts, [id]: regionId } },
    logs: [...state.logs, { year: state.year, type: 'milestone', message: `${nation.name} emerges at ${city.name}.` }]
  };
};
