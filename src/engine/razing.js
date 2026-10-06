// src/engine/razing.js
// Razing a captured city (plans/independent-cities.md 5 and decision 3; plans/MASTER-PLAN.md 6.5:
// "razing after capture: one size a turn on the map", phase W3).
//
// The model in plain words:
// - Who may raze: the owner of a city it took by force (`city.conquest`, from anyone: an
//   independent or a major), of any size, unless it is the owner's capital, its last city, or a
//   city holding a wonder (state.greatProjects). The order is `city.razing = { by, startedTurn }`.
// - The fire: every turn the city loses RAZE_SIZE_PER_TURN size (its people with it); a city of size
//   1 is gone the next turn, so a size-2 village burns in 2 turns and a size-9 city in 9. While it
//   burns it yields nothing (cities.js processCity) and its queue stands still.
// - Retaken: anyone who takes the burning city (its old owner, a neighbour) puts the fire out: the
//   order belongs to `by`, so a city whose owner is no longer `by` stops burning.
// - Gone: the city record is deleted, its tiles (and their improvements) are freed, claims and war
//   goals naming it are dropped, units based there move to their nation's capital (or are gone with
//   it when the nation has nowhere else).
// - The memory: the independents of its people's kin (the same art theme as its founder's people)
//   hold GRUDGE_RAZE_KIN against the razer; majors of that kin take the "razed our kin" opinion
//   reason (-40, fading a point a turn: `nation.razedBy[razer] = turn`, opinion.js).
// - The AI razes a captured independent's city only when it is small (RAZE_AI_MAX_SIZE) and crowds one
//   of its own cities (within RAZE_AI_CROWD_KM): a worthless prize that only costs a garrison.
// Pure: every function returns new maps (resolveTurn passes its working copies to burnCities, which
// writes into them).
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { PEOPLES } from '../data/peoples';
import { LogTypes } from '../data/types';
import { isIndependentNation, RAZE_SIZE_PER_TURN, GRUDGE_RAZE_KIN, RAZE_AI_MAX_SIZE, RAZE_AI_CROWD_KM } from '../data/independents';
import { getCapital } from '../data/regions';
import { addGrudge, kinOf } from './grudges';
import { ringsAround, sizeToPeople } from './world/cities';

const themeOfPeople = (id) => (id ? PEOPLES[id]?.theme || null : null);
/** The kin theme of a city: its founder's people (a people id or a nation with a `people`). */
const cityTheme = (state, city) => themeOfPeople(state.nations?.[city.founderId]?.people || city.founderId);

/** May `nationId` raze `cityId` now? { ok } or { ok: false, reason } (a sentence for the player). */
export const canRaze = (state, nationId, cityId) => {
  const city = state.regions?.[cityId];
  if (!city || city.owner !== nationId) return { ok: false, reason: 'Not your city.' };
  if (city.razing) return { ok: false, reason: 'It is already burning.' };
  if (city.outpost) return { ok: false, reason: 'An outpost cannot be razed.' };
  if (!city.conquest) return { ok: false, reason: 'Only a city taken by force can be razed.' };
  if (getCapital(state, nationId) === cityId || state.nations?.[nationId]?.capitalRegionId === cityId) return { ok: false, reason: 'Your capital cannot be razed.' };
  if (!Object.values(state.regions).some((c) => c.owner === nationId && c.id !== cityId && !c.razing)) return { ok: false, reason: 'It is your last city.' };
  if (Object.values(state.greatProjects || {}).some((p) => p?.regionId === cityId)) return { ok: false, reason: 'A wonder stands in it.' };
  return { ok: true };
};

/**
 * Starts razing `cityId` by `nationId` (checked with canRaze). Returns { regions, nations, logs }
 * (new maps) or null when not allowed. The kin remember at once.
 */
export const startRazing = (state, nationId, cityId) => {
  if (!canRaze(state, nationId, cityId).ok) return null;
  const city = state.regions[cityId];
  const turn = state.turnNumber || 0;
  const regions = { ...state.regions, [cityId]: { ...city, razing: { by: nationId, startedTurn: turn } } };
  let nations = state.nations;
  const theme = cityTheme(state, city);
  if (theme) {
    Object.keys(nations).sort().forEach((id) => {
      const n = nations[id];
      if (id === nationId || n.isEliminated) return;
      if (isIndependentNation(n)) { if (kinOf(n) === theme) nations = addGrudge(nations, id, nationId, GRUDGE_RAZE_KIN, { id: 'razedKin', turn }); return; }
      if (themeOfPeople(n.people) === theme) nations = { ...nations, [id]: { ...n, razedBy: { ...(n.razedBy || {}), [nationId]: turn } } };
    });
  }
  const who = state.nations[nationId]?.name || nationId;
  return { regions, nations, logs: [{ year: state.year, type: LogTypes.COMBAT, message: `${who} put${nationId === state.playerNationId ? '' : 's'} ${city.name} to the torch: it burns one size a turn (${city.size} turn${city.size === 1 ? '' : 's'}).`, nationId }] };
};

