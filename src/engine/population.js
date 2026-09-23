// src/engine/population.js
// Population growth (plan item 3): driven by what the player (and the war) actually do — Food
// buildings, infrastructure, government/policy/wonder bonuses, unrest, invasion — not by turns
// simply passing. Before this, region.currentPopulation never changed on its own at all (the only
// mutation anywhere was the manual, opt-in POPULATION_POLICY action), so there was nothing to rip
// out here, only new levers to add. Pure and unit-testable, mirroring src/engine/siege.js.

// A tiny subsistence trickle every region gets regardless of development — "don't just let it grow
// with time" means time ALONE should get you almost nothing; everything meaningfully above this has
// to be earned through the levers below.
export const BASE_GROWTH = 0.0002; // 0.02%/turn

// Per tier of the (now-wired) Food & Growth building category (Granary -> ... -> Mechanized Farm),
// counting from 1 for the first tier built (region.buildings.categories.food is -1 when unbuilt).
export const FOOD_TIER_GROWTH_BONUS = 0.002; // 0.2%/turn per tier

// Per level of currentInfrastructure (0-10, already built by Build Infrastructure) — a smaller,
// secondary lever since it's shared with several other systems (supply capacity, gold/hr income)
// rather than being population's own dedicated investment.
export const INFRA_GROWTH_BONUS = 0.0005; // 0.05%/turn per level

// Above this unrest, a region's populace is too unsettled to grow at its usual rate. Distinct from
// nextUnrest's own UNREST_CONTROL_THRESHOLD (which is about control, not unrest itself) and from
// rebellion.js's much higher REBELLION_UNREST_THRESHOLD (90, where an actual uprising spawns) —
// this is a softer, earlier drag on growth alone.
export const POPULATION_UNREST_THRESHOLD = 60;
export const UNREST_GROWTH_PENALTY = 0.003; // 0.3%/turn

// A region actively under invasion pays a real human cost instead of growing at all this turn.
export const WAR_POPULATION_LOSS_RATE = 0.02; // 2%/turn

// Clamped relative to the region's own modern-baseline population (REGIONS_DATA[id].population),
// consistent with how getDisplayPopulation's own growthRatio already treats that figure. The floor
// keeps a devastated region from reading as having died out entirely; the cap keeps a maximally
// developed region plausible over a 4,300-year game instead of compounding to absurdity.
export const POPULATION_FLOOR_RATIO = 0.05;
export const POPULATION_CAP_RATIO = 5;

// One region's per-turn population growth RATE (not the population itself) — every lever the
// player actually controls, summed. foodTier is region.buildings?.categories?.food (-1 if
// unbuilt); infrastructure is region.currentInfrastructure; popGrowthBonus is
// getNationBonusTotal(owner, 'popGrowthBonus') (government/policy/wonder); unrest is the region's
// current unrest (post this-turn's drift, so a stability swing is felt the same turn it happens,
// matching nextUnrest's own stabilityBonus convention).
export const getPopulationGrowthRate = ({ foodTier = -1, infrastructure = 0, popGrowthBonus = 0, unrest = 0 }) => {
  const foodBonus = Math.max(0, foodTier + 1) * FOOD_TIER_GROWTH_BONUS;
  const infraBonus = Math.max(0, infrastructure) * INFRA_GROWTH_BONUS;
  const unrestPenalty = unrest > POPULATION_UNREST_THRESHOLD ? UNREST_GROWTH_PENALTY : 0;
  return BASE_GROWTH + foodBonus + infraBonus + popGrowthBonus - unrestPenalty;
};

// A region actively under invasion loses population instead of growing, regardless of how strong
// its other growth levers are — war has a real cost. Otherwise applies growthRate and clamps to
// the floor/cap above, both relative to modernBaseline (REGIONS_DATA[id].population).
export const nextRegionPopulation = ({ currentPopulation, modernBaseline, growthRate, underInvasion }) => {
  if (!(modernBaseline > 0)) return currentPopulation;
  const projected = underInvasion
    ? currentPopulation * (1 - WAR_POPULATION_LOSS_RATE)
    : currentPopulation * (1 + growthRate);
  return Math.max(modernBaseline * POPULATION_FLOOR_RATIO, Math.min(modernBaseline * POPULATION_CAP_RATIO, projected));
};
