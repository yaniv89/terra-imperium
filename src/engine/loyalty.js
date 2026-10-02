// src/engine/loyalty.js
// Loyalty and culture per city (plans/civ-map-rework.md, C5; workstream 8). Every city carries a
// culture share per nation (`culture: { fr: 0.8, de: 0.2 }`) and a `loyalty` 0..100.
//   Pressure   each turn the cities within PRESSURE_RINGS tiles press their nation's culture on
//              it, weighted by size over distance squared (size / (1 + rings)^2); the city's own people
//              press their own culture (its shares) at SELF_WEIGHT of their size, so a lone
//              conquest never converts itself but a big neighbour can turn a small city. The
//              shares drift CULTURE_DRIFT of the way to the pressure shares each turn.
//   Target     100 x how far the owner's share stands above LOYALTY_SHARE_FLOOR (a city needs
//              more than half its people of its owner's culture to be loyal at all),
//              + LOYALTY_GARRISON_PER_UNIT per own land unit on the
//              centre (up to LOYALTY_GARRISON_CAP), + the amenities balance (capped either way),
//              - LOYALTY_CONQUERED while the conquest is younger than CONQUERED_TURNS,
//              - LOYALTY_CAPITAL_LOST while the owner's capital is in enemy hands.
//   Movement   loyalty moves LOYALTY_STEP a turn toward the target.
//   Flip       at 0 a city that is not a capital flips to the nation with the most pressure among
//              those whose land borders it, else becomes a FREE CITY (owner null, `freeCity`): it
//              keeps its record and its people, can be settled peacefully (SETTLE_COLONIZE) or
//              retaken, and after FREE_CITY_JOIN_TURNS joins the bordering nation that presses
//              it most. A flip relocates the loser's capital if needed (conquest.js).
// Control stays the siege and battle ground (siege.js); loyalty is how integrated a city is.
// Ripples: conquest at distance costs garrisons (anti-snowball), culture feeds the "my people"
// opinion reason (opinion.js), free cities are land to settle. Pure of randomness.
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { buildRadiusIndex } from './world/registry';
import { amenitiesOf } from './world/cities';
import { transferRegion } from './regionTransfer';
import { relocateLostCapital } from './conquest';
import { unitTile } from './armies';
import { isSettler } from './settlers';

export const PRESSURE_RINGS = 9;
export const KM_PER_RING = 147;
export const CULTURE_DRIFT = 0.05;
export const SELF_WEIGHT = 0.25;
export const LOYALTY_SHARE_FLOOR = 0.5;
export const LOYALTY_STEP = 5;
export const LOYALTY_GARRISON_PER_UNIT = 10;
export const LOYALTY_GARRISON_CAP = 30;
export const LOYALTY_AMENITY_CAP = 10;
export const LOYALTY_CONQUERED = -20;
export const CONQUERED_TURNS = 20;
export const LOYALTY_CAPITAL_LOST = -20;
export const LOYALTY_ON_CONQUEST = 50;
export const LOYALTY_ON_FLIP = 50;
export const FREE_CITY_JOIN_TURNS = 10;

export const loyaltyOf = (city) => (city.loyalty == null ? 100 : city.loyalty);
export const cultureOf = (city) => city.culture || { [city.founderId || city.owner]: 1 };

// The pressure every nation puts on `city`: { nationId: weight }.
const pressureOn = (tiles, cities, index, city) => {
  const { lat, lon } = tiles.latLonOf(city.tile);
  const out = {};
  index.within(lat, lon, PRESSURE_RINGS * KM_PER_RING + 60).forEach((i) => {
    const other = cities[i];
    if (!other.owner) return;
    if (other.id === city.id) {
      const own = cultureOf(city);
      Object.entries(own).forEach(([id, share]) => { out[id] = (out[id] || 0) + Math.max(1, city.size || 1) * SELF_WEIGHT * share; });
      return;
    }
    const rings = distanceKm(tiles.centres[city.tile], tiles.centres[other.tile]) / KM_PER_RING;
    if (rings > PRESSURE_RINGS) return;
    out[other.owner] = (out[other.owner] || 0) + Math.max(1, other.size || 1) / ((1 + rings) * (1 + rings));
  });
  return out;
};

const drift = (culture, pressure) => {
  const total = Object.values(pressure).reduce((s, v) => s + v, 0);
  if (!total) return culture;
  const next = {};
  const ids = new Set([...Object.keys(culture), ...Object.keys(pressure)]);
  ids.forEach((id) => { const v = (culture[id] || 0) + CULTURE_DRIFT * ((pressure[id] || 0) / total - (culture[id] || 0)); if (v >= 0.0005) next[id] = Math.round(v * 10000) / 10000; });
  const sum = Object.values(next).reduce((s, v) => s + v, 0) || 1;
  Object.keys(next).forEach((id) => { next[id] = Math.round((next[id] / sum) * 10000) / 10000; });
  return next;
};

/** The culture pressure on one city today: { nationId: weight } (for the card and tests). */
export const pressureOf = (state, city) => {
  const tiles = getTiles();
  const cities = Object.values(state.regions || {}).filter((c) => c.tile != null);
  return pressureOn(tiles, cities, buildRadiusIndex(cities.map((c) => tiles.centres[c.tile])), city);
};

