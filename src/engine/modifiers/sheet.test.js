import { describe, it, expect } from 'vitest';
import { getNationSheet, getModifier, getRegionModifier, getNationBonusTotal, explainNationBonus } from './sheet';

describe('getNationBonusTotal / explainNationBonus (the legacy shim)', () => {
  it('sums government + policy + wonder + identity for one hook, matching the old getNationBonusTotal', () => {
    const nation = { government: 'monarchy', policies: ['civic_pride'], wonders: ['pyramids'], identity: { collectivism: 100 } };
    // stabilityBonus: monarchy 5 + civic_pride 6 + pyramids 8 + identity 10 = 29
    expect(getNationBonusTotal(nation, 'stabilityBonus')).toBe(29);
  });

  it('explainNationBonus returns a breakdown whose lines sum to the same total', () => {
    const nation = { government: 'republic', policies: ['merchant_charter'] };
    const { total, breakdown } = explainNationBonus(nation, 'goldMult');
    expect(breakdown.reduce((sum, l) => sum + l.value, 0)).toBeCloseTo(total);
    expect(breakdown.map((l) => l.sourceType).sort()).toEqual(['government', 'policy']);
  });

  it('is 0 for a hook nothing on the nation contributes to', () => {
    expect(getNationBonusTotal({ government: 'monarchy' }, 'goldMult')).toBe(0);
  });
});

describe('getNationSheet / getModifier', () => {
  it('a breakdown\'s lines always sum to its own total', () => {
    const state = {
      playerNationId: 'fr',
      nations: { fr: { government: 'empire', taxRate: 'high' } },
      satellites: {}
    };
    const { total, breakdown } = getModifier(state, 'fr', 'national.goldMult');
    expect(breakdown.reduce((sum, l) => sum + l.value, 0)).toBeCloseTo(total);
  });

  it('caches the sheet per (state, nationId): the same state object returns the same sheet instance data without recomputation drift', () => {
    const state = { playerNationId: 'fr', nations: { fr: { government: 'monarchy' } }, satellites: {} };
    const a = getNationSheet(state, 'fr');
    const b = getNationSheet(state, 'fr');
    expect(a).toBe(b);
  });

  it('a different state object (even with identical content) gets its own sheet, not a stale cached one', () => {
    const nation = { government: 'monarchy' };
    const stateA = { playerNationId: 'fr', nations: { fr: nation }, satellites: {} };
    const stateB = { playerNationId: 'fr', nations: { fr: { ...nation, government: 'empire' } }, satellites: {} };
    expect(getModifier(stateA, 'fr', 'national.stabilityBonus').total).toBe(5); // monarchy
    expect(getModifier(stateB, 'fr', 'national.stabilityBonus').total).toBe(0); // empire has no stabilityBonus
  });

  it('returns a zero total with an empty breakdown for an unknown nation id', () => {
    const state = { playerNationId: 'fr', nations: {}, satellites: {} };
    expect(getModifier(state, 'ghost', 'national.goldMult')).toEqual({ total: 0, breakdown: [] });
  });
});

describe('getRegionModifier', () => {
  it('returns an empty breakdown when the region has no timed modifiers', () => {
    expect(getRegionModifier({ regionModifiers: {} }, 'fr-75', 'local.taxIncome')).toEqual({ total: 0, breakdown: [] });
    expect(getRegionModifier({}, 'fr-75', 'local.taxIncome')).toEqual({ total: 0, breakdown: [] });
  });

  it('sums matching entries for a region, ignoring entries for other keys', () => {
    const state = {
      regionModifiers: {
        'fr-75': [
          { id: 'm1', sourceType: 'event', label: 'Siege', mods: { 'local.taxIncome': -0.2 } },
          { id: 'm2', sourceType: 'building', label: 'Market', mods: { 'local.tradeIncome': 0.1 } }
        ]
      }
    };
    expect(getRegionModifier(state, 'fr-75', 'local.taxIncome')).toEqual({
      total: -0.2,
      breakdown: [{ key: 'local.taxIncome', value: -0.2, sourceType: 'event', sourceId: 'm1', label: 'Siege' }]
    });
  });
});
