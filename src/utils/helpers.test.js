import { describe, it, expect } from 'vitest';
import { canAfford, applyCosts, calcIncome, getPlayerControl, getCostString, formatNumber, formatMoney, getSupplyCapacity, getStability, nextUnrest, getNationBonusTotal } from './helpers';
import { createInitialState } from '../context/GameContext';

describe('canAfford / applyCosts', () => {
  it('rejects when any single resource is short', () => {
    const resources = { gold: 1000, actionPoints: 3 };
    expect(canAfford(resources, { gold: 500, actionPoints: 5 })).toBe(false);
    expect(canAfford(resources, { gold: 500, actionPoints: 2 })).toBe(true);
  });

  it('applyCosts never drives a resource negative', () => {
    const resources = { gold: 100 };
    const next = applyCosts(resources, { gold: 500 });
    expect(next.gold).toBe(0);
  });

  it('applyCosts does not mutate the input', () => {
    const resources = { gold: 1000 };
    applyCosts(resources, { gold: 500 });
    expect(resources.gold).toBe(1000);
  });
});

describe('formatNumber / formatMoney', () => {
  it('abbreviates large numbers', () => {
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(2500000)).toBe('2.5M');
    expect(formatNumber(500)).toBe('500');
  });

  it('formatMoney appends the gold suffix', () => {
    expect(formatMoney(1500)).toBe('1.5Kg');
  });
});

describe('getPlayerControl', () => {
  it('reads the player nation\'s own region control', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(getPlayerControl(state)).toBe(state.regions.fr.control);
  });
});

describe('calcIncome', () => {
  it('yields only gold and hr in the Bronze Age (copper/iron/oil not unlocked)', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const income = calcIncome(state);
    expect(income.gold).toBeGreaterThan(0);
    expect(income.hr).toBeGreaterThan(0);
    expect(income.copper).toBe(0);
    expect(income.iron).toBe(0);
    expect(income.oil).toBe(0);
  });

  it('scales with control% — a half-controlled region yields roughly half', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const fullControl = calcIncome(state);
    const halfControl = calcIncome({ ...state, regions: { ...state.regions, fr: { ...state.regions.fr, control: 50 } } });
    expect(halfControl.gold).toBeLessThan(fullControl.gold);
  });

  it('adds a flat gold bonus per active trade agreement', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const anyNationId = Object.keys(state.nations).find(id => id !== 'fr');
    const withTrade = calcIncome({
      ...state,
      nations: { ...state.nations, [anyNationId]: { ...state.nations[anyNationId], hasTradeAgreement: true } }
    });
    const without = calcIncome(state);
    expect(withTrade.gold).toBeGreaterThan(without.gold);
  });

  it('yields a deposit resource once its extraction building is developed', () => {
    // Chile has a copper deposit (src/data/deposits.js).
    const state = createInitialState({ playerNationId: 'cl' });
    const withoutMine = calcIncome(state);
    expect(withoutMine.copper).toBe(0);

    const withMine = calcIncome({
      ...state,
      regions: {
        ...state.regions,
        cl: { ...state.regions.cl, buildings: { ...state.regions.cl.buildings, extraction: { ...state.regions.cl.buildings.extraction, copper: true } } }
      }
    });
    expect(withMine.copper).toBeGreaterThan(0);
  });

  it('yields nothing from an extraction building in a region with no matching deposit', () => {
    // France has no copper deposit listed.
    const state = createInitialState({ playerNationId: 'fr' });
    const withMine = calcIncome({
      ...state,
      regions: {
        ...state.regions,
        fr: { ...state.regions.fr, buildings: { ...state.regions.fr.buildings, extraction: { ...state.regions.fr.buildings.extraction, copper: true } } }
      }
    });
    expect(withMine.copper).toBe(0);
  });

  it('scales gold and hr with population growth from Population Policy, but not deposit/extraction resources', () => {
    const state = createInitialState({ playerNationId: 'cl' }); // Chile has a copper deposit
    const base = calcIncome(state);
    const grown = calcIncome({
      ...state,
      regions: {
        ...state.regions,
        cl: {
          ...state.regions.cl,
          currentPopulation: Math.round(state.regions.cl.currentPopulation * 1.5),
          buildings: { ...state.regions.cl.buildings, extraction: { ...state.regions.cl.buildings.extraction, copper: true } }
        }
      }
    });
    expect(grown.gold).toBeGreaterThan(base.gold);
    expect(grown.hr).toBeGreaterThan(base.hr);
    const baseWithMine = calcIncome({
      ...state,
      regions: { ...state.regions, cl: { ...state.regions.cl, buildings: { ...state.regions.cl.buildings, extraction: { ...state.regions.cl.buildings.extraction, copper: true } } } }
    });
    expect(grown.copper).toBe(baseWithMine.copper); // extraction yield is deposit/building-driven, not population-driven
  });

  it('applies Set Tax Rate\'s goldMult on top of government/policy bonuses', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const normal = calcIncome(state);
    const highTax = calcIncome({ ...state, nations: { ...state.nations, fr: { ...state.nations.fr, taxRate: 'high' } } });
    const lowTax = calcIncome({ ...state, nations: { ...state.nations, fr: { ...state.nations.fr, taxRate: 'low' } } });
    expect(highTax.gold).toBeGreaterThan(normal.gold);
    expect(lowTax.gold).toBeLessThan(normal.gold);
  });

  it('applies an owned Navigation Satellite\'s goldMult and a Weather Satellite\'s hrMult', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const withoutSatellites = calcIncome(state);
    const withSatellites = calcIncome({
      ...state,
      satellites: {
        s1: { id: 's1', ownerId: 'fr', typeId: 'navigation' },
        s2: { id: 's2', ownerId: 'fr', typeId: 'weather' }
      }
    });
    expect(withSatellites.gold).toBeGreaterThan(withoutSatellites.gold);
    expect(withSatellites.hr).toBeGreaterThan(withoutSatellites.hr);
  });

  it('adds a Communications Satellite\'s flat diplomacyPoints/turn and a Spy Satellite\'s techPoints/turn', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const withSatellites = calcIncome({
      ...state,
      satellites: {
        s1: { id: 's1', ownerId: 'fr', typeId: 'communications' },
        s2: { id: 's2', ownerId: 'fr', typeId: 'spy' }
      }
    });
    expect(withSatellites.diplomacyPoints).toBeGreaterThan(0);
    expect(withSatellites.techPoints).toBeGreaterThan(0);
  });

  it('never counts a rival nation\'s satellites toward the player\'s own income', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const withoutSatellites = calcIncome(state);
    const withRivalSatellite = calcIncome({ ...state, satellites: { s1: { id: 's1', ownerId: 'de', typeId: 'navigation' } } });
    expect(withRivalSatellite.gold).toBe(withoutSatellites.gold);
  });

  it('degrades a satellite\'s bonus under high orbital debris', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const satellites = { s1: { id: 's1', ownerId: 'fr', typeId: 'navigation' } };
    const noDebris = calcIncome({ ...state, satellites, orbitalDebrisLevel: 0 });
    const highDebris = calcIncome({ ...state, satellites, orbitalDebrisLevel: 100 });
    expect(highDebris.gold).toBeLessThan(noDebris.gold);
  });
});

