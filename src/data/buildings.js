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
import { getAgeIndex, FIRST_AGE_ID } from './ages';
import { t } from '../i18n/core';

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
      { age: 'stone', name: 'Storage Pits', requiresTech: null },
      { age: 'bronze', name: 'Granary', requiresTech: 'economy_granary_storage' },
      { age: 'classical', name: 'Irrigation', requiresTech: 'infrastructure_aqueducts' },
      { age: 'kingdoms', name: 'Farm Estate', requiresTech: 'governance_feudal_charters' },
      { age: 'gunpowder', name: 'Crop Rotation Farm', requiresTech: 'infrastructure_canal_locks' },
      { age: 'modern', name: 'Mechanized Farm', requiresTech: 'economy_mass_production' },
      { age: 'information', name: 'Vertical Farm', requiresTech: 'science_genomics' },
      { age: 'future', name: 'Synthesis Vats', requiresTech: 'science_synthetic_biology' }
    ]
  },
  // The income lines pay a flat yield on top of their percentage: most provinces start with a
  // development of 1-3, where a percentage alone rounds to nothing — every Market, Workshop and
  // Barracks now pays a visible amount from the turn it's built, and still scales with growth.
  economy: {
    label: 'Economy',
    costMult: 1.1,
    tiers: [
      { age: 'classical', name: 'Market', requiresTech: 'economy_minted_coinage', effects: { 'local.taxIncome': 0.15, 'local.flatGold': 3 } },
      { age: 'kingdoms', name: 'Bazaar', requiresTech: 'economy_guild_charters', effects: { 'local.taxIncome': 0.25, 'local.flatGold': 5 } },
      { age: 'gunpowder', name: 'Bank', requiresTech: 'economy_joint_stock_companies', effects: { 'local.taxIncome': 0.35, 'local.flatGold': 8 } },
      { age: 'modern', name: 'Stock Exchange', requiresTech: 'economy_industrial_capital', effects: { 'local.taxIncome': 0.50, 'local.flatGold': 12 } },
      { age: 'information', name: 'Tech Hub', requiresTech: 'economy_digital_economy', effects: { 'local.taxIncome': 0.65, 'local.flatGold': 16 } },
      { age: 'future', name: 'Fabrication Hub', requiresTech: 'economy_post_scarcity_fabrication', effects: { 'local.taxIncome': 0.80, 'local.flatGold': 20 } }
    ]
  },
  military: {
    label: 'Military',
    costMult: 1.0,
    tiers: [
      { age: 'stone', name: 'Warrior Lodge', requiresTech: 'military_hunting_bands', effects: { 'local.manpower': 0.10, 'local.flatManpower': 2 } },
      { age: 'bronze', name: 'Barracks', requiresTech: 'military_bronze_casting', effects: { 'local.manpower': 0.20, 'local.flatManpower': 3 } },
      { age: 'classical', name: 'Drill Yard', requiresTech: 'military_iron_weapons', effects: { 'local.manpower': 0.35, 'local.flatManpower': 5 } },
      { age: 'gunpowder', name: 'Military Academy', requiresTech: 'military_standing_armies', effects: { 'local.manpower': 0.50, 'local.flatManpower': 8 } },
      { age: 'modern', name: 'War College', requiresTech: 'military_mechanized_warfare', effects: { 'local.manpower': 0.65, 'local.flatManpower': 12 } },
      { age: 'information', name: 'Simulation Center', requiresTech: 'military_unmanned_systems', effects: { 'local.manpower': 0.80, 'local.flatManpower': 16 } },
      { age: 'future', name: 'Exo Armory', requiresTech: 'military_powered_exoskeletons', effects: { 'local.manpower': 0.95, 'local.flatManpower': 20 } }
    ]
  },
  defense: {
    label: 'Defense',
    costMult: 1.4,
    tiers: [
      { age: 'stone', name: 'Earthwork Ditch', requiresTech: 'governance_chiefdoms', effects: { 'local.fortLevel': 0.5 } },
      { age: 'bronze', name: 'Palisade', requiresTech: 'infrastructure_mudbrick_roads', effects: { 'local.fortLevel': 1 } },
      { age: 'classical', name: 'Stone Walls', requiresTech: 'military_siege_engineering', effects: { 'local.fortLevel': 2 } },
      { age: 'gunpowder', name: 'Star Fort', requiresTech: 'military_gunpowder_weapons', effects: { 'local.fortLevel': 4 } },
      { age: 'information', name: 'Bunker Network', requiresTech: 'military_precision_guidance', effects: { 'local.fortLevel': 6 } },
      { age: 'future', name: 'Shield Dome', requiresTech: 'military_directed_energy', effects: { 'local.fortLevel': 8 } }
    ]
  },
  science: {
    label: 'Science',
    costMult: 1.1,
    tiers: [
      { age: 'stone', name: 'Tablet House', requiresTech: 'science_proto_writing', effects: { 'local.techPoints': 0.5 } },
      { age: 'classical', name: 'Library', requiresTech: 'science_natural_philosophy', effects: { 'local.techPoints': 2 } },
      { age: 'kingdoms', name: 'Scriptorium', requiresTech: 'governance_royal_chancery', effects: { 'local.techPoints': 4 } },
      { age: 'gunpowder', name: 'University', requiresTech: 'science_scientific_method', effects: { 'local.techPoints': 6 } },
      { age: 'modern', name: 'Research Lab', requiresTech: 'science_computing', effects: { 'local.techPoints': 9 } },
      { age: 'information', name: 'Supercomputer Center', requiresTech: 'science_artificial_intelligence', effects: { 'local.techPoints': 13 } },
      { age: 'future', name: 'Quantum Lab', requiresTech: 'science_quantum_computing', effects: { 'local.techPoints': 18 } }
    ]
  },
  // Industry pays, but crowded workshops and factory towns breed discontent (negative local
  // stability): pair them with Culture & Order buildings to keep the peace.
  industry: {
    label: 'Industry',
    costMult: 1.2,
    tiers: [
      { age: 'classical', name: 'Workshop', requiresTech: 'science_geometry', effects: { 'local.productionIncome': 0.20, 'local.flatProduction': 2, 'local.flatGold': 3 } },
      { age: 'gunpowder', name: 'Manufactory', requiresTech: 'science_calculus', effects: { 'local.productionIncome': 0.35, 'local.flatProduction': 4, 'local.flatGold': 6, 'local.stabilityBonus': -0.5 } },
      { age: 'modern', name: 'Factory', requiresTech: 'economy_industrial_capital', effects: { 'local.productionIncome': 0.50, 'local.flatProduction': 6, 'local.flatGold': 10, 'local.stabilityBonus': -0.75 } },
      { age: 'information', name: 'Automated Plant', requiresTech: 'economy_global_markets', effects: { 'local.productionIncome': 0.65, 'local.flatProduction': 8, 'local.flatGold': 14, 'local.stabilityBonus': -0.75 } },
      { age: 'future', name: 'Nanoforge', requiresTech: 'economy_automated_industry', effects: { 'local.productionIncome': 0.80, 'local.flatProduction': 10, 'local.flatGold': 18, 'local.stabilityBonus': -0.75 } }
    ]
  },
  culture: {
    label: 'Culture & Order',
    costMult: 0.9,
    tiers: [
      { age: 'stone', name: 'Stone Circle', requiresTech: 'governance_sacred_kingship', effects: { 'local.stabilityBonus': 0.5 } },
      { age: 'bronze', name: 'Shrine', requiresTech: 'governance_code_of_laws', effects: { 'local.stabilityBonus': 1 } },
      { age: 'classical', name: 'Temple', requiresTech: 'governance_civic_assemblies', effects: { 'local.stabilityBonus': 1.5 } },
      { age: 'kingdoms', name: 'Cathedral / Mosque', requiresTech: 'science_scholastic_method', effects: { 'local.stabilityBonus': 2 } },
      { age: 'modern', name: 'Civic Center', requiresTech: 'governance_civil_service', effects: { 'local.stabilityBonus': 3 } },
      { age: 'information', name: 'Media Center', requiresTech: 'infrastructure_telecom_networks', effects: { 'local.stabilityBonus': 4 } },
      { age: 'future', name: 'Habitat Commons', requiresTech: 'economy_post_scarcity_fabrication', effects: { 'local.stabilityBonus': 5 } }
    ]
  },
  naval: {
    label: 'Naval',
    costMult: 1.3,
    coastalOnly: true,
    tiers: [
      { age: 'stone', name: 'Canoe Landing', requiresTech: 'science_star_lore', effects: { 'local.tradeIncome': 0.5 } },
      { age: 'classical', name: 'Harbor', requiresTech: 'economy_silk_road_trade', effects: { 'local.tradeIncome': 1 } },
      { age: 'kingdoms', name: 'Shipyard', requiresTech: 'science_optics', effects: { 'local.tradeIncome': 2 } },
      { age: 'gunpowder', name: 'Naval Base', requiresTech: 'economy_colonial_trade', effects: { 'local.tradeIncome': 3 } },
      { age: 'modern', name: 'Carrier Dock', requiresTech: 'military_combined_arms', effects: { 'local.tradeIncome': 4 } },
      { age: 'information', name: 'Drone Port', requiresTech: 'military_unmanned_systems', effects: { 'local.tradeIncome': 5 } },
      { age: 'future', name: 'Submersible Pens', requiresTech: 'military_directed_energy', effects: { 'local.tradeIncome': 6 } }
    ]
  },
  logistics: {
    label: 'Logistics',
    costMult: 1.0,
    tiers: [
      { age: 'stone', name: 'Trail Cairns', requiresTech: 'infrastructure_the_wheel', effects: { 'local.supplyRange': 0.5 } },
      { age: 'bronze', name: 'Road Post', requiresTech: 'governance_scribal_bureaucracy', effects: { 'local.supplyRange': 1 } },
      { age: 'kingdoms', name: 'Highway', requiresTech: 'infrastructure_stone_bridges', effects: { 'local.supplyRange': 2 } },
      { age: 'modern', name: 'Rail Depot', requiresTech: 'infrastructure_rail_networks', effects: { 'local.supplyRange': 3 } },
      { age: 'information', name: 'Logistics Hub', requiresTech: 'governance_digital_administration', effects: { 'local.supplyRange': 4 } },
      { age: 'future', name: 'Maglev Terminal', requiresTech: 'infrastructure_orbital_infrastructure', effects: { 'local.supplyRange': 5 } }
    ]
  },
  // The Energy line (eight ages U51): production only (no carbon while the climate meter, U52, is
  // deferred), and it takes no building slot (`freeSlot`, getUsedBuildingSlots).
  energy: {
    label: 'Energy',
    costMult: 1.0,
    freeSlot: true,
    tiers: [
      { age: 'gunpowder', name: 'Coal Plant', requiresTech: 'infrastructure_canal_locks', effects: { 'local.productionIncome': 0.10 } },
      { age: 'modern', name: 'Oil Plant', requiresTech: 'economy_mass_production', effects: { 'local.productionIncome': 0.20 } },
      { age: 'modern', name: 'Nuclear Plant', requiresTech: 'science_nuclear_physics', effects: { 'local.productionIncome': 0.30 } },
      { age: 'information', name: 'Power Grid', requiresTech: 'infrastructure_smart_grids', effects: { 'local.productionIncome': 0.40 } },
      // Ends oil dependence: the city's Industry makes supplies with no oil (supplies.js).
      { age: 'future', name: 'Fusion Reactor', requiresTech: 'infrastructure_fusion_power', effects: { 'local.productionIncome': 0.50 } }
    ]
  }
};

