// src/engine/world/market.js
// Uneven carrying capacity, so city sizes follow something like Zipf's law (a few big cities, many
// small ones) instead of all topping out at the same housing (plans/math/world-systems.md).
// Two real-world drivers, both feeding the housing cap (cities.js housingOf), so growth stays
// food-limited and logistic:
//
//   market access   MA_c = sum over cities j within MARKET_REACH_KM of size_j / (1 + (km / MARKET_KM)^2),
//                   (not the city itself: an isolated city gains nothing). Neighbours lift each other. A city in a dense, rich region can
//                   house more people: the gravity kernel tradeValue.js and plague.js already use.
//                   housing + floor(MA / MARKET_PER_HOUSING), at most MARKET_HOUSING_MAX.
//   primate city    a capital houses the court and the trade of its whole nation:
//                   + CAPITAL_HOUSING + floor((cities owned - 1) x CAPITAL_HOUSING_PER_CITY), at most
//                   CAPITAL_HOUSING_MAX.
//
//   central places  Christaller's hierarchy: cities ranked world-wide by market access plus their
//                   own size; rank k gains floor(12 / sqrt(k)) housing and floor(8 / sqrt(k)) food
//                   (the top city +12 and +8, the 4th +6 and +4, the 64th +1 food). Bounded bonuses
//                   spread evenly over a region only lift a whole band, which converges again
//                   (tried: zipf -0.27 at turn 150, flatter than base by 300); a rank hierarchy keeps
//                   a few great cities. Small cities are untouched, never starved.
//   capital grain   a capital is fed by its provinces: floor((cities owned - 1) / 2) food, at most 4.
//
// Neighbours lifting each other and the capital terms are positive feedbacks, bounded by the
// caps and the logistic soft cap. Stored on the city as `marketHousing` and `marketFood`
// (integers, absent when 0), recomputed every turn from start-of-turn sizes.
// Cost: cities x nearby cities through a cube-cell index on the unit sphere (plain arithmetic,
// the same on every device); distances in km, so a denser grid changes nothing.
import { distanceKm, EARTH_RADIUS_KM } from '../../data/geo/geodesic';

export const MARKET_KM = 300;
export const MARKET_REACH_KM = 900;
export const MARKET_PER_HOUSING = 5;
export const MARKET_HOUSING_MAX = 6;
export const CAPITAL_HOUSING = 1;
export const CAPITAL_HOUSING_PER_CITY = 0.5;
export const CAPITAL_HOUSING_MAX = 4;
// A capital is fed by its provinces: + floor((cities owned - 1) x CAPITAL_FOOD_PER_CITY).
export const CAPITAL_FOOD_PER_CITY = 0.5;
export const CAPITAL_FOOD_MAX = 4;
// Central places (Christaller): cities ranked world-wide by market access + CENTRAL_SELF_WEIGHT x
// own size; the city of rank k gets floor(CENTRAL_HOUSING / sqrt(k)) housing and
// floor(CENTRAL_FOOD / sqrt(k)) food. Only the top few dozen gain anything.
export const CENTRAL_SELF_WEIGHT = 2;
export const CENTRAL_HOUSING = 12;
export const CENTRAL_FOOD = 8;

/** The market-access kernel. */
export const marketKernel = (km) => (km > MARKET_REACH_KM ? 0 : 1 / (1 + (km / MARKET_KM) * (km / MARKET_KM)));

/** The housing a city's market access and capital rank add. */
export const marketHousingFor = (access, { isCapital = false, citiesOwned = 1 } = {}) => {
  let h = Math.min(MARKET_HOUSING_MAX, Math.floor(access / MARKET_PER_HOUSING));
  if (isCapital) h += Math.min(CAPITAL_HOUSING_MAX, CAPITAL_HOUSING + Math.floor((Math.max(1, citiesOwned) - 1) * CAPITAL_HOUSING_PER_CITY));
  return h;
};

// Cube cells on the unit sphere at least as wide as the reach's chord (the arc in radians is
// longer than the chord), so every city within reach lies in the 27 cells around a city's own.
const CELL = MARKET_REACH_KM / EARTH_RADIUS_KM;
const cellKey = (v) => `${Math.floor(v[0] / CELL)},${Math.floor(v[1] / CELL)},${Math.floor(v[2] / CELL)}`;

/** The food a capital's provinces send it. */
export const capitalFoodFor = ({ isCapital = false, citiesOwned = 1 } = {}) => (isCapital ? Math.min(CAPITAL_FOOD_MAX, Math.floor((Math.max(1, citiesOwned) - 1) * CAPITAL_FOOD_PER_CITY)) : 0);

/** The central-place bonus of the city ranked `rank` (1 = the world's biggest market): { housing, food }. */
export const centralPlaceBonus = (rank) => {
  const r = Math.sqrt(Math.max(1, rank));
  return { housing: Math.floor(CENTRAL_HOUSING / r), food: Math.floor(CENTRAL_FOOD / r) };
};

/**
 * Market access for every settled city in `cities` (id -> city record). Returns Map id -> access.
 */
export const marketAccess = (cities, tiles) => {
  const list = Object.keys(cities).sort().map((id) => cities[id]).filter((c) => c && c.owner && !c.outpost && c.tile != null);
  const cells = new Map();
  list.forEach((c) => { const k = cellKey(tiles.centres[c.tile]); (cells.get(k) || cells.set(k, []).get(k)).push(c); });
  const out = new Map();
  list.forEach((c) => {
    const v = tiles.centres[c.tile];
    const cx = Math.floor(v[0] / CELL); const cy = Math.floor(v[1] / CELL); const cz = Math.floor(v[2] / CELL);
    let access = 0; // neighbours only: an isolated city gains nothing
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const bucket = cells.get(`${cx + dx},${cy + dy},${cz + dz}`);
      if (!bucket) continue;
      for (const d of bucket) {
        if (d === c) continue;
        const w = marketKernel(distanceKm(v, tiles.centres[d.tile]));
        if (w > 0) access += (d.size || 1) * w;
      }
    }
    out.set(c.id, access);
  });
  return out;
};

/**
 * The market-housing step on a working `cities` map (mutated: only changed records are replaced).
 * Returns the number of cities changed.
 */
export const applyMarketHousing = (cities, tiles) => {
  const access = marketAccess(cities, tiles);
  const owned = new Map();
  access.forEach((_, id) => { const o = cities[id].owner; owned.set(o, (owned.get(o) || 0) + 1); });
  // Central-place ranks: market access plus the city's own weight, ties by id.
  const key = (id) => access.get(id) + CENTRAL_SELF_WEIGHT * (cities[id].size || 1);
  const rankOf = new Map();
  [...access.keys()].sort((a, b) => key(b) - key(a) || (a < b ? -1 : 1)).forEach((id, i) => rankOf.set(id, i + 1));
  let changed = 0;
  Object.keys(cities).forEach((id) => {
    const c = cities[id];
    let h = 0; let f = 0;
    if (access.has(id)) {
      const rank = { isCapital: !!c.isCapital, citiesOwned: owned.get(c.owner) || 1 };
      const central = centralPlaceBonus(rankOf.get(id));
      h = marketHousingFor(access.get(id), rank) + central.housing;
      f = capitalFoodFor(rank) + central.food;
    }
    if ((c.marketHousing || 0) === h && (c.marketFood || 0) === f) return;
    cities[id] = { ...c, marketHousing: h || undefined, marketFood: f || undefined };
    changed += 1;
  });
  return changed;
};
