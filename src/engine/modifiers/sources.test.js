import { describe, it, expect } from 'vitest';
import { staticSources, contextSources, regionSources } from './sources';
import { createInitialState } from '../../context/GameContext';
import { createEmptyRegionBuildings } from '../../data/buildings';

describe('staticSources', () => {
  it('emits one line per non-zero hook on the nation\'s government effect', () => {
    const lines = staticSources({ government: 'monarchy' });
    expect(lines).toEqual(expect.arrayContaining([
      { key: 'national.stabilityBonus', value: 5, sourceType: 'government', sourceId: 'monarchy', label: 'Monarchy' },
      { key: 'national.apBonus', value: 1, sourceType: 'government', sourceId: 'monarchy', label: 'Monarchy' }
    ]));
  });

  it('emits one line per adopted policy', () => {
    const lines = staticSources({ policies: ['levy_system', 'civic_pride'] });
    expect(lines).toEqual(expect.arrayContaining([
      { key: 'national.hrMult', value: 0.1, sourceType: 'policy', sourceId: 'levy_system', label: 'Levy System' },
      { key: 'national.stabilityBonus', value: 6, sourceType: 'policy', sourceId: 'civic_pride', label: 'Civic Pride' }
    ]));
  });

  it('emits one line per built wonder, including multi-hook wonders', () => {
    const lines = staticSources({ wonders: ['royalObservatory'] });
    expect(lines).toEqual(expect.arrayContaining([
      { key: 'national.goldMult', value: 0.1, sourceType: 'wonder', sourceId: 'royalObservatory', label: 'The Royal Observatory' },
      { key: 'national.stabilityBonus', value: 5, sourceType: 'wonder', sourceId: 'royalObservatory', label: 'The Royal Observatory' }
    ]));
  });

  it('emits an identity line for a hook the identity axes actually contribute to', () => {
    const lines = staticSources({ identity: { collectivism: 100 } });
    expect(lines).toContainEqual({ key: 'national.stabilityBonus', value: 10, sourceType: 'identity', sourceId: 'identity', label: 'National Identity' });
  });

  it('emits nothing for an empty/missing nation', () => {
    expect(staticSources(undefined)).toEqual([]);
    expect(staticSources({})).toEqual([]);
  });

  it('reads timed nation.modifiers[] entries', () => {
    const lines = staticSources({ modifiers: [{ id: 'm1', sourceType: 'event', label: 'Test Event', mods: { 'national.goldMult': 0.2 } }] });
    expect(lines).toContainEqual({ key: 'national.goldMult', value: 0.2, sourceType: 'event', sourceId: 'm1', label: 'Test Event' });
  });

  it('skips a hook with no LEGACY_HOOK mapping rather than throwing', () => {
    expect(() => staticSources({ policies: ['some_future_policy_with_unknown_hook'] })).not.toThrow();
  });
});

describe('contextSources', () => {
  it('includes a tax-rate goldMult line when the nation has a non-default tax rate', () => {
    const state = { nations: { fr: { taxRate: 'high' } } };
    const lines = contextSources(state, 'fr');
    expect(lines.some((l) => l.sourceType === 'tax' && l.key === 'national.goldMult')).toBe(true);
  });

  it('includes satellite lines only for the satellite\'s own owner', () => {
    const state = {
      nations: { fr: {}, de: {} },
      satellites: { s1: { id: 's1', ownerId: 'de', typeId: 'navigation' } }
    };
    expect(contextSources(state, 'de').some((l) => l.sourceType === 'satellite')).toBe(true);
    expect(contextSources(state, 'fr').some((l) => l.sourceType === 'satellite')).toBe(false);
  });

  it('includes a real per-tech effect line for the player\'s own researched techs, and only for the player (plan §M7)', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const withTech = {
      ...base,
      techTree: { ...base.techTree, governance_code_of_laws: { ...base.techTree.governance_code_of_laws, researched: true } }
    };
    expect(contextSources(withTech, 'fr')).toContainEqual({ key: 'national.admBonus', value: 1, sourceType: 'tech', sourceId: 'governance_code_of_laws', label: 'Code of Laws' });
    expect(contextSources(withTech, 'de').some((l) => l.sourceType === 'tech')).toBe(false);
  });

  it('emits nothing for a tech with no effects table entry (an unlock-only tech)', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const withTech = {
      ...base,
      techTree: { ...base.techTree, governance_civic_assemblies: { ...base.techTree.governance_civic_assemblies, researched: true } }
    };
    expect(contextSources(withTech, 'fr').some((l) => l.sourceType === 'tech')).toBe(false);
  });
});

describe('regionSources (plan §M6: building tiers)', () => {
  it('emits nothing for a region with no buildings at all', () => {
    expect(regionSources({ buildings: createEmptyRegionBuildings() })).toEqual([]);
  });

  it('emits a line per built category at its current tier\'s effect', () => {
    const buildings = createEmptyRegionBuildings();
    buildings.categories.economy = 0; // Market: local.taxIncome 0.15
    const lines = regionSources({ buildings });
    expect(lines).toContainEqual({ key: 'local.taxIncome', value: 0.15, sourceType: 'building', sourceId: 'economy_0', label: 'Market' });
  });

  it('uses the CURRENT tier\'s value only, not every tier up to it', () => {
    const buildings = createEmptyRegionBuildings();
    buildings.categories.military = 2; // Military Academy: local.manpower 0.50 (not Barracks' 0.20 or Drill Yard's 0.35)
    const lines = regionSources({ buildings });
    expect(lines.filter((l) => l.key === 'local.manpower')).toEqual([
      { key: 'local.manpower', value: 0.50, sourceType: 'building', sourceId: 'military_2', label: 'Military Academy' }
    ]);
  });

  it('emits nothing for a category left at -1 (unbuilt)', () => {
    const buildings = createEmptyRegionBuildings();
    const lines = regionSources({ buildings });
    expect(lines).toEqual([]);
  });

  it('is safe against a region with no buildings field at all', () => {
    expect(regionSources({})).toEqual([]);
    expect(regionSources(null)).toEqual([]);
  });
});
