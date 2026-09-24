// src/data/buildings.js
// Region buildings (plan §M6): one upgrade-in-place line per category. A region holds at most one
// building per category, at a tier gated by TECH (not age — the plan's own M6.1 explicitly removes
// the old free "rush one tier ahead of the calendar" allowance and replaces it with per-tier tech
// requirements, §M6.3's own table). Upgrading to the next tier replaces it in place (Granary ->
// Irrigation -> Farm Estate -> ...) rather than requiring a fresh purchase each age.
//
// Scope trim from the full plan: every tier below now carries a REAL effect through the modifier
// engine (src/engine/modifiers/sources.js's regionSources, fixing the audit's own "6 of 9 building
// categories have no effect" finding) and a real per-tier tech gate + cost — but construction stays
// INSTANT rather than the plan's multi-turn queue (`region.construction = {categoryId, tier,
// turnsLeft}`), and building slots aren't enforced by upgrading a category needing tech ahead the
// AI doesn't build via this system yet (both M16 territory, once AI economy decisions exist to
// drive it). None of that is faked here — the effects, tech gates, and costs below are exactly
// what a player interacts with today, just without the turn-by-turn construction animation.
//
// Resource extraction (Copper Mine / Iron Foundry / Oil Well) is a separate, per-resource
// mechanic — see src/data/deposits.js and the Develop Resource Site action — since a region can
// hold more than one of those at once, unlike every category here.
import { getAgeIndex } from './ages';

