// src/engine/unitLocation.js
// Where a unit IS and where it BELONGS are two facts (playtest audit I058, I059, I063; plan W03).
//
//   Physical tile   `unit.tile` is the truth (armies.js unitTile; a unit an older mover placed by
//                   city stands on that city's centre). Everything a player sees as "here", every
//                   adjacency and every rule about the ground under the army reads this.
//   Home base       `unit.regionId` is the city the unit belongs to: the city whose land it stands
//                   on when that is its nation's own, else its nation's nearest city (armies.js
//                   regionForTile). It is the supply base, the garrison record of invasion.js and
//                   defense.js, and the key the march orders are given by. It is NOT a position:
//                   an army in Sinai based at Men-nefer is in Sinai.
//
// The selectors below are the one place that turns the two into what the UI and the rules ask:
//   locationOf        tile, the city whose land it is, the base, and whether the unit is at its base
//   whereLabel        "at Men-nefer", "in the land of Siwa", "near Siwa", "in open country"
//   isStationedIn     is this unit physically in the land of the city it is based at
//   unitsStationedIn  a city's "Armies here"
//   fieldUnitsOf      the units based at a city that are away from it
//   canReinforce      may this unit take recruits this turn: it must STAND on its nation's own,
//                     unoccupied land (a field army no longer refills through a far base)
// Fleets keep the port rule (`regionId` is the port a fleet sits in or beside, fleets.js) and cargo
// follows its ship. Pure.
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { unitTile } from './armies';

/** How far a place looks for a city to be named after ("near Siwa"). */
export const NEAR_CITY_KM = 410;

/** The tile the unit stands on (the truth). */
export const physicalTile = (state, unit) => unitTile(state, unit);
/** The city the unit belongs to (its base), which may be far from where it stands. */
export const homeBaseOf = (unit) => unit?.regionId ?? null;

/** The city whose land `tile` is (any owner), or null on free land and at sea. */
export const cityOfTile = (state, tile) => (tile == null ? null : state.world?.tileOwner?.[tile] ?? null);

/** The nearest city centre to `tile` within NEAR_CITY_KM (any owner; ties: the lowest tile id), or null. */
export const nearestCityTo = (state, tile, rings = ringsForKm(NEAR_CITY_KM)) => {
  if (tile == null) return null;
  const tiles = getTiles();
  const centres = new Map();
  Object.values(state.regions || {}).forEach((c) => { if (c.tile != null && !centres.has(c.tile)) centres.set(c.tile, c.id); });
  if (centres.has(tile)) return centres.get(tile);
  let frontier = [tile]; const seen = new Set(frontier);
  for (let d = 1; d <= rings; d++) {
    const next = [];
    for (const t of frontier) for (const n of tiles.neighbors[t]) if (!seen.has(n)) { seen.add(n); next.push(n); }
    frontier = next.sort((a, b) => a - b);
    const hit = frontier.find((t) => centres.has(t));
    if (hit != null) return centres.get(hit);
  }
  return null;
};

/**
 * Where a tile is, in words: { prep, name, text, cityId, kind }.
 *   kind 'city'  the city's own tile            "at Men-nefer"
 *        'named' a named place                  "at Sinai"
 *        'land'  inside a city's land           "in the land of Siwa"
 *        'near'  free land close to a city      "near Siwa"
 *        'sea' | 'wild'                         "at sea", "in open country"
 */
export const whereLabel = (state, tile) => {
  const tiles = getTiles();
  if (tile == null) return { prep: 'in', name: 'the field', text: 'in the field', cityId: null, kind: 'wild' };
  const cityId = cityOfTile(state, tile);
  const city = cityId != null ? state.regions[cityId] : null;
  const make = (prep, name, kind, id = cityId) => ({ prep, name, text: `${prep} ${name}`, cityId: id, kind });
  if (city?.tile === tile) return make('at', city.name, 'city');
  if (tiles.land[tile] !== 1) return tiles.names?.[tile] ? make('in', tiles.names[tile], 'sea', null) : make('at', 'sea', 'sea', null);
  if (tiles.names?.[tile]) return make('at', tiles.names[tile], 'named');
  if (city) return make('in', `the land of ${city.name}`, 'land');
  const near = nearestCityTo(state, tile);
  if (near != null) return make('near', state.regions[near].name, 'near', near);
  return make('in', 'open country', 'wild', null);
};

/** Tile, the city under it, the base, and whether the unit stands in its base's land. */
export const locationOf = (state, unit) => {
  const tile = unitTile(state, unit);
  const cityId = cityOfTile(state, tile);
  const baseId = homeBaseOf(unit);
  return { tile, cityId, onCentre: cityId != null && state.regions[cityId]?.tile === tile, baseId, atBase: cityId != null && cityId === baseId };
};

/** Is the unit physically in the city it is based at? A fleet counts by its port, cargo by its ship. */
export const isStationedIn = (state, unit, cityId) => {
  if (!unit || unit.regionId !== cityId) return false;
  if (unit.domain === 'naval' || unit.embarkedOn) return true;
  // A world without a tile owner map (an old fixture) only knows the base.
  if (!state.world?.tileOwner) return true;
  return cityOfTile(state, unitTile(state, unit)) === cityId;
};

/** A city's "Armies here": the units based at it that stand in its land (every owner), by id. */
export const unitsStationedIn = (state, cityId, units = state.units) => Object.values(units || {})
  .filter((u) => isStationedIn(state, u, cityId))
  .sort((a, b) => (a.id < b.id ? -1 : 1));

/** The units of `nationId` based at the city that are away from it (in the field), by id. */
export const fieldUnitsOf = (state, cityId, nationId = state.playerNationId, units = state.units) => Object.values(units || {})
  .filter((u) => u.regionId === cityId && u.ownerId === nationId && u.strength > 0 && !isStationedIn(state, u, cityId))
  .sort((a, b) => (a.id < b.id ? -1 : 1));

/**
 * May the unit take recruits this turn (resolveTurn's reinforcement step)? A land unit must stand
 * on its own nation's land that nobody occupies; a fleet refits from its port. `regions`: the
 * turn's working copy.
 */
export const canReinforce = (state, unit, regions = state.regions) => {
  if (unit.pirate) return false; // a pirate (pirates.js) lurks far from its port
  const here = unit.domain === 'naval' || unit.embarkedOn || !state.world?.tileOwner ? unit.regionId : cityOfTile(state, unitTile(state, unit));
  const city = here != null ? regions[here] : null;
  return !!city && city.owner === unit.ownerId && !city.occupiedBy;
};
