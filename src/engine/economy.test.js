import { describe, it, expect } from 'vitest';
import { addCities } from './testWorld';
import { createEmptyRegionBuildings } from '../data/buildings';
import { ACTION_COSTS } from '../data/actionCosts';
import {
  clampMaintenance, hasBankingHouses, getLoanCapacity, getLoanInterestRate, getLoanSize,
  calcNationBalance, getRecruitUnitCost
} from './economy';
import { peoplesWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 1 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);

describe('clampMaintenance', () => {
  it('clamps to [50, 100]', () => {
    expect(clampMaintenance(30)).toBe(50);
    expect(clampMaintenance(150)).toBe(100);
    expect(clampMaintenance(75)).toBe(75);
  });
});

describe('hasBankingHouses', () => {
  it('is false for the player without the tech, and always false for a non-player nation', () => {
    const state = peoplesWorld();
    expect(hasBankingHouses(state, FR_ID)).toBe(false);
    expect(hasBankingHouses(state, DE_ID)).toBe(false);
  });

  it('is true once the player has researched it', () => {
    const state = peoplesWorld();
    const withTech = { ...state, techTree: { ...state.techTree, economy_banking_houses: { ...state.techTree.economy_banking_houses, researched: true } } };
    expect(hasBankingHouses(withTech, FR_ID)).toBe(true);
  });
});

describe('getLoanCapacity (plan: "requires Banking Houses; before that, actions just fail")', () => {
  it('is 0 without Banking Houses', () => {
    const state = peoplesWorld();
    expect(getLoanCapacity(state, FR_ID)).toBe(0);
  });

  it('is the base capacity + 1 with Banking Houses and no Bank buildings', () => {
    const state = peoplesWorld();
    const withTech = { ...state, techTree: { ...state.techTree, economy_banking_houses: { ...state.techTree.economy_banking_houses, researched: true } } };
    expect(getLoanCapacity(withTech, FR_ID)).toBe(3 + 1);
  });

  it('adds up to +3 more for Bank-tier-or-higher regions, capped at +3 total', () => {
    const state = addCities(peoplesWorld({ seed: 1 }), FR_ID, 4).state;
    const withTech = { ...state, techTree: { ...state.techTree, economy_banking_houses: { ...state.techTree.economy_banking_houses, researched: true } } };
    const regionIds = Object.keys(withTech.regions).filter((id) => withTech.regions[id].owner === FR_ID).slice(0, 5);
    expect(regionIds.length).toBeGreaterThanOrEqual(5);
    const regions = { ...withTech.regions };
    regionIds.forEach((id) => {
      const buildings = createEmptyRegionBuildings();
      buildings.categories.economy = 2; // Bank tier
      regions[id] = { ...regions[id], buildings };
    });
    expect(getLoanCapacity({ ...withTech, regions }, FR_ID)).toBe(3 + 1 + 3);
  });
});

describe('getLoanInterestRate', () => {
  it('is the base rate with no existing loans and no Banking Houses', () => {
    const state = { playerNationId: FR_ID, nations: { [FR_ID]: { loans: [] } } };
    expect(getLoanInterestRate(state, FR_ID)).toBeCloseTo(0.04);
  });

  it('rises with each existing loan', () => {
    const state = { playerNationId: FR_ID, nations: { [FR_ID]: { loans: [{ id: 'l1' }, { id: 'l2' }] } } };
    expect(getLoanInterestRate(state, FR_ID)).toBeCloseTo(0.06);
  });

  it('is discounted by Banking Houses', () => {
    const state = { playerNationId: FR_ID, techTree: { economy_banking_houses: { researched: true } }, nations: { [FR_ID]: { loans: [] } } };
    expect(getLoanInterestRate(state, FR_ID)).toBeCloseTo(0.03);
  });

  it('never drops below the minimum rate', () => {
    const state = { playerNationId: FR_ID, techTree: { economy_banking_houses: { researched: true } }, nations: { [FR_ID]: { loans: [] } } };
    expect(getLoanInterestRate(state, FR_ID)).toBeGreaterThanOrEqual(0.01);
  });
});

