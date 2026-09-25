import { describe, it, expect } from 'vitest';
import { createInitialState } from '../context/GameContext';
import { createEmptyRegionBuildings } from '../data/buildings';
import { ACTION_COSTS } from '../data/actionCosts';
import {
  clampMaintenance, hasBankingHouses, getLoanCapacity, getLoanInterestRate, getLoanSize,
  calcNationBalance, getRecruitUnitCost
} from './economy';

describe('clampMaintenance', () => {
  it('clamps to [50, 100]', () => {
    expect(clampMaintenance(30)).toBe(50);
    expect(clampMaintenance(150)).toBe(100);
    expect(clampMaintenance(75)).toBe(75);
  });
});

describe('hasBankingHouses', () => {
  it('is false for the player without the tech, and always false for a non-player nation', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(hasBankingHouses(state, 'fr')).toBe(false);
    expect(hasBankingHouses(state, 'de')).toBe(false);
  });

  it('is true once the player has researched it', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const withTech = { ...state, techTree: { ...state.techTree, economy_banking_houses: { ...state.techTree.economy_banking_houses, researched: true } } };
    expect(hasBankingHouses(withTech, 'fr')).toBe(true);
  });
});

describe('getLoanCapacity (plan: "requires Banking Houses; before that, actions just fail")', () => {
  it('is 0 without Banking Houses', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(getLoanCapacity(state, 'fr')).toBe(0);
  });

  it('is the base capacity + 1 with Banking Houses and no Bank buildings', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const withTech = { ...state, techTree: { ...state.techTree, economy_banking_houses: { ...state.techTree.economy_banking_houses, researched: true } } };
    expect(getLoanCapacity(withTech, 'fr')).toBe(3 + 1);
  });

  it('adds up to +3 more for Bank-tier-or-higher regions, capped at +3 total', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const withTech = { ...state, techTree: { ...state.techTree, economy_banking_houses: { ...state.techTree.economy_banking_houses, researched: true } } };
    const regionIds = Object.keys(withTech.regions).filter((id) => withTech.regions[id].owner === 'fr').slice(0, 5);
    expect(regionIds.length).toBeGreaterThanOrEqual(5);
    const regions = { ...withTech.regions };
    regionIds.forEach((id) => {
      const buildings = createEmptyRegionBuildings();
      buildings.categories.economy = 2; // Bank tier
      regions[id] = { ...regions[id], buildings };
    });
    expect(getLoanCapacity({ ...withTech, regions }, 'fr')).toBe(3 + 1 + 3);
  });
});

describe('getLoanInterestRate', () => {
  it('is the base rate with no existing loans and no Banking Houses', () => {
    const state = { playerNationId: 'fr', nations: { fr: { loans: [] } } };
    expect(getLoanInterestRate(state, 'fr')).toBeCloseTo(0.04);
  });

  it('rises with each existing loan', () => {
    const state = { playerNationId: 'fr', nations: { fr: { loans: [{ id: 'l1' }, { id: 'l2' }] } } };
    expect(getLoanInterestRate(state, 'fr')).toBeCloseTo(0.06);
  });

  it('is discounted by Banking Houses', () => {
    const state = { playerNationId: 'fr', techTree: { economy_banking_houses: { researched: true } }, nations: { fr: { loans: [] } } };
    expect(getLoanInterestRate(state, 'fr')).toBeCloseTo(0.03);
  });

  it('never drops below the minimum rate', () => {
    const state = { playerNationId: 'fr', techTree: { economy_banking_houses: { researched: true } }, nations: { fr: { loans: [] } } };
    expect(getLoanInterestRate(state, 'fr')).toBeGreaterThanOrEqual(0.01);
  });
});

describe('getLoanSize', () => {
  it('is never below LOAN_MIN_SIZE', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(getLoanSize(state, 'fr')).toBeGreaterThanOrEqual(200);
  });

  it('scales with the nation\'s current net income (the plan\'s own 5x multiplier, proxying for its 5-turn average)', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const { net } = calcNationBalance(state, 'fr');
    expect(getLoanSize(state, 'fr')).toBe(Math.max(200, Math.round(5 * Math.max(0, net))));
  });
});

