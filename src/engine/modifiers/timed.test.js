import { describe, it, expect, beforeEach } from 'vitest';
import {
  addNationModifier, addRegionModifier, expireNationModifiers, expireRegionModifiers,
  _resetModifierIdForTests
} from './timed';
import { staticSources } from './sources';
import { getRegionModifier } from './sheet';

beforeEach(() => _resetModifierIdForTests());

describe('addNationModifier', () => {
  it('appends a timed entry with an expiresTurn computed from duration', () => {
    const nation = { modifiers: [] };
    const next = addNationModifier(nation, { sourceType: 'event', sourceId: 'siege', label: 'Under Siege', mods: { 'national.stabilityBonus': -5 }, duration: 10, turnNumber: 50 });
    expect(next.modifiers).toEqual([{ id: 'mod_1', sourceType: 'event', sourceId: 'siege', label: 'Under Siege', mods: { 'national.stabilityBonus': -5 }, expiresTurn: 60 }]);
    expect(nation.modifiers).toEqual([]); // original untouched
  });

  it('an added nation modifier is picked up by staticSources immediately', () => {
    const nation = addNationModifier({ modifiers: [] }, { sourceType: 'event', sourceId: 'siege', label: 'Under Siege', mods: { 'national.stabilityBonus': -5 }, duration: 10, turnNumber: 50 });
    expect(staticSources(nation)).toContainEqual({ key: 'national.stabilityBonus', value: -5, sourceType: 'event', sourceId: 'siege', label: 'Under Siege' });
  });
});

describe('expireNationModifiers', () => {
  it('drops an entry once its expiresTurn is reached, keeps one still active', () => {
    const nations = {
      fr: { modifiers: [{ id: 'mod_1', mods: { 'national.goldMult': 0.1 }, expiresTurn: 60 }, { id: 'mod_2', mods: { 'national.goldMult': 0.2 }, expiresTurn: 100 }] }
    };
    const next = expireNationModifiers(nations, 60);
    expect(next.fr.modifiers).toEqual([{ id: 'mod_2', mods: { 'national.goldMult': 0.2 }, expiresTurn: 100 }]);
  });

  it('returns the exact same reference when nothing expires anywhere', () => {
    const nations = { fr: { modifiers: [] }, de: { modifiers: [{ id: 'mod_1', mods: {}, expiresTurn: 999 }] } };
    expect(expireNationModifiers(nations, 1)).toBe(nations);
  });
});

describe('addRegionModifier / getRegionModifier / expireRegionModifiers', () => {
  it('adds an entry into the sparse map for just that region', () => {
    const next = addRegionModifier({}, 'fr-75', { sourceType: 'building', sourceId: 'market', label: 'Market', mods: { 'local.tradeIncome': 0.15 }, duration: 5, turnNumber: 10 });
    expect(Object.keys(next)).toEqual(['fr-75']);
    expect(getRegionModifier({ regionModifiers: next }, 'fr-75', 'local.tradeIncome').total).toBe(0.15);
  });

  it('expireRegionModifiers removes an expired entry and deletes the region key once it\'s empty', () => {
    const regionModifiers = { 'fr-75': [{ id: 'mod_1', mods: { 'local.tradeIncome': 0.15 }, expiresTurn: 20 }] };
    const next = expireRegionModifiers(regionModifiers, 20);
    expect(next['fr-75']).toBeUndefined();
  });

  it('leaves a still-active region entry alone and returns the same reference when nothing expires', () => {
    const regionModifiers = { 'fr-75': [{ id: 'mod_1', mods: {}, expiresTurn: 999 }] };
    expect(expireRegionModifiers(regionModifiers, 1)).toBe(regionModifiers);
  });

  it('passes through null/undefined regionModifiers unchanged', () => {
    expect(expireRegionModifiers(undefined, 1)).toBeUndefined();
  });
});
