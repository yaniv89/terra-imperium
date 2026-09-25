import { describe, it, expect } from 'vitest';
import { getNationSheet, getModifier, getRegionModifier, getNationBonusTotal, explainNationBonus } from './sheet';
import { createEmptyRegionBuildings } from '../../data/buildings';

const monarchyDespotic = { type: 'monarchy', reforms: { bronze: 'despotic_rule' } }; // milBonus 1, stabilityBonus -1
const merchantRepublic = { type: 'republic', reforms: { classical: 'merchant_republic' } }; // goldMult 0.25

describe('getNationBonusTotal / explainNationBonus (the legacy shim)', () => {
  it('sums government reforms + laws for one hook, matching the old getNationBonusTotal', () => {
    // Great Projects (plan §M10) replaced nation-scoped World Wonders with region-sited projects
    // this bare-nation shim can no longer read (their owner is derived from live region state) —
    // see sources.test.js's contextSources tests for that coverage instead.
    const nation = { government: monarchyDespotic, laws: { justice: 'rule_of_law' } }; // stabilityBonus: -1 (despotic) + 1 (rule_of_law) = 0
    expect(getNationBonusTotal(nation, 'stabilityBonus')).toBe(0);
  });

  it('explainNationBonus returns a breakdown whose lines sum to the same total', () => {
    const nation = { government: merchantRepublic, laws: { trade: 'mercantilism' } };
    const { total, breakdown } = explainNationBonus(nation, 'goldMult');
    expect(breakdown.reduce((sum, l) => sum + l.value, 0)).toBeCloseTo(total);
    expect(breakdown.map((l) => l.sourceType).sort()).toEqual(['government', 'law']);
  });

  it('is 0 for a hook nothing on the nation contributes to', () => {
    expect(getNationBonusTotal({ government: monarchyDespotic }, 'goldMult')).toBe(0);
  });
});

describe('getNationSheet / getModifier', () => {
  it('a breakdown\'s lines always sum to its own total', () => {
    const state = {
      playerNationId: 'fr',
      nations: { fr: { government: { type: 'monarchy', reforms: {} }, taxRate: 'high' } },
      satellites: {}
    };
    const { total, breakdown } = getModifier(state, 'fr', 'national.goldMult');
    expect(breakdown.reduce((sum, l) => sum + l.value, 0)).toBeCloseTo(total);
  });

  it('caches the sheet per (state, nationId): the same state object returns the same sheet instance data without recomputation drift', () => {
    const state = { playerNationId: 'fr', nations: { fr: { government: monarchyDespotic } }, satellites: {} };
    const a = getNationSheet(state, 'fr');
    const b = getNationSheet(state, 'fr');
    expect(a).toBe(b);
  });

  it('a different state object (even with identical content) gets its own sheet, not a stale cached one', () => {
    const nation = { government: monarchyDespotic };
    const stateA = { playerNationId: 'fr', nations: { fr: nation }, satellites: {} };
    const stateB = { playerNationId: 'fr', nations: { fr: { ...nation, government: { type: 'monarchy', reforms: {} } } }, satellites: {} };
    expect(getModifier(stateA, 'fr', 'national.stabilityBonus').total).toBe(-1); // despotic_rule
    expect(getModifier(stateB, 'fr', 'national.stabilityBonus').total).toBe(0); // no reform chosen yet
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

  it('includes a region\'s own building-tier lines (plan §M6), on top of any timed modifier', () => {
    const buildings = createEmptyRegionBuildings();
    buildings.categories.economy = 0; // Market: local.taxIncome 0.15
    const state = {
      regions: { 'fr-75': { buildings } },
      regionModifiers: { 'fr-75': [{ id: 'm1', sourceType: 'event', label: 'Siege', mods: { 'local.taxIncome': -0.2 } }] }
    };
    const { total, breakdown } = getRegionModifier(state, 'fr-75', 'local.taxIncome');
    expect(total).toBeCloseTo(-0.05); // 0.15 (Market) - 0.2 (siege)
    expect(breakdown).toContainEqual({ key: 'local.taxIncome', value: 0.15, sourceType: 'building', sourceId: 'economy_0', label: 'Market' });
  });

  it('caches building lines per region object reference, the same way staticSheet caches per nation', () => {
    const buildings = createEmptyRegionBuildings();
    buildings.categories.economy = 0;
    const region = { buildings };
    const stateA = { regions: { r1: region } };
    const stateB = { regions: { r1: region } }; // different state, same region reference
    expect(getRegionModifier(stateA, 'r1', 'local.taxIncome').total).toBe(getRegionModifier(stateB, 'r1', 'local.taxIncome').total);
  });
});
