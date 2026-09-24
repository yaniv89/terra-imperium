import { describe, it, expect } from 'vitest';
import { TRAITS, TRAIT_IDS, POSITIVE_TRAIT_IDS, NEGATIVE_TRAIT_IDS } from './traits';
import { LEGACY_HOOK } from '../engine/modifiers/registry';

describe('TRAITS', () => {
  it('every trait id key matches its own id field', () => {
    Object.entries(TRAITS).forEach(([key, trait]) => {
      expect(trait.id).toBe(key);
    });
  });

  it('every trait has at least one effect, and every effect hook is a real, wired modifier hook', () => {
    Object.values(TRAITS).forEach((trait) => {
      const keys = Object.keys(trait.effects);
      expect(keys.length).toBeGreaterThan(0);
      keys.forEach((hook) => {
        expect(LEGACY_HOOK).toHaveProperty(hook);
      });
    });
  });

  it('every trait has a non-empty name and description', () => {
    Object.values(TRAITS).forEach((trait) => {
      expect(trait.name.length).toBeGreaterThan(0);
      expect(trait.description.length).toBeGreaterThan(0);
    });
  });

  it('POSITIVE_TRAIT_IDS and NEGATIVE_TRAIT_IDS partition TRAIT_IDS with no overlap and no gaps', () => {
    expect(new Set([...POSITIVE_TRAIT_IDS, ...NEGATIVE_TRAIT_IDS])).toEqual(new Set(TRAIT_IDS));
    const overlap = POSITIVE_TRAIT_IDS.filter((id) => NEGATIVE_TRAIT_IDS.includes(id));
    expect(overlap).toEqual([]);
  });

  it('every id in POSITIVE_TRAIT_IDS/NEGATIVE_TRAIT_IDS exists in TRAITS', () => {
    [...POSITIVE_TRAIT_IDS, ...NEGATIVE_TRAIT_IDS].forEach((id) => {
      expect(TRAITS).toHaveProperty(id);
    });
  });
});
