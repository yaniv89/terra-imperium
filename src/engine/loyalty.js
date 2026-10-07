// src/engine/loyalty.js
// Loyalty and culture per city (plans/civ-map-rework.md, C5; workstream 8). Every city carries a
// culture share per nation (`culture: { fr: 0.8, de: 0.2 }`) and a `loyalty` 0..100.
//   Pressure   each turn the cities within PRESSURE_RINGS tiles press their nation's culture on
//              it, weighted by size over distance squared (size / (1 + rings)^2); the city's own people
//              press their own culture (its shares) at SELF_WEIGHT of their size, so a lone
//              conquest never converts itself but a big neighbour can turn a small city. The
//              shares drift CULTURE_DRIFT of the way to the pressure shares each turn.
//   Target     50 + LOYALTY_LEAD_SCALE x (the owner's share - the biggest other share): an even
//              split holds at 50, a lead of a quarter of the people gives 75, a rival culture a
//              quarter ahead gives 25; under LOYALTY_SHARE_FLOOR of the owner's people the city
//              is never loyal at all (in a dense region the pressure field splits among four or
//              five neighbours, so an absolute share could never hold a small city even when
//              its owner pressed it most),
//              + LOYALTY_GARRISON_PER_UNIT per own land unit on the
//              centre (up to LOYALTY_GARRISON_CAP), + the amenities balance (capped either way),
//              - LOYALTY_CONQUERED while the conquest is younger than CONQUERED_TURNS,
//              - LOYALTY_CAPITAL_LOST while the owner's capital is in enemy hands,
//              + the governor's term (governors.js: +2 + skill governed, -5 in an ungoverned group),
//              + the city's own national wonder (greatProjects.js cityEffects 'local.loyalty':
//              Solomon's Temple).
//   Movement   loyalty moves LOYALTY_STEP a turn toward the target.
//   Flip       at 0 a city that is not a capital flips to the nation with the most pressure among
//              those whose land borders it, else becomes a FREE CITY (owner null, `freeCity`): it
//              keeps its record and its people, can be settled peacefully (SETTLE_COLONIZE) or
//              retaken, and after FREE_CITY_JOIN_TURNS joins the bordering nation that presses
//              it most. A flip relocates the loser's capital if needed (conquest.js). The people who
//              chose the new owner take FLIP_CULTURE_SHIFT of the shares, and the city cannot flip
//              again for FLIP_COOLDOWN_TURNS: no ping-pong between neighbours.
// Control stays the siege and battle ground (siege.js); loyalty is how integrated a city is.
// Ripples: conquest at distance costs garrisons (anti-snowball), culture feeds the "my people"
// opinion reason (opinion.js), free cities are land to settle. Pure of randomness.
import { getTiles, onWorldChange } from '../data/geo/tiles';
import { ringsApart, ringsForKm, kmPerRing } from '../data/geo/gridScale';
import { buildRadiusIndex } from './world/registry';
import { settlesThisTurn } from './world/lod';
import { amenitiesOf } from './world/cities';
import { transferRegion } from './regionTransfer';
import { relocateLostCapital } from './conquest';
import { unitTile } from './armies';
import { isSettler } from './settlers';
import { landUnitsByTile } from './sieges';
import { governorEffects } from './governors';
import { lawRulesOf } from './lawRules';
import { cityWonderTotal } from '../data/greatProjects';
import { isIndependentNation } from '../data/independents';
import { breakAwayAsIndependent } from './independents';

// Culture reaches PRESSURE_KM (13 rings at frequency 75) and falls off by the ring distance on
// the loaded grid (gridScale.js): one ring is the measured neighbour spacing, not a fixed km.
export const PRESSURE_KM = 1330;
export const PRESSURE_RINGS = ringsForKm(PRESSURE_KM);
export const CULTURE_DRIFT = 0.05;
export const CULTURE_PERIOD = 3;        // a city's shares drift every third turn (by CULTURE_PERIOD x CULTURE_DRIFT)
export const SELF_WEIGHT = 0.6;
export const LOYALTY_SHARE_FLOOR = 0.25;
export const LOYALTY_LEAD_SCALE = 100;
export const LOYALTY_NEUTRAL = 50;      // the people term of a city whose culture is nobody's lead; Tolerance never goes below it
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
export const FLIP_COOLDOWN_TURNS = 30;
export const FOUNDING_GRACE_TURNS = 30;  // a newly founded city's settlers hold it whatever the pressure   // a city that just changed hands by loyalty settles before it can flip again
export const FLIP_CULTURE_SHIFT = 0.6;   // the share the people who chose the new owner take at a flip