describe('getLoanSize', () => {
  it('is never below LOAN_MIN_SIZE', () => {
    const state = peoplesWorld();
    expect(getLoanSize(state, FR_ID)).toBeGreaterThanOrEqual(200);
  });

  it('scales with the nation\'s current net income (the plan\'s own 5x multiplier, proxying for its 5-turn average)', () => {
    const state = peoplesWorld();
    const { net } = calcNationBalance(state, FR_ID);
    expect(getLoanSize(state, FR_ID)).toBe(Math.max(200, Math.round(5 * Math.max(0, net))));
  });
});

describe('calcNationBalance', () => {
  it('computes a real income and upkeep ledger for an AI nation', () => {
    const state = peoplesWorld();
    const balance=calcNationBalance(state,DE_ID);expect(balance.income.gold).toBeGreaterThan(0);expect(Number.isFinite(balance.net)).toBe(true);
  });

  it('charges army/navy upkeep scaled independently by their own maintenance sliders', () => {
    const state = peoplesWorld();
    const capitalId = Object.keys(state.regions).find((id) => state.regions[id].owner === FR_ID);
    const units = {
      land1: { id: 'land1', ownerId: FR_ID, domain: 'land', regionId: capitalId },
      naval1: { id: 'naval1', ownerId: FR_ID, domain: 'naval', regionId: capitalId }
    };
    const full = { ...state, units, nations: { ...state.nations, [FR_ID]: { ...state.nations[FR_ID], armyMaintenance: 100, navyMaintenance: 100 } } };
    const half = { ...state, units, nations: { ...state.nations, [FR_ID]: { ...state.nations[FR_ID], armyMaintenance: 50, navyMaintenance: 50 } } };
    const fullBalance = calcNationBalance(full, FR_ID);
    const halfBalance = calcNationBalance(half, FR_ID);
    expect(fullBalance.expenses.armyUpkeep).toBe(5); // 1 unit x 5g x 100%
    expect(fullBalance.expenses.navyUpkeep).toBe(5);
    expect(halfBalance.expenses.armyUpkeep).toBeLessThan(fullBalance.expenses.armyUpkeep);
    expect(halfBalance.expenses.navyUpkeep).toBeLessThan(fullBalance.expenses.navyUpkeep);
  });

  it('charges fort upkeep from the Defense building line\'s own fortLevel', () => {
    const state = peoplesWorld();
    const capitalId = Object.keys(state.regions).find((id) => state.regions[id].owner === FR_ID);
    const buildings = createEmptyRegionBuildings();
    buildings.categories.defense = 1; // Palisade: local.fortLevel 1
    const regions = { ...state.regions, [capitalId]: { ...state.regions[capitalId], buildings } };
    expect(calcNationBalance({ ...state, regions, units: {} }, FR_ID).expenses.fortUpkeep).toBe(1);
  });

  it('charges advisor salaries', () => {
    const state = peoplesWorld();
    const nation = { ...state.nations[FR_ID], advisors: { adm: { id: 'a1', level: 2 } } };
    const result = calcNationBalance({ ...state, units: {}, nations: { ...state.nations, [FR_ID]: nation } }, FR_ID);
    expect(result.expenses.advisorSalaries).toBe(8); // 2g x level^2 = 2x4
  });

  it('charges loan interest from each loan\'s own frozen rate', () => {
    const state = peoplesWorld();
    const nation = { ...state.nations[FR_ID], loans: [{ id: 'l1', principal: 1000, interestRate: 0.04 }] };
    const result = calcNationBalance({ ...state, units: {}, nations: { ...state.nations, [FR_ID]: nation } }, FR_ID);
    expect(result.expenses.loanInterest).toBe(40);
  });

  it('net is income minus every expense summed', () => {
    const state = peoplesWorld();
    const { income, expenses, net } = calcNationBalance({ ...state, units: {} }, FR_ID);
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
