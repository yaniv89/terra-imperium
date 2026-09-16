import { describe, it, expect } from 'vitest';
import {
  BUILDING_CATEGORIES,
  BUILDING_CATEGORY_IDS,
  EXTRACTION_BUILDINGS,
  canBuildTier,
  maxBuildableTierIndex,
  getCategoryTierName,
  canBuildExtraction,
  createEmptyRegionBuildings
} from './buildings';
import { AGE_ORDER, getAgeIndex } from './ages';

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

describe('canBuildTier', () => {
  it('allows a tier exactly at the calendar age', () => {
    expect(canBuildTier('food', 'bronze', 0)).toBe(true); // Granary, bronze
  });

  it('allows rushing exactly one age ahead of the calendar', () => {
    expect(canBuildTier('food', 'bronze', 1)).toBe(true); // Irrigation, classical
  });

  it('rejects rushing more than one age ahead', () => {
    expect(canBuildTier('food', 'bronze', 2)).toBe(false); // Farm Estate, kingdoms
  });

  it('rejects a tier that does not exist', () => {
    expect(canBuildTier('food', 'modern', 99)).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(canBuildTier('not_a_real_category', 'modern', 0)).toBe(false);
  });
});

describe('maxBuildableTierIndex', () => {
  it('returns -1 for a category with no tier unlocked yet', () => {
    // Economy's first tier is Classical — nothing buildable in Bronze even with the rush allowance...
    // wait: rush allows one age ahead, so Bronze calendar CAN rush into Classical's Market.
    expect(maxBuildableTierIndex('economy', 'bronze')).toBe(0);
  });

  it('advances as the calendar advances', () => {
    const bronze = maxBuildableTierIndex('food', 'bronze');
    const classical = maxBuildableTierIndex('food', 'classical');
    expect(classical).toBeGreaterThan(bronze);
  });

  it('reaches the final tier by Modern', () => {
    Object.entries(BUILDING_CATEGORIES).forEach(([id, category]) => {
      expect(maxBuildableTierIndex(id, 'modern')).toBe(category.tiers.length - 1);
    });
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