describe('calcNationBalance', () => {
  it('returns zeros for a non-player nation (AI has no simulated gold economy)', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(calcNationBalance(state, 'de')).toEqual({ income: { gold: 0 }, expenses: {}, net: 0 });
  });

  it('charges army/navy upkeep scaled independently by their own maintenance sliders', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const capitalId = Object.keys(state.regions).find((id) => state.regions[id].owner === 'fr');
    const units = {
      land1: { id: 'land1', ownerId: 'fr', domain: 'land', regionId: capitalId },
      naval1: { id: 'naval1', ownerId: 'fr', domain: 'naval', regionId: capitalId }
    };
    const full = { ...state, units, nations: { ...state.nations, fr: { ...state.nations.fr, armyMaintenance: 100, navyMaintenance: 100 } } };
    const half = { ...state, units, nations: { ...state.nations, fr: { ...state.nations.fr, armyMaintenance: 50, navyMaintenance: 50 } } };
    const fullBalance = calcNationBalance(full, 'fr');
    const halfBalance = calcNationBalance(half, 'fr');
    expect(fullBalance.expenses.armyUpkeep).toBe(5); // 1 unit x 5g x 100%
    expect(fullBalance.expenses.navyUpkeep).toBe(5);
    expect(halfBalance.expenses.armyUpkeep).toBeLessThan(fullBalance.expenses.armyUpkeep);
    expect(halfBalance.expenses.navyUpkeep).toBeLessThan(fullBalance.expenses.navyUpkeep);
  });

  it('charges fort upkeep from the Defense building line\'s own fortLevel', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const capitalId = Object.keys(state.regions).find((id) => state.regions[id].owner === 'fr');
    const buildings = createEmptyRegionBuildings();
    buildings.categories.defense = 0; // Palisade: local.fortLevel 1
    const regions = { ...state.regions, [capitalId]: { ...state.regions[capitalId], buildings } };
    expect(calcNationBalance({ ...state, regions, units: {} }, 'fr').expenses.fortUpkeep).toBe(1);
  });

  it('charges advisor salaries', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const nation = { ...state.nations.fr, advisors: { adm: { id: 'a1', level: 2 } } };
    const result = calcNationBalance({ ...state, units: {}, nations: { ...state.nations, fr: nation } }, 'fr');
    expect(result.expenses.advisorSalaries).toBe(8); // 2g x level^2 = 2x4
  });

  it('charges loan interest from each loan\'s own frozen rate', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const nation = { ...state.nations.fr, loans: [{ id: 'l1', principal: 1000, interestRate: 0.04 }] };
    const result = calcNationBalance({ ...state, units: {}, nations: { ...state.nations, fr: nation } }, 'fr');
    expect(result.expenses.loanInterest).toBe(40);
  });

  it('net is income minus every expense summed', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const { income, expenses, net } = calcNationBalance({ ...state, units: {} }, 'fr');
    const totalExpenses = Object.values(expenses).reduce((sum, v) => sum + v, 0);
    expect(net).toBeCloseTo((income.gold || 0) - totalExpenses);
  });
});

describe('getRecruitUnitCost (plan §M11 resource sink)', () => {
  it('returns the flat cost unchanged for an age with no strategic-resource mapping', () => {
    expect(getRecruitUnitCost({ resources: {} }, 'unknown_age')).toEqual(ACTION_COSTS.recruitUnit);
  });

  it('adds the age\'s strategic resource cost when the player has enough', () => {
    const cost = getRecruitUnitCost({ resources: { copper: 10 } }, 'bronze');
    expect(cost.copper).toBe(5);
    expect(cost.gold).toBe(ACTION_COSTS.recruitUnit.gold);
  });

  it('charges a +50% gold penalty instead when the resource is short', () => {
    const cost = getRecruitUnitCost({ resources: { copper: 0 } }, 'bronze');
    expect(cost.copper).toBeUndefined();
    expect(cost.gold).toBe(Math.round(ACTION_COSTS.recruitUnit.gold * 1.5));
  });

  it('maps each age to its own strategic resource', () => {
    expect(getRecruitUnitCost({ resources: { iron: 100 } }, 'gunpowder').iron).toBe(8);
    expect(getRecruitUnitCost({ resources: { oil: 100 } }, 'modern').oil).toBe(10);
  });
});