/** The loyalty target of a city today, with its parts. */
export const loyaltyTarget = (state, city, units = state.units, nations = state.nations) => {
  const culture = cultureOf(city);
  const share = city.owner ? (culture[city.owner] || 0) : 0;
  const garrison = Math.min(LOYALTY_GARRISON_CAP, LOYALTY_GARRISON_PER_UNIT * Object.values(units).filter((u) => u.ownerId === city.owner && u.domain === 'land' && !u.embarkedOn && !isSettler(u) && u.strength > 0 && unitTile(state, u) === city.tile).length);
  const amenities = Math.max(-LOYALTY_AMENITY_CAP, Math.min(LOYALTY_AMENITY_CAP, amenitiesOf(city).net));
  const turn = state.turnNumber || 1;
  const conquered = city.conquest && turn - (city.conquest.turn || 0) < CONQUERED_TURNS ? LOYALTY_CONQUERED : 0;
  const owner = nations[city.owner];
  const capitalLost = owner && owner.capitalRegionId && state.regions[owner.capitalRegionId] && state.regions[owner.capitalRegionId].owner !== city.owner ? LOYALTY_CAPITAL_LOST : 0;
  const fromShare = 100 * Math.max(0, share - LOYALTY_SHARE_FLOOR) / (1 - LOYALTY_SHARE_FLOOR);
  const total = Math.max(0, Math.min(100, Math.round(fromShare + garrison + amenities + conquered + capitalLost)));
  return { total, share, garrison, amenities, conquered, capitalLost };
};

// Nations whose land touches this city's tiles.
const bordering = (state, tiles, city) => {
  const tileOwner = state.world?.tileOwner || {};
  const out = new Set();
  (city.tiles || [city.tile]).forEach((t) => tiles.neighbors[t].forEach((n) => { const c = tileOwner[n]; const o = c != null ? state.regions[c]?.owner : null; if (o && o !== city.owner) out.add(o); }));
  return out;
};

/**
 * The loyalty phase of a turn on the turn's working `regions` and `nations` (mutated in place).
 * Returns { flips: [{ cityId, from, to }], logs: [{ nationId, message }] }.
 */
export const applyLoyalty = (state, regions, units, nations, turn) => {
  const tiles = getTiles();
  const cities = Object.values(regions).filter((c) => c.tile != null);
  const index = buildRadiusIndex(cities.map((c) => tiles.centres[c.tile]));
  const view = { ...state, regions, units, nations, turnNumber: turn };
  const flips = []; const logs = [];
  cities.forEach((city) => {
    const pressure = pressureOn(tiles, cities, index, city);
    if (city.owner === null) {
      // A free city joins the bordering nation that presses it most, after a while.
      const since = city.freeCity?.since ?? turn;
      if (turn - since < FREE_CITY_JOIN_TURNS) return;
      const near = bordering(view, tiles, city);
      const best = [...near].filter((id) => nations[id] && !nations[id].isEliminated).sort((a, b) => (pressure[b] || 0) - (pressure[a] || 0) || (a < b ? -1 : 1))[0];
      if (best) flips.push({ cityId: city.id, from: null, to: best });
      return;
    }
    const culture = drift(cultureOf(city), pressure);
    const target = loyaltyTarget(view, { ...city, culture }, units, nations).total;
    const current = loyaltyOf(city);
    const loyalty = current < target ? Math.min(target, current + LOYALTY_STEP) : Math.max(target, current - LOYALTY_STEP);
    regions[city.id] = { ...city, culture, loyalty };
    if (loyalty <= 0 && nations[city.owner]?.capitalRegionId !== city.id) { // a nation's current capital never flips (a stale isCapital flag on a taken city does not count)
      const near = bordering(view, tiles, city);
      const best = [...near].filter((id) => nations[id] && !nations[id].isEliminated).sort((a, b) => (pressure[b] || 0) - (pressure[a] || 0) || (a < b ? -1 : 1))[0];
      flips.push({ cityId: city.id, from: city.owner, to: best || null });
    } else if (loyalty <= 25 && current > 25) logs.push({ nationId: city.owner, message: `${city.name} is losing its loyalty (${loyalty}): garrison it or raise its amenities.` });
  });
  flips.forEach((f) => {
    const city = regions[f.cityId];
    if (f.to) {
      const { region, revivedNation } = transferRegion(city, f.to, nations, { loyalty: LOYALTY_ON_FLIP, control: 100, unrest: 0, freeCity: undefined, siege: null });
      regions[f.cityId] = region;
      if (revivedNation) nations[f.to] = revivedNation;
      logs.push({ nationId: f.from, message: `${city.name} has gone over to ${nations[f.to]?.name || f.to}: its people no longer feel yours.` }, { nationId: f.to, message: `${city.name} joins you: its people chose your rule.` });
    } else {
      regions[f.cityId] = { ...city, owner: null, occupiedBy: undefined, conquest: undefined, siege: null, control: 0, loyalty: LOYALTY_ON_FLIP, freeCity: { since: turn, formerOwner: f.from } };
      logs.push({ nationId: f.from, message: `${city.name} has thrown off your rule and stands as a free city.` });
    }
    if (f.from) {
      const moved = relocateLostCapital(nations, regions, f.from);
      if (moved !== nations) Object.assign(nations, moved);
    }
  });
  return { flips, logs };
};
