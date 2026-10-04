// src/engine/population.js
// One population model (plans/math-ideas.md 1.1 and 1.3). A city's people are its SIZE: the
// city model (src/engine/world/cities.js: a food bank, a growth threshold, housing) is the only
// stock, and everything else reads people from it:
//
//   people(size)   PEOPLE_BY_SIZE[size], Civ V's displayed curve 1,000 x size^2.8, stored as a
//                  table of integers so no device rounds it differently; between two sizes the
//                  food bank interpolates (peopleOf), so a levy or a plague shows at once.
//   growth         logistic with a soft cap. The food a city banks each turn is multiplied by
//                  logisticGrowthMult(size, housing) = 1 - (size / K)^THETA with
//                  K = housing + GROWTH_HEADROOM: near 1 while the city is small, falling smoothly
//                  as it fills its housing, 0 past K (so the largest size is still housing + 2). This replaces the old steps (full speed up
//                  to housing, a quarter for two sizes, then a wall). Housing (Granary tiers,
//                  water, aqueduct techs) is the carrying capacity, so building it is what moves K.
//   war and levy   men raised or lost are taken from the city's food bank (cities.js drawPeople),
//                  so a levy slows growth instead of being erased by the next turn's recount.
//
// region.currentPopulation stays on the record as a derived number (people the UI, rebellion
// and colonies read); resolveTurn rewrites it from size and food every turn.
//
// Records without a size (hand-built test regions, pre-v8 shapes) keep a fallback: logistic
// growth toward POPULATION_CAP_RATIO x their baseline, with the old growth levers as the rate.

// people for sizes 0..30 (index = size; size 0 reads as 1). Math.round(1000 * size ** 2.8).
export const PEOPLE_BY_SIZE = Object.freeze([
  1000, 1000, 6964, 21674, 48503, 90597, 150947, 232421, 337794, 469763, 630957,
  823947, 1051254, 1315350, 1618671, 1963611, 2352534, 2787770, 3271621, 3806362, 4394242,
  5037488, 5738303, 6498871, 7321355, 8207899, 9160631, 10181659, 11273077, 12436964, 13675383
]);
export const PEOPLE_MAX_SIZE = PEOPLE_BY_SIZE.length - 1;

export const sizeToPeople = (size) => PEOPLE_BY_SIZE[Math.max(1, Math.min(PEOPLE_MAX_SIZE, Math.floor(size || 1)))];

// The logistic soft cap (theta-logistic; THETA = 1 is Verhulst's). THETA is an integer, computed
// by multiplication, the same on every device. Calibrated on the whole-world sim: most cities sit
// at their housing, where the old steps grew at a quarter; THETA 2 with K = housing + 1.75 grows
// at 0.4 to 0.6 there, 0.2 to 0.3 one size above, and stops at housing + 2 as before. 150 turns
// end with the average city at 3.08 against 3.04 (Verhulst gave 2.80, THETA 4 gave 3.18;
// plans/math/world-systems.md).
export const GROWTH_HEADROOM = 1.75;
export const GROWTH_THETA = 2;

/** The share of a city's food surplus that turns into growth: 1 - (size / K)^THETA, K = housing + GROWTH_HEADROOM. */
export const logisticGrowthMult = (size, housing) => {
  const k = Math.max(1, housing) + GROWTH_HEADROOM;
  const x = Math.max(0, size) / k;
  let p = 1;
  for (let i = 0; i < GROWTH_THETA; i++) p *= x;
  return Math.max(0, 1 - p);
};

/** The people of a city: its size's people plus the food bank's share of the way to the next size. */
export const peopleOf = (city, threshold) => {
  const size = Math.max(1, Math.min(PEOPLE_MAX_SIZE, Math.floor(city?.size || 1)));
  const base = PEOPLE_BY_SIZE[size];
  if (size >= PEOPLE_MAX_SIZE || !(threshold > 0)) return base;
  const share = Math.max(0, Math.min(1, (city.food || 0) / threshold));
  return Math.round(base + (PEOPLE_BY_SIZE[size + 1] - base) * share);
};

/** Food that `men` people are worth in a city of `size` (the food bank's exchange rate). */
export const foodForPeople = (size, men, threshold) => {
  const s = Math.max(1, Math.min(PEOPLE_MAX_SIZE - 1, Math.floor(size || 1)));
  return (men * threshold) / (PEOPLE_BY_SIZE[s + 1] - PEOPLE_BY_SIZE[s]);
};

// ---------------------------------------------------------------------------------------------
// The fallback for records without a size.

export const BASE_GROWTH = 0.0002; // 0.02%/turn
export const FOOD_TIER_GROWTH_BONUS = 0.002; // per Food building tier
export const INFRA_GROWTH_BONUS = 0.0005; // per level of infrastructure
export const POPULATION_UNREST_THRESHOLD = 60;
export const UNREST_GROWTH_PENALTY = 0.003;
export const WAR_POPULATION_LOSS_RATE = 0.02; // per turn under invasion
// Relative to the record's own baseline (REGIONS_DATA[id].population). The floor keeps a
// devastated region from dying out; the cap is the carrying capacity K of the logistic.
export const POPULATION_FLOOR_RATIO = 0.05;
export const POPULATION_CAP_RATIO = 5;

/** The intrinsic growth rate r of a size-less record: food, infrastructure, national bonuses, unrest. */
export const getPopulationGrowthRate = ({ foodTier = -1, infrastructure = 0, popGrowthBonus = 0, unrest = 0 }) => {
  const foodBonus = Math.max(0, foodTier + 1) * FOOD_TIER_GROWTH_BONUS;
  const infraBonus = Math.max(0, infrastructure) * INFRA_GROWTH_BONUS;
  const unrestPenalty = unrest > POPULATION_UNREST_THRESHOLD ? UNREST_GROWTH_PENALTY : 0;
  return BASE_GROWTH + foodBonus + infraBonus + popGrowthBonus - unrestPenalty;
};

/**
 * Logistic step for a size-less record: P + r P (1 - P / K), K = baseline x POPULATION_CAP_RATIO.
 * Growth slows smoothly toward K instead of hitting a clamp; a negative r shrinks the record.
 * Under invasion it loses WAR_POPULATION_LOSS_RATE instead. Never below the floor.
 */
export const nextRegionPopulation = ({ currentPopulation, modernBaseline, growthRate, underInvasion }) => {
  if (!(modernBaseline > 0)) return currentPopulation;
  const k = modernBaseline * POPULATION_CAP_RATIO;
  const p = currentPopulation;
  const projected = underInvasion
    ? p * (1 - WAR_POPULATION_LOSS_RATE)
    : p + growthRate * p * (growthRate > 0 ? Math.max(0, 1 - p / k) : 1);
  return Math.max(modernBaseline * POPULATION_FLOOR_RATIO, projected);
};