describe('getSupplyCapacity', () => {
  it('grows with infrastructure level', () => {
    expect(getSupplyCapacity(0)).toBe(1);
    expect(getSupplyCapacity(4)).toBeGreaterThan(getSupplyCapacity(0));
  });

  it('handles a missing/undefined level without throwing', () => {
    expect(() => getSupplyCapacity(undefined)).not.toThrow();
    expect(getSupplyCapacity(undefined)).toBe(1);
  });
});

describe('getStability / nextUnrest', () => {
  it('getStability is 100 minus unrest', () => {
    expect(getStability({ unrest: 30 })).toBe(70);
    expect(getStability({ unrest: 0 })).toBe(100);
    expect(getStability({})).toBe(100);
  });

  it('unrest rises when control is below the threshold', () => {
    const region = { control: 20, unrest: 10 };
    expect(nextUnrest(region)).toBeGreaterThan(region.unrest);
  });

  it('unrest falls when control is at or above the threshold', () => {
    const region = { control: 100, unrest: 10 };
    expect(nextUnrest(region)).toBeLessThan(region.unrest);
  });

  it('is clamped to [0, 100]', () => {
    expect(nextUnrest({ control: 100, unrest: 0 })).toBe(0);
    expect(nextUnrest({ control: 0, unrest: 100 })).toBe(100);
  });

  it('taxUnrestDelta (Set Tax Rate) adds on top of the control-based drift', () => {
    const stableRegion = { control: 100, unrest: 20 };
    const withoutTax = nextUnrest(stableRegion, 0, 0);
    const highTax = nextUnrest(stableRegion, 0, 2);
    const lowTax = nextUnrest(stableRegion, 0, -1);
    expect(highTax).toBeGreaterThan(withoutTax);
    expect(lowTax).toBeLessThan(withoutTax);
  });
});

describe('getNationBonusTotal', () => {
  it('sums a completed World Wonder\'s effect alongside government and policy bonuses', () => {
    const nation = { government: null, policies: [], wonders: ['grandBazaar'] }; // grandBazaar: goldMult 0.15
    expect(getNationBonusTotal(nation, 'goldMult')).toBeCloseTo(0.15);
  });

  it('sums multiple wonders on the same hook', () => {
    const nation = { wonders: ['royalObservatory', 'spaceProgram'] }; // stabilityBonus 5 + 8
    expect(getNationBonusTotal(nation, 'stabilityBonus')).toBe(13);
  });

  it('ignores an unbuilt/unknown wonder id gracefully', () => {
    const nation = { wonders: ['not_a_real_wonder'] };
    expect(getNationBonusTotal(nation, 'goldMult')).toBe(0);
  });
});

describe('getCostString', () => {
  it('formats known resource and meta-currency costs', () => {
    expect(getCostString({ gold: 1500, diplomacyPoints: 5, actionPoints: 2 })).toBe('1.5K Gold, 5 DP, 2 AP');
  });

  it('omits zero/falsy costs', () => {
    expect(getCostString({ gold: 0, hr: 10 })).toBe('10 HR');
  });
});
