import { describe, it, expect } from 'vitest';
import { canAfford, applyCosts, calcIncome, getPlayerControl, getCostString, formatNumber, formatMoney } from './helpers';
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
});

describe('getCostString', () => {
  it('formats known resource and meta-currency costs', () => {
    expect(getCostString({ gold: 1500, diplomacyPoints: 5, actionPoints: 2 })).toBe('1.5K Gold, 5 DP, 2 AP');
  });

  it('omits zero/falsy costs', () => {
    expect(getCostString({ gold: 0, hr: 10 })).toBe('10 HR');
  });
});