export const BUILDING_CATEGORY_IDS = Object.keys(BUILDING_CATEGORIES);

// Per-resource extraction buildings (Develop Resource Site) — independent of the categories
// above; a region can hold one of each it has the deposit + age for, all at once. Untouched by
// M6: extraction is a separate, already-real mechanic (src/data/deposits.js).
export const EXTRACTION_BUILDINGS = {
  copper: { age: 'stone', name: 'Copper Mine' },
  iron: { age: 'kingdoms', name: 'Iron Foundry' },
  oil: { age: 'modern', name: 'Oil Well' },
  rareMetals: { age: 'information', name: 'Rare Metal Mine' }
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
// nothing is buildable yet (only Storage Pits are open without a tech since the tech unlocks).
export const maxBuildableTierIndex = (categoryId, researchedTechIds) => {
  const category = BUILDING_CATEGORIES[categoryId];
  if (!category) return -1;
  for (let i = category.tiers.length - 1; i >= 0; i -= 1) {
    if (canBuildTier(categoryId, researchedTechIds, i)) return i;
  }
  return -1;
};

export const getCategoryTierName = (categoryId, tierIndex) => BUILDING_CATEGORIES[categoryId]?.tiers[tierIndex]?.name || null;

// Plan §M6.1's own base cost table (before category multiplier), one entry per rank. A Stone tier
// (eight-ages plan U28, KTD11) is rank 0, so a line without one starts at rank 1 and keeps its costs.
const BASE_TIER_COST = [30, 60, 120, 220, 360, 550, 800, 1100];
const tierRank = (category, tierIndex) => tierIndex + (category.tiers[0].age === FIRST_AGE_ID ? 0 : 1);

// Gold cost to build/upgrade to `tierIndex` in `categoryId`, before national.buildingCost (e.g.
// the Architect ruler trait, M3).
// What a tier costs in PRODUCTION (cities.js productionCost; lane city-builds). The gold table above
// rose about 1.7 times an age while a city's production rose about 1.3 times, so the age's own
// building took 8 turns in the Stone Age and 23 in the Gunpowder Age (balance-sim cityBuilds).
// This curve rises about as fast as production does (Civ VI: an Industrial building costs about
// four times an Ancient one, not thirty). The gold price of the old buy path keeps the table above.
// The first three ranks are about 8 to 12 turns of the age's benchmark city on Normal (ages.js benchProduction;
// math report 29 Oct, section 3: core buildings 6 to 10 turns), so a young city is not stuck for 15 to 20.
const BUILD_TIER_COST = [25, 45, 80, 130, 175, 225, 280, 340];
export const getBuildingBuildCost = (categoryId, tierIndex) => {
  const category = BUILDING_CATEGORIES[categoryId];
  if (!category?.tiers[tierIndex]) return null;
  return Math.round(BUILD_TIER_COST[tierRank(category, tierIndex)] * category.costMult);
};

export const getBuildingTierCost = (categoryId, tierIndex, buildingCostMult = 0) => {
  const category = BUILDING_CATEGORIES[categoryId];
  if (!category?.tiers[tierIndex]) return null;
  const base = BASE_TIER_COST[tierRank(category, tierIndex)];
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
  Object.entries(regionBuildings?.categories || {}).filter(([id, tier]) => tier >= 0 && !BUILDING_CATEGORIES[id]?.freeSlot).length;

// True if `resourceId`'s extraction building can be built right now (age gate only — the deposit
// check itself is src/data/deposits.js's job). Untouched by M6.
export const canBuildExtraction = (resourceId, ageId) => {
  const building = EXTRACTION_BUILDINGS[resourceId];
  if (!building) return false;
  const idx = getAgeIndex(ageId);
  if (idx === -1) return false;
  return getAgeIndex(building.age) <= idx;
};

// A fresh region's building state: no category built, no extraction developed.
export const createEmptyRegionBuildings = () => ({
  categories: Object.fromEntries(BUILDING_CATEGORY_IDS.map(id => [id, -1])),
  extraction: { copper: false, iron: false, oil: false, rareMetals: false }
});

// What a building tier actually does, in plain words, for the build buttons (e.g. "+3 gold/turn,
// +15% tax"). Food's growth bonus isn't a modifier line, so the caller adds it.
const EFFECT_WORDS = {
  'local.flatGold': (v) => t('fxb.flatGold', { n: v }),
  'local.flatManpower': (v) => t('fxb.flatManpower', { n: v }),
  'local.taxIncome': (v) => t('fxb.taxIncome', { n: Math.round(v * 100) }),
  'local.productionIncome': (v) => t('fxb.productionIncome', { n: Math.round(v * 100) }),
  'local.manpower': (v) => t('fxb.manpower', { n: Math.round(v * 100) }),
  'local.techPoints': (v) => t('fxb.techPoints', { n: v }),
  'local.tradeIncome': (v) => t('fxb.tradeIncome', { n: v }),
  'local.supplyRange': (v) => t('fxb.supplyRange', { n: v }),
  'local.fortLevel': (v) => t('fxb.fortLevel', { n: v }),
  'local.stabilityBonus': (v) => t('fxb.stabilityBonus', { n: v })
};
export const describeTierEffects = (categoryId, tierIndex) => {
  const effects = BUILDING_CATEGORIES[categoryId]?.tiers[tierIndex]?.effects || {};
  return Object.entries(effects).map(([key, value]) => (EFFECT_WORDS[key] ? EFFECT_WORDS[key](value) : null)).filter(Boolean).join(', ');
};