export const BUILDING_CATEGORIES = {
  food: {
    label: 'Food & Growth',
    costMult: 0.8,
    // No `effects` entries: Food's population-growth bonus is still the existing, already-correct
    // dedicated formula in src/engine/population.js (FOOD_TIER_GROWTH_BONUS) rather than a generic
    // modifier line — it already matches this milestone's own per-tier numbers (0.20/0.40/0.60/
    // 0.80%/turn) exactly, so re-deriving it through the modifier engine would only add risk for
    // no behavior change.
    tiers: [
      { age: 'bronze', name: 'Granary', requiresTech: null },
      { age: 'classical', name: 'Irrigation', requiresTech: 'infrastructure_aqueducts' },
      { age: 'kingdoms', name: 'Farm Estate', requiresTech: 'governance_feudal_charters' },
      { age: 'gunpowder', name: 'Crop Rotation Farm', requiresTech: 'infrastructure_canal_locks' },
      { age: 'modern', name: 'Mechanized Farm', requiresTech: 'science_genomics' }
    ]
  },
  economy: {
    label: 'Economy',
    costMult: 1.1,
    tiers: [
      { age: 'classical', name: 'Market', requiresTech: 'economy_minted_coinage', effects: { 'local.taxIncome': 0.15 } },
      { age: 'kingdoms', name: 'Bazaar', requiresTech: 'economy_guild_charters', effects: { 'local.taxIncome': 0.25 } },
      { age: 'gunpowder', name: 'Bank', requiresTech: 'economy_joint_stock_companies', effects: { 'local.taxIncome': 0.35 } },
      { age: 'modern', name: 'Stock Exchange', requiresTech: 'economy_global_markets', effects: { 'local.taxIncome': 0.50 } }
    ]
  },
  military: {
    label: 'Military',
    costMult: 1.0,
    tiers: [
      { age: 'bronze', name: 'Barracks', requiresTech: null, effects: { 'local.manpower': 0.20 } },
      { age: 'classical', name: 'Drill Yard', requiresTech: 'military_iron_weapons', effects: { 'local.manpower': 0.35 } },
      { age: 'gunpowder', name: 'Military Academy', requiresTech: 'military_standing_armies', effects: { 'local.manpower': 0.50 } },
      { age: 'modern', name: 'War College', requiresTech: 'military_mechanized_warfare', effects: { 'local.manpower': 0.65 } }
    ]
  },
  defense: {
    label: 'Defense',
    costMult: 1.4,
    tiers: [
      { age: 'bronze', name: 'Palisade', requiresTech: null, effects: { 'local.fortLevel': 1 } },
      { age: 'classical', name: 'Stone Walls', requiresTech: 'military_siege_engineering', effects: { 'local.fortLevel': 2 } },
      { age: 'gunpowder', name: 'Star Fort', requiresTech: 'military_gunpowder_weapons', effects: { 'local.fortLevel': 4 } },
      { age: 'modern', name: 'Bunker Network', requiresTech: 'military_precision_guidance', effects: { 'local.fortLevel': 6 } }
    ]
  },
  science: {
    label: 'Science',
    costMult: 1.1,
    tiers: [
      { age: 'classical', name: 'Library', requiresTech: 'science_natural_philosophy', effects: { 'local.techPoints': 2 } },
      { age: 'kingdoms', name: 'Scriptorium', requiresTech: 'governance_royal_chancery', effects: { 'local.techPoints': 4 } },
      { age: 'gunpowder', name: 'University', requiresTech: 'science_scientific_method', effects: { 'local.techPoints': 6 } },
      { age: 'modern', name: 'Research Lab', requiresTech: 'science_computing', effects: { 'local.techPoints': 9 } }
    ]
  },
  industry: {
    label: 'Industry',
    costMult: 1.2,
    tiers: [
      { age: 'classical', name: 'Workshop', requiresTech: 'science_geometry', effects: { 'local.productionIncome': 0.20 } },
      { age: 'gunpowder', name: 'Manufactory', requiresTech: 'science_calculus', effects: { 'local.productionIncome': 0.35 } },
      { age: 'modern', name: 'Factory', requiresTech: 'economy_industrial_capital', effects: { 'local.productionIncome': 0.50 } }
    ]
  },
  culture: {
    label: 'Culture & Order',
    costMult: 0.9,
    tiers: [
      { age: 'bronze', name: 'Shrine', requiresTech: null, effects: { 'local.stabilityBonus': 1 } },
      { age: 'classical', name: 'Temple', requiresTech: 'governance_civic_assemblies', effects: { 'local.stabilityBonus': 1.5 } },
      { age: 'kingdoms', name: 'Cathedral / Mosque', requiresTech: 'science_scholastic_method', effects: { 'local.stabilityBonus': 2 } },
      { age: 'modern', name: 'Civic Center', requiresTech: 'governance_civil_service', effects: { 'local.stabilityBonus': 3 } }
    ]
  },
  naval: {
    label: 'Naval',
    costMult: 1.3,
    coastalOnly: true,
    tiers: [
      { age: 'classical', name: 'Harbor', requiresTech: 'economy_silk_road_trade', effects: { 'local.tradeIncome': 1 } },
      { age: 'kingdoms', name: 'Shipyard', requiresTech: 'science_optics', effects: { 'local.tradeIncome': 2 } },
      { age: 'gunpowder', name: 'Naval Base', requiresTech: 'economy_colonial_trade', effects: { 'local.tradeIncome': 3 } },
      { age: 'modern', name: 'Carrier Dock', requiresTech: 'military_mechanized_warfare', effects: { 'local.tradeIncome': 4 } }
    ]
  },
  logistics: {
    label: 'Logistics',
    costMult: 1.0,
    tiers: [
      { age: 'bronze', name: 'Road Post', requiresTech: null, effects: { 'local.supplyRange': 1 } },
      { age: 'kingdoms', name: 'Highway', requiresTech: 'infrastructure_stone_bridges', effects: { 'local.supplyRange': 2 } },
      { age: 'modern', name: 'Rail Depot', requiresTech: 'infrastructure_rail_networks', effects: { 'local.supplyRange': 3 } }
    ]
  }
};

export const BUILDING_CATEGORY_IDS = Object.keys(BUILDING_CATEGORIES);

// Per-resource extraction buildings (Develop Resource Site) — independent of the categories
// above; a region can hold one of each it has the deposit + age for, all at once. Untouched by
// M6: extraction is a separate, already-real mechanic (src/data/deposits.js).
export const EXTRACTION_BUILDINGS = {
  copper: { age: 'bronze', name: 'Copper Mine' },
  iron: { age: 'kingdoms', name: 'Iron Foundry' },
  oil: { age: 'modern', name: 'Oil Well' }
};