export const loyaltyOf = (city) => (city.loyalty == null ? 100 : city.loyalty);
export const cultureOf = (city) => city.culture || { [city.founderId || city.owner]: 1 };

// The pressure every nation puts on `city`: { nationId: weight }.
// The cities within PRESSURE_RINGS of each city, by tile, with the weight of their pressure
// (1 / (1 + rings)^2). Kept across turns and updated for the cities founded or lost since the
// last call (cities never move, and the relation is symmetric), so a turn costs the new cities
// only instead of a radius search per city.
const neighbourLists = new Map(); // tile -> [{ tile, weight }]
let knownTiles = new Set();
onWorldChange(() => { neighbourLists.clear(); knownTiles = new Set(); });
const pressureNeighbours = (tiles, cities, index) => {
  const current = new Set(cities.map((c) => c.tile));
  const added = cities.filter((c) => !knownTiles.has(c.tile));
  const removed = [...knownTiles].filter((t) => !current.has(t));
  removed.forEach((t) => {
    (neighbourLists.get(t) || []).forEach(({ tile }) => { const l = neighbourLists.get(tile); if (l) neighbourLists.set(tile, l.filter((x) => x.tile !== t)); });
    neighbourLists.delete(t);
  });
  added.forEach((city) => {
    const list = [];
    index.near(tiles.centres[city.tile], PRESSURE_RINGS * kmPerRing(tiles) + 1).forEach((i) => {
      const other = cities[i];
      if (other.tile === city.tile) return;
      const rings = ringsApart(city.tile, other.tile, tiles);
      if (rings > PRESSURE_RINGS) return;
      const weight = 1 / ((1 + rings) * (1 + rings));
      list.push({ tile: other.tile, weight });
      if (!current.has(other.tile)) return;
      const theirs = neighbourLists.get(other.tile);
      if (theirs && !theirs.some((x) => x.tile === city.tile)) theirs.push({ tile: city.tile, weight });
    });
    neighbourLists.set(city.tile, list);
  });
  knownTiles = current;
  return neighbourLists;
};

const cityByTileCache = new WeakMap(); // cities array -> Map tile -> city
const cityByTile = (cities) => { let m = cityByTileCache.get(cities); if (!m) { m = new Map(cities.map((c) => [c.tile, c])); cityByTileCache.set(cities, m); } return m; };

const pressureOn = (tiles, cities, index, city, neighbours = null) => {
  const out = {};
  const own = cultureOf(city);
  Object.entries(own).forEach(([id, share]) => { out[id] = (out[id] || 0) + Math.max(1, city.size || 1) * SELF_WEIGHT * share; });
  const list = (neighbours || pressureNeighbours(tiles, cities, index)).get(city.tile) || [];
  const byTile = cityByTile(cities);
  list.forEach(({ tile, weight }) => {
    const other = byTile.get(tile);
    if (!other || !other.owner) return;
    out[other.owner] = (out[other.owner] || 0) + Math.max(1, other.size || 1) * weight;
  });
  return out;
};