/** Stops the fire (the razer changed its mind). Returns new regions or null. */
export const stopRazing = (state, nationId, cityId) => {
  const city = state.regions?.[cityId];
  if (!city?.razing || city.razing.by !== nationId) return null;
  const rest = { ...city }; delete rest.razing;
  return { ...state.regions, [cityId]: rest };
};

/**
 * Deletes city `cityId` from the turn's working maps (mutated): the city, its tiles and their
 * state, claims and war goals naming it, its units moved to their nation's capital (or deleted).
 * `world` is { tileOwner, tileState } (new objects are written into `world`).
 */
export const removeCity = (cityId, { regions, nations, units, world, wars }) => {
  const city = regions[cityId];
  if (!city) return;
  const owned = city.tiles || [city.tile];
  const tileOwner = { ...(world.tileOwner || {}) };
  const tileState = { ...(world.tileState || {}) };
  owned.forEach((t) => { if (tileOwner[t] === cityId) delete tileOwner[t]; delete tileState[t]; });
  world.tileOwner = tileOwner; world.tileState = tileState;
  delete regions[cityId];
  Object.keys(nations).forEach((id) => {
    const n = nations[id];
    let next = n;
    if ((n.claims || []).includes(cityId)) next = { ...next, claims: n.claims.filter((c) => c !== cityId) };
    if (n.governors?.[cityId]) { const g = { ...n.governors }; delete g[cityId]; next = { ...next, governors: g }; }
    if (next !== n) nations[id] = next;
  });
  if (wars) wars.forEach((w, i) => { if (w.goal?.regionId === cityId) wars[i] = { ...w, goal: null }; });
  Object.keys(units).forEach((id) => {
    const u = units[id];
    if (u.regionId !== cityId && u.homeRegionId !== cityId) return;
    const capital = nations[u.ownerId]?.capitalRegionId;
    const home = capital && capital !== cityId && regions[capital]?.owner === u.ownerId ? capital : Object.keys(regions).sort().find((r) => regions[r].owner === u.ownerId);
    if (!home) { delete units[id]; return; }
    units[id] = { ...u, regionId: u.regionId === cityId ? home : u.regionId, homeRegionId: u.homeRegionId === cityId ? home : u.homeRegionId, ...(u.regionId === cityId ? { tile: regions[home].tile, route: null } : {}) };
  });
};

/**
 * One turn of fire on the turn's working maps (mutated): every burning city shrinks, the retaken
 * ones stop, the ashes are removed. Returns { razed: [names], stopped, logs }.
 */
export const burnCities = ({ regions, nations, units, world, wars, playerNationId, year }) => {
  const logs = []; const razed = []; let stopped = 0;
  Object.keys(regions).sort().forEach((id) => {
    const city = regions[id];
    if (!city?.razing) return;
    if (city.owner !== city.razing.by) {
      const rest = { ...city }; delete rest.razing;
      regions[id] = rest; stopped += 1;
      if (city.owner === playerNationId || city.razing.by === playerNationId) logs.push({ year, type: LogTypes.COMBAT, message: `The fire in ${city.name} is put out: it was retaken.` });
      return;
    }
    if ((city.size || 1) <= 1) {
      removeCity(id, { regions, nations, units, world, wars });
      razed.push(city.name);
      if (city.owner === playerNationId) logs.push({ year, type: LogTypes.COMBAT, message: `${city.name} is razed: nothing is left but its fields.` });
      return;
    }
    const size = Math.max(1, city.size - RAZE_SIZE_PER_TURN);
    regions[id] = { ...city, size, currentPopulation: Math.min(city.currentPopulation ?? sizeToPeople(size), sizeToPeople(size)) };
  });
  return { razed, stopped, logs };
};

/** Should AI `nationId` raze the city it just took from an independent? (small and crowding its own) */
export const aiWantsRaze = (state, nationId, cityId) => {
  const city = state.regions?.[cityId];
  if (!city || city.owner !== nationId || !city.conquest || (city.size || 1) > RAZE_AI_MAX_SIZE) return false;
  if (!isIndependentNation(state.nations?.[city.conquest.from])) return false;
  if (!canRaze(state, nationId, cityId).ok) return false;
  const tileOwner = state.world?.tileOwner || {};
  const near = ringsAround(getTiles(), city.tile, ringsForKm(RAZE_AI_CROWD_KM));
  for (const t of near.keys()) {
    if (t === city.tile) continue;
    const other = state.regions[tileOwner[t]];
    if (other && other.id !== cityId && other.owner === nationId && other.tile === t && !other.outpost) return true;
  }
  return false;
};
