// src/data/buildings.js
// Region buildings (plan §6): one upgrade-in-place line per category. A region holds at most one
// building per category, at a tier gated by age; upgrading to the next tier replaces it in place
// (Granary -> Irrigation -> Farm Estate -> ...) rather than requiring a fresh purchase each age.
// A dash in the plan's table means that category has no new tier that age — the region simply
// keeps whatever tier it already has, which falls out naturally here since tiers only exist for
// the ages a category actually advances in.
//
// Resource extraction (Copper Mine / Iron Foundry / Oil Well) is a separate, per-resource
// mechanic — see src/data/deposits.js and the Develop Resource Site action — since a region can
// hold more than one of those at once, unlike every category here.
import { getAgeIndex } from './ages';

export const BUILDING_CATEGORIES = {
  food: {
    label: 'Food & Growth',
    tiers: [
      { age: 'bronze', name: 'Granary' },
      { age: 'classical', name: 'Irrigation' },
      { age: 'kingdoms', name: 'Farm Estate' },
      { age: 'gunpowder', name: 'Crop Rotation Farm' },
      { age: 'modern', name: 'Mechanized Farm' }
    ]
  },
  economy: {
    label: 'Economy',
    tiers: [
      { age: 'classical', name: 'Market' },
      { age: 'kingdoms', name: 'Bazaar' },
      { age: 'gunpowder', name: 'Bank' },
      { age: 'modern', name: 'Stock Exchange' }
    ]
  },
  military: {
    label: 'Military',
    tiers: [
      { age: 'bronze', name: 'Barracks' },
      { age: 'classical', name: 'Drill Yard' },
      { age: 'gunpowder', name: 'Military Academy' },
      { age: 'modern', name: 'War College' }
    ]
  },
  defense: {
    label: 'Defense',
    tiers: [
      { age: 'bronze', name: 'Palisade' },
      { age: 'classical', name: 'Stone Walls' },
      { age: 'gunpowder', name: 'Star Fort' },
      { age: 'modern', name: 'Bunker Network' }
    ]
  },
  science: {
    label: 'Science',
    tiers: [
      { age: 'classical', name: 'Library' },
      { age: 'kingdoms', name: 'Scriptorium' },
      { age: 'gunpowder', name: 'University' },
      { age: 'modern', name: 'Research Lab' }
    ]
  },
  industry: {
    label: 'Industry',
    tiers: [
      { age: 'classical', name: 'Workshop' },
      { age: 'gunpowder', name: 'Manufactory' },
      { age: 'modern', name: 'Factory' }
    ]
  },
  culture: {
    label: 'Culture & Order',
    tiers: [
      { age: 'bronze', name: 'Shrine' },
      { age: 'classical', name: 'Temple' },
      { age: 'kingdoms', name: 'Cathedral / Mosque' },
      { age: 'modern', name: 'Civic Center' }
    ]
  },
  naval: {
    label: 'Naval',
    coastalOnly: true,
    tiers: [
      { age: 'classical', name: 'Harbor' },
      { age: 'kingdoms', name: 'Shipyard' },
      { age: 'gunpowder', name: 'Naval Base' },
      { age: 'modern', name: 'Carrier Dock' }
    ]
  },
  logistics: {
    label: 'Logistics',
    tiers: [
      { age: 'bronze', name: 'Road Post' },
      { age: 'kingdoms', name: 'Highway' },
      { age: 'modern', name: 'Rail Depot' }
    ]
  }
};

export const BUILDING_CATEGORY_IDS = Object.keys(BUILDING_CATEGORIES);

// Per-resource extraction buildings (Develop Resource Site) — independent of the categories
// above; a region can hold one of each it has the deposit + age for, all at once.
export const EXTRACTION_BUILDINGS = {
  copper: { age: 'bronze', name: 'Copper Mine' },
  iron: { age: 'kingdoms', name: 'Iron Foundry' },
  oil: { age: 'modern', name: 'Oil Well' }
};

// True if `tierIndex` (the tier a region is about to move to) is allowed right now: unlocked by
// the calendar, or exactly one tier ahead of it — the same rush allowance every age-gated system
// in this game shares (see ages.js's getEffectiveAgeIndex for the units/tech version).
export const canBuildTier = (categoryId, calendarAgeId, tierIndex) => {
  const category = BUILDING_CATEGORIES[categoryId];
  const tier = category?.tiers[tierIndex];
  if (!tier) return false;
  const tierAgeIdx = getAgeIndex(tier.age);
  const calendarIdx = getAgeIndex(calendarAgeId);
  if (calendarIdx === -1) return false;
  return tierAgeIdx <= calendarIdx + 1;
};

// The highest tier index a category has unlocked by (and including) the given age, one-tier-ahead
// rush allowance included — the ceiling canBuildTier itself enforces. -1 if nothing is buildable yet.
export const maxBuildableTierIndex = (categoryId, calendarAgeId) => {
  const category = BUILDING_CATEGORIES[categoryId];
  if (!category) return -1;
  for (let i = category.tiers.length - 1; i >= 0; i -= 1) {
    if (canBuildTier(categoryId, calendarAgeId, i)) return i;
  }
  return -1;
};

export const getCategoryTierName = (categoryId, tierIndex) => BUILDING_CATEGORIES[categoryId]?.tiers[tierIndex]?.name || null;

// True if `resourceId`'s extraction building can be built right now (age gate only — the deposit
// check itself is src/data/deposits.js's job).
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