const drift = (culture, pressure, rate = CULTURE_DRIFT) => {
  const total = Object.values(pressure).reduce((s, v) => s + v, 0);
  if (!total) return culture;
  const next = {};
  const ids = new Set([...Object.keys(culture), ...Object.keys(pressure)]);
  ids.forEach((id) => { const v = (culture[id] || 0) + rate * ((pressure[id] || 0) / total - (culture[id] || 0)); if (v >= 0.0005) next[id] = Math.round(v * 10000) / 10000; });
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
export const loyaltyTarget = (state, city, units = state.units, nations = state.nations, byTile = null, cache = null) => {
  const culture = cultureOf(city);
  const share = city.owner ? (culture[city.owner] || 0) : 0;
  const onCentre = byTile ? (byTile.get(city.tile) || []).filter((u) => u.ownerId === city.owner) : Object.values(units).filter((u) => u.ownerId === city.owner && u.domain === 'land' && !u.embarkedOn && !isSettler(u) && u.strength > 0 && unitTile(state, u) === city.tile);
  const garrison = Math.min(LOYALTY_GARRISON_CAP, LOYALTY_GARRISON_PER_UNIT * onCentre.length);
  const amenities = Math.max(-LOYALTY_AMENITY_CAP, Math.min(LOYALTY_AMENITY_CAP, amenitiesOf(city).net));
  const turn = state.turnNumber || 1;
  const conquered = city.conquest && turn - (city.conquest.turn || 0) < CONQUERED_TURNS ? LOYALTY_CONQUERED : 0;
  const owner = nations[city.owner];
  const capitalLost = owner && owner.capitalRegionId && state.regions[owner.capitalRegionId] && state.regions[owner.capitalRegionId].owner !== city.owner ? LOYALTY_CAPITAL_LOST : 0;
  const maxOther = Object.entries(culture).reduce((m, [id, v]) => (id !== city.owner && v > m ? v : m), 0);
  const rules = cache ? (cache.rules.get(city.owner) || cache.rules.set(city.owner, lawRulesOf(owner)).get(city.owner)) : lawRulesOf(owner); // laws and reforms (lawRules.js): Tolerance, Codified Law, Martial Law...
  const rawShare = share < LOYALTY_SHARE_FLOOR ? 0 : Math.max(0, Math.min(100, 50 + LOYALTY_LEAD_SCALE * (share - maxOther)));
  const fromShare = rules.tolerance ? Math.max(LOYALTY_NEUTRAL, rawShare) : rawShare;
  const governor = city.owner ? governorEffects(cache ? cache.view : nations === state.nations ? state : { ...state, nations }, city.owner, city.id, turn).loyalty : 0;
  const law = rules.loyaltyBonus || 0;
  const wonder = city.owner ? cityWonderTotal(state.greatProjects, city.id, 'local.loyalty') : 0;
  const total = Math.max(0, Math.min(100, Math.round(fromShare + garrison + amenities + conquered + capitalLost + governor + law + wonder)));
  return { total, share, maxOther, fromShare: Math.round(fromShare), garrison, amenities, conquered, capitalLost, governor, law, wonder };
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
// `periodOf(nationId)` (optional, world/lod.js): a far nation at peace has its cities' loyalty
// settled every `period` turns, moving `period` steps at once; culture keeps its own schedule.
export const applyLoyalty = (state, regions, units, nations, turn, periodOf = null) => {
  const tiles = getTiles();
  const cities = Object.values(regions).filter((c) => c.tile != null);
  const index = buildRadiusIndex(cities.map((c) => tiles.centres[c.tile]));
  const neighbours = pressureNeighbours(tiles, cities, index); // once a turn: the lists are kept across turns
  const view = { ...state, regions, units, nations, turnNumber: turn };
  const byTile = landUnitsByTile(view, units);
  const cache = { rules: new Map(), view }; // one law-rules sum per nation and one state view for the whole pass
  const flips = []; const logs = [];
  cities.forEach((city) => {
    // Pressure is costly over hundreds of cities: each city's shares drift every CULTURE_PERIOD
    // turns by the whole period's drift (the turn count staggers the cities).
    const drifts = city.owner === null || (turn + city.tile) % CULTURE_PERIOD === 0;
    const pressure = drifts ? pressureOn(tiles, cities, index, city, neighbours) : null;
    if (city.owner === null) {
      // A free city joins the bordering nation that presses it most, after a while.
      const since = city.freeCity?.since ?? turn;
      if (turn - since < FREE_CITY_JOIN_TURNS) return;
      const near = bordering(view, tiles, city);
      const best = [...near].filter((id) => nations[id] && !nations[id].isEliminated && !isIndependentNation(nations[id])).sort((a, b) => (pressure[b] || 0) - (pressure[a] || 0) || (a < b ? -1 : 1))[0];
      if (best) flips.push({ cityId: city.id, from: null, to: best });
      return;
    }
    const period = periodOf ? periodOf(city.owner) : 1;
    const settles = settlesThisTurn(city.owner, period, turn);
    if (!settles && !pressure) return; // a far city between settlements: nothing moves this turn
    const culture = pressure ? drift(cultureOf(city), pressure, CULTURE_DRIFT * CULTURE_PERIOD) : cultureOf(city);
    if (!settles) { regions[city.id] = { ...city, culture }; return; }
    const target = loyaltyTarget(view, { ...city, culture }, units, nations, byTile, cache).total;
    const current = loyaltyOf(city);
    const step = LOYALTY_STEP * period;
    const loyalty = current < target ? Math.min(target, current + step) : Math.max(target, current - step);
    if (culture !== city.culture || loyalty !== city.loyalty) regions[city.id] = { ...city, culture, loyalty };
    const settling = (city.lastFlipTurn != null && turn - city.lastFlipTurn < FLIP_COOLDOWN_TURNS) || (city.founded > 1 && turn - city.founded < FOUNDING_GRACE_TURNS);
    if (loyalty <= 0 && !settling && nations[city.owner]?.capitalRegionId !== city.id) { // a nation's current capital never flips (a stale isCapital flag on a taken city does not count)
      const near = bordering(view, tiles, city);
      const press = pressure || pressureOn(tiles, cities, index, city, neighbours);
      const best = [...near].filter((id) => nations[id] && !nations[id].isEliminated && !isIndependentNation(nations[id])).sort((a, b) => (press[b] || 0) - (press[a] || 0) || (a < b ? -1 : 1))[0];
      flips.push({ cityId: city.id, from: city.owner, to: best || null });
    } else if (loyalty <= 25 && current > 25) logs.push({ nationId: city.owner, message: `${city.name} is losing its loyalty (${loyalty}): garrison it or raise its amenities.` });
  });
  flips.forEach((f) => {
    const city = regions[f.cityId];
    const shifted = (() => { const c = cultureOf(city); const rest = 1 - FLIP_CULTURE_SHIFT; const out = {}; Object.entries(c).forEach(([id, v]) => { out[id] = Math.round(v * rest * 10000) / 10000; }); if (f.to) out[f.to] = Math.round(((out[f.to] || 0) + FLIP_CULTURE_SHIFT) * 10000) / 10000; return out; })();
    if (f.to) {
      const { region, revivedNation } = transferRegion(city, f.to, nations, { loyalty: LOYALTY_ON_FLIP, control: 100, unrest: 0, freeCity: undefined, siege: null, culture: shifted, lastFlipTurn: turn });
      regions[f.cityId] = region;
      if (revivedNation) nations[f.to] = revivedNation;
      logs.push({ nationId: f.from, message: `${city.name} has gone over to ${nations[f.to]?.name || f.to}: its people no longer feel yours.` }, { nationId: f.to, message: `${city.name} joins you: its people chose your rule.` });
    } else if (breakAwayAsIndependent(state, nations, regions, f.cityId, turn)) {
      // A world with independents: the city stands as a new independent (independents 14.4).
      const id = `free_${f.cityId}`;
      regions[f.cityId] = { ...city, owner: id, occupiedBy: undefined, conquest: undefined, siege: null, control: 100, unrest: 0, loyalty: LOYALTY_ON_FLIP, culture: city.culture, freeCity: undefined, lastFlipTurn: turn };
      nations[id] = { ...nations[id], capitalRegionId: f.cityId };
      logs.push({ nationId: f.from, message: `${city.name} has thrown off your rule and stands as ${nations[id].name}, an independent city.` });
    } else {
      regions[f.cityId] = { ...city, owner: null, occupiedBy: undefined, conquest: undefined, siege: null, control: 0, loyalty: LOYALTY_ON_FLIP, freeCity: { since: turn, formerOwner: f.from }, lastFlipTurn: turn };
      logs.push({ nationId: f.from, message: `${city.name} has thrown off your rule and stands as a free city.` });
    }
    if (f.from) {
      const moved = relocateLostCapital(nations, regions, f.from);
      if (moved !== nations) Object.assign(nations, moved);
    }
  });
  return { flips, logs };
};
