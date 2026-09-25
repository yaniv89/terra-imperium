import { describe, it, expect } from 'vitest';
import {
  BUILDING_CATEGORIES,
  BUILDING_CATEGORY_IDS,
  EXTRACTION_BUILDINGS,
  canBuildTier,
  maxBuildableTierIndex,
  getCategoryTierName,
  canBuildExtraction,
  createEmptyRegionBuildings,
  getBuildingTierCost,
  getBuildingSlots,
  getUsedBuildingSlots,
  BUILDING_SLOTS_CAP
} from './buildings';
import { AGE_ORDER, getAgeIndex } from './ages';
import { TECH_TREE } from './techTree';

const NO_TECHS = new Set();
const allTechs = () => new Set(Object.keys(TECH_TREE));

describe('BUILDING_CATEGORIES data integrity', () => {
  it('every tier is in non-decreasing age order within its category', () => {
    Object.entries(BUILDING_CATEGORIES).forEach(([id, category]) => {
      for (let i = 1; i < category.tiers.length; i += 1) {
        expect(getAgeIndex(category.tiers[i].age), `${id} tier ${i}`).toBeGreaterThanOrEqual(getAgeIndex(category.tiers[i - 1].age));
      }
    });
  });

  it('every tier references a real age id', () => {
    Object.values(BUILDING_CATEGORIES).forEach(category => {
      category.tiers.forEach(tier => {
        expect(AGE_ORDER).toContain(tier.age);
      });
    });
  });

  it('every category has at least one tier', () => {
    BUILDING_CATEGORY_IDS.forEach(id => {
      expect(BUILDING_CATEGORIES[id].tiers.length).toBeGreaterThan(0);
    });
  });
});

// Plan §M6.1: tech-gated, not age-gated — the old free "rush one tier ahead of the calendar"
// allowance is gone. A tier with no requiresTech (the plan's own "available at start" tier-1s) is
// always buildable; every other tier needs its specific tech researched.
describe('canBuildTier', () => {
  it('allows a tier-1 with no requiresTech, with no techs researched at all', () => {
    expect(canBuildTier('food', NO_TECHS, 0)).toBe(true); // Granary
    expect(canBuildTier('military', NO_TECHS, 0)).toBe(true); // Barracks
    expect(canBuildTier('defense', NO_TECHS, 0)).toBe(true); // Palisade
    expect(canBuildTier('culture', NO_TECHS, 0)).toBe(true); // Shrine
    expect(canBuildTier('logistics', NO_TECHS, 0)).toBe(true); // Road Post
  });

  it('rejects a gated tier with no techs researched', () => {
    expect(canBuildTier('food', NO_TECHS, 1)).toBe(false); // Irrigation needs Aqueducts
  });

  it('rejects a category whose tier-1 itself requires a tech (Economy/Science/Industry/Naval have none free)', () => {
    expect(canBuildTier('economy', NO_TECHS, 0)).toBe(false); // Market needs Minted Coinage
  });

  it('allows a gated tier once its specific tech is researched', () => {
    expect(canBuildTier('food', new Set(['infrastructure_aqueducts']), 1)).toBe(true);
  });

  it('does not accept an unrelated researched tech as satisfying the gate', () => {
    expect(canBuildTier('food', new Set(['military_bronze_casting']), 1)).toBe(false);
  });

  it('accepts a plain object of researched ids (state.techTree\'s own shape), not just a Set', () => {
    expect(canBuildTier('food', { infrastructure_aqueducts: true }, 1)).toBe(true);
    expect(canBuildTier('food', {}, 1)).toBe(false);
  });

  it('rejects a tier that does not exist', () => {
    expect(canBuildTier('food', allTechs(), 99)).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(canBuildTier('not_a_real_category', allTechs(), 0)).toBe(false);
  });

  it('every requiresTech id names a real tech in TECH_TREE', () => {
    Object.entries(BUILDING_CATEGORIES).forEach(([id, category]) => {
      category.tiers.forEach((tier, i) => {
        if (tier.requiresTech) expect(TECH_TREE, `${id} tier ${i}`).toHaveProperty(tier.requiresTech);
      });
    });
  });
});

