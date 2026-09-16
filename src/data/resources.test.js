import { describe, it, expect } from 'vitest';
import {
  RESOURCES,
  RESOURCE_IDS,
  ALWAYS_AVAILABLE_RESOURCE_IDS,
  isResourceUnlocked,
  getUnlockedResourceIds,
  createEmptyResourcePool,
  getResourceUnlockAgeName,
  allUnlockAgesAreValid
} from './resources';

describe('resource unlock ages', () => {
  it('every unlockAge is either null or a real age id', () => {
    expect(allUnlockAgesAreValid()).toBe(true);
  });

  it('gold and hr are always available, from the very first age', () => {
    expect(ALWAYS_AVAILABLE_RESOURCE_IDS).toContain('gold');
    expect(ALWAYS_AVAILABLE_RESOURCE_IDS).toContain('hr');
    expect(isResourceUnlocked('gold', 'bronze')).toBe(true);
    expect(isResourceUnlocked('hr', 'bronze')).toBe(true);
  });

  it('copper unlocks at Bronze, iron at Classical, oil at Modern', () => {
    expect(isResourceUnlocked('copper', 'bronze')).toBe(true);
    expect(isResourceUnlocked('iron', 'bronze')).toBe(false);
    expect(isResourceUnlocked('iron', 'classical')).toBe(true);
    expect(isResourceUnlocked('oil', 'gunpowder')).toBe(false);
    expect(isResourceUnlocked('oil', 'modern')).toBe(true);
  });

  it('a resource never re-locks once its age arrives', () => {
    expect(isResourceUnlocked('copper', 'modern')).toBe(true);
    expect(isResourceUnlocked('iron', 'modern')).toBe(true);
  });

  it('returns false for an unknown resource or age id rather than throwing', () => {
    expect(isResourceUnlocked('unobtainium', 'bronze')).toBe(false);
    expect(isResourceUnlocked('gold', 'unobtainium-age')).toBe(true); // unlockAge null short-circuits
    expect(isResourceUnlocked('iron', 'unobtainium-age')).toBe(false);
  });
});

describe('getUnlockedResourceIds / createEmptyResourcePool', () => {
  it('Bronze Age only exposes gold, hr and copper', () => {
    const unlocked = getUnlockedResourceIds('bronze');
    expect(unlocked.sort()).toEqual(['copper', 'gold', 'hr'].sort());
  });

  it('Modern Age exposes every defined resource', () => {
    const unlocked = getUnlockedResourceIds('modern');
    expect(unlocked.sort()).toEqual([...RESOURCE_IDS].sort());
  });

  it('createEmptyResourcePool zero-initializes exactly the unlocked set', () => {
    const pool = createEmptyResourcePool('classical');
    expect(Object.keys(pool).sort()).toEqual(['copper', 'gold', 'hr', 'iron'].sort());
    Object.values(pool).forEach(v => expect(v).toBe(0));
  });
});

describe('getResourceUnlockAgeName', () => {
  it('returns null for always-available resources', () => {
    expect(getResourceUnlockAgeName('gold')).toBeNull();
  });

  it('returns the unlocking age id for gated resources', () => {
    expect(getResourceUnlockAgeName('oil')).toBe('modern');
  });

  it('returns null for an unknown resource id', () => {
    expect(getResourceUnlockAgeName('unobtainium')).toBeNull();
  });
});

describe('RESOURCES data integrity', () => {
  it('every resource has an id matching its key', () => {
    Object.entries(RESOURCES).forEach(([key, def]) => {
      expect(def.id).toBe(key);
    });
  });
});