// True if `tierIndex` (the tier a region is about to move to) is allowed right now: no gate for a
// tier with no requiresTech (the plan's own "available at start" tier-1s), otherwise the matching
// tech must actually be researched. `researchedTechIds` is a Set/array-like of researched tech ids
// (state.techTree filtered to `.researched`) — the caller's job, not this pure function's.
export const canBuildTier = (categoryId, researchedTechIds, tierIndex) => {
  const category = BUILDING_CATEGORIES[categoryId];
  const tier = category?.tiers[tierIndex];
  if (!tier) return false;
  if (!tier.requiresTech) return true;
  return researchedTechIds?.has ? researchedTechIds.has(tier.requiresTech) : !!researchedTechIds?.[tier.requiresTech];
};

// The highest tier index a category has unlocked, given the current researched techs. -1 if
// nothing beyond what's already built is buildable (tier-1s with no tech gate always return >= 0).
export const maxBuildableTierIndex = (categoryId, researchedTechIds) => {
  const category = BUILDING_CATEGORIES[categoryId];
  if (!category) return -1;
  for (let i = category.tiers.length - 1; i >= 0; i -= 1) {
    if (canBuildTier(categoryId, researchedTechIds, i)) return i;
  }
  return -1;
};

export const getCategoryTierName = (categoryId, tierIndex) => BUILDING_CATEGORIES[categoryId]?.tiers[tierIndex]?.name || null;

// Plan §M6.1's own per-tier-index base cost table (before category multiplier), one entry per
// possible tier index across every category (the longest line, Food, has 5 tiers).
const BASE_TIER_COST = [60, 120, 220, 360, 550];

// Gold cost to build/upgrade to `tierIndex` in `categoryId`, before national.buildingCost (e.g.
// the Architect ruler trait, M3).
export const getBuildingTierCost = (categoryId, tierIndex, buildingCostMult = 0) => {
  const category = BUILDING_CATEGORIES[categoryId];
  const base = BASE_TIER_COST[tierIndex];
  if (!category || base === undefined) return null;
  return Math.round(base * category.costMult * (1 + buildingCostMult));
};

// Plan §M6.1: 1 + floor(totalDev/8) + 1 if capital, capped at 6. `totalDev` comes from
// src/engine/development.js's getTotalDev — passed in rather than imported, so this file (data,
// no engine dependency) stays a leaf module.
export const BUILDING_SLOTS_CAP = 6;
export const getBuildingSlots = (totalDev, isCapital) =>
  Math.min(BUILDING_SLOTS_CAP, 1 + Math.floor((totalDev || 0) / 8) + (isCapital ? 1 : 0));

// How many of a region's building slots are currently occupied — one per category with a tier
// actually built (>= 0), regardless of which tier; upgrading an existing category is free of
// slots (plan §M6.1), which is exactly why this counts CATEGORIES, not tiers.
export const getUsedBuildingSlots = (regionBuildings) =>
  Object.values(regionBuildings?.categories || {}).filter((tier) => tier >= 0).length;

// True if `resourceId`'s extraction building can be built right now (age gate only — the deposit
// check itself is src/data/deposits.js's job). Untouched by M6.
export const canBuildExtraction = (resourceId, calendarAgeId) => {
  const building = EXTRACTION_BUILDINGS[resourceId];
  if (!building) return false;
  const calendarIdx = getAgeIndex(calendarAgeId);
  if (calendarIdx === -1) return false;
  return getAgeIndex(building.age) <= calendarIdx + 1;
};

// A fresh region's building state: no category built, no extraction developed.
export const createEmptyRegionBuildings = () => ({
  categories: Object.fromEntries(BUILDING_CATEGORY_IDS.map(id => [id, -1])),
  extraction: { copper: false, iron: false, oil: false }
});