describe('maxBuildableTierIndex', () => {
  it('returns -1 for a category whose tier-1 itself needs a tech, with none researched', () => {
    expect(maxBuildableTierIndex('economy', NO_TECHS)).toBe(-1);
  });

  it('returns 0 for a category whose tier-1 is free, with no techs researched', () => {
    expect(maxBuildableTierIndex('food', NO_TECHS)).toBe(0);
  });

  it('advances as more of the category\'s own techs are researched', () => {
    const none = maxBuildableTierIndex('food', NO_TECHS);
    const oneTech = maxBuildableTierIndex('food', new Set(['infrastructure_aqueducts']));
    expect(oneTech).toBeGreaterThan(none);
  });

  it('reaches the final tier once every tech in the game is researched', () => {
    Object.entries(BUILDING_CATEGORIES).forEach(([id, category]) => {
      expect(maxBuildableTierIndex(id, allTechs())).toBe(category.tiers.length - 1);
    });
  });
});

describe('getBuildingTierCost', () => {
  it('scales up with tier index within the same category', () => {
    const tier0 = getBuildingTierCost('military', 0);
    const tier1 = getBuildingTierCost('military', 1);
    expect(tier1).toBeGreaterThan(tier0);
  });

  it('applies each category\'s own cost multiplier (Defense costs more than Food at the same tier)', () => {
    expect(getBuildingTierCost('defense', 0)).toBeGreaterThan(getBuildingTierCost('food', 0));
  });

  it('applies a negative buildingCost modifier as a discount (e.g. the Architect trait)', () => {
    const base = getBuildingTierCost('military', 0, 0);
    const discounted = getBuildingTierCost('military', 0, -0.15);
    expect(discounted).toBeLessThan(base);
  });

  it('returns null for a tier index beyond any category\'s length', () => {
    expect(getBuildingTierCost('food', 99)).toBeNull();
  });
});

describe('getBuildingSlots / getUsedBuildingSlots', () => {
  it('is 1 slot at 0 development, non-capital', () => {
    expect(getBuildingSlots(0, false)).toBe(1);
  });

  it('gains a slot per 8 total development', () => {
    expect(getBuildingSlots(8, false)).toBe(2);
    expect(getBuildingSlots(16, false)).toBe(3);
  });

  it('gains one extra slot for the capital', () => {
    expect(getBuildingSlots(0, true)).toBe(2);
  });

  it('never exceeds the slots cap', () => {
    expect(getBuildingSlots(10000, true)).toBe(BUILDING_SLOTS_CAP);
  });

  it('counts one used slot per built category, regardless of its tier', () => {
    const buildings = createEmptyRegionBuildings();
    buildings.categories.food = 3; // a high tier still counts as one slot
    buildings.categories.military = 0;
    expect(getUsedBuildingSlots(buildings)).toBe(2);
  });

  it('counts 0 used slots for a fresh region', () => {
    expect(getUsedBuildingSlots(createEmptyRegionBuildings())).toBe(0);
  });
});

describe('getCategoryTierName', () => {
  it('returns the correct name for a real tier', () => {
    expect(getCategoryTierName('food', 0)).toBe('Granary');
  });

  it('returns null for an out-of-range tier or unknown category', () => {
    expect(getCategoryTierName('food', 99)).toBeNull();
    expect(getCategoryTierName('nope', 0)).toBeNull();
  });
});

describe('canBuildExtraction', () => {
  it('gates each extraction building by its own age', () => {
    expect(canBuildExtraction('copper', 'bronze')).toBe(true);
    expect(canBuildExtraction('iron', 'bronze')).toBe(false);
    expect(canBuildExtraction('iron', 'classical')).toBe(true); // one age ahead of kingdoms
    expect(canBuildExtraction('oil', 'gunpowder')).toBe(true); // one age ahead of modern
    expect(canBuildExtraction('oil', 'kingdoms')).toBe(false);
  });

  it('rejects an unknown resource', () => {
    expect(canBuildExtraction('unobtainium', 'modern')).toBe(false);
  });

  it('every EXTRACTION_BUILDINGS entry references a real age', () => {
    Object.values(EXTRACTION_BUILDINGS).forEach(b => {
      expect(AGE_ORDER).toContain(b.age);
    });
  });
});

describe('createEmptyRegionBuildings', () => {
  it('starts every category at -1 (none) and every extraction false', () => {
    const fresh = createEmptyRegionBuildings();
    BUILDING_CATEGORY_IDS.forEach(id => expect(fresh.categories[id]).toBe(-1));
    expect(fresh.extraction).toEqual({ copper: false, iron: false, oil: false });
  });
});
