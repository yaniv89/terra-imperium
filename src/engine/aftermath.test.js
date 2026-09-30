// src/engine/aftermath.test.js
import { describe, it, expect } from 'vitest';
import {
  MEN_PER_STRENGTH, drawPopulation, levyUnit, levyNewUnits, applyCasualtyScars, battleLossShare, devastateRegion,
  decayDevastation, devastationIncomeMult, devastationGrowthPenalty, applyBattleWarExhaustion, resolveCommanderCasualties,
  applyBattleAftermath, hashRoll, DEVASTATION_MAX
} from './aftermath';
import { REGIONS_DATA } from '../data/regions';
import { POPULATION_FLOOR_RATIO } from './population';
import { createInitialState } from '../context/GameContext';
import { calcIncome } from '../utils/helpers';

const someRegionId = Object.keys(REGIONS_DATA).find((id) => REGIONS_DATA[id].population > 200000);
const base = REGIONS_DATA[someRegionId].population;
const regions = () => ({ [someRegionId]: { id: someRegionId, currentPopulation: base } });

describe('levy and casualty scars', () => {
  it('a levy takes the unit\'s men from its home province', () => {
    const next = levyUnit(regions(), { id: 'u', regionId: someRegionId, homeRegionId: someRegionId, strength: 1000 });
    expect(next[someRegionId].currentPopulation).toBe(base - 1000 * MEN_PER_STRENGTH);
  });

  it('never drains a province below its population floor', () => {
    const next = drawPopulation(regions(), someRegionId, base * 10);
    expect(next[someRegionId].currentPopulation).toBe(Math.round(base * POPULATION_FLOOR_RATIO));
  });

  it('only units new this turn are levied; naval ones cost no land population', () => {
    const prev = { a: { id: 'a', regionId: someRegionId, strength: 1000 } };
    const next = { ...prev, b: { id: 'b', regionId: someRegionId, strength: 500 }, n: { id: 'n', regionId: someRegionId, strength: 1000, domain: 'naval' } };
    expect(levyNewUnits(regions(), prev, next)[someRegionId].currentPopulation).toBe(base - 500 * MEN_PER_STRENGTH);
  });

  it('battle losses are taken off the home province, not wherever the battle was', () => {
    const before = [{ id: 'u', regionId: 'somewhere-else', homeRegionId: someRegionId, strength: 1000 }];
    const after = [{ id: 'u', strength: 600 }];
    expect(applyCasualtyScars(regions(), before, after)[someRegionId].currentPopulation).toBe(base - 400 * MEN_PER_STRENGTH);
  });

  it('synthetic troops leave no scar', () => {
    const r = regions();
    expect(applyCasualtyScars(r, [{ id: 's', regionId: someRegionId, strength: 1000 }], [{ id: 's', strength: 0, synthetic: true }])).toBe(r);
  });
});

describe('devastation', () => {
  it('grows with how bloody the battle was, caps at 100 and fades each turn', () => {
    const light = devastateRegion(regions(), someRegionId, 0.05)[someRegionId].devastation;
    const heavy = devastateRegion(regions(), someRegionId, 0.8)[someRegionId].devastation;
    expect(heavy).toBeGreaterThan(light);
    let r = regions();
    for (let i = 0; i < 20; i++) r = devastateRegion(r, someRegionId, 1);
    expect(r[someRegionId].devastation).toBe(DEVASTATION_MAX);
    expect(decayDevastation(10)).toBeLessThan(10);
    expect(decayDevastation(1)).toBe(0);
  });

  it('cuts a province\'s income and growth, and the player\'s real income falls', () => {
    expect(devastationIncomeMult({ devastation: 0 })).toBe(1);
    expect(devastationIncomeMult({ devastation: 100 })).toBeCloseTo(0.5);
    expect(devastationGrowthPenalty({ devastation: 100 })).toBeGreaterThan(0);
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const own = Object.keys(state.regions).filter((id) => state.regions[id].owner === 'fr');
    const burned = { ...state, regions: { ...state.regions } };
    own.forEach((id) => { burned.regions[id] = { ...burned.regions[id], devastation: 100 }; });
    expect(calcIncome(burned).gold).toBeLessThan(calcIncome(state).gold * 0.75);
  });
});

describe('war exhaustion and commanders', () => {
  it('the loser takes a spike scaled by its losses, the winner a little', () => {
    const nations = { a: { warExhaustion: 10 }, b: { warExhaustion: 10 } };
    const out = applyBattleWarExhaustion(nations, 'a', 'b', 0.5);
    expect(out.b.warExhaustion).toBeGreaterThan(out.a.warExhaustion);
    expect(out.a.warExhaustion).toBe(11);
    expect(applyBattleWarExhaustion({ a: { warExhaustion: 99 } }, null, 'a', 1).a.warExhaustion).toBe(100);
  });

  it('a destroyed unit\'s commander either falls or escapes unassigned, deterministically', () => {
    const hired = { g1: { name: 'Hannibal', assignedUnitId: 'u1' } };
    const once = resolveCommanderCasualties(hired, [{ id: 'u1', commanderId: 'g1' }], 5);
    const twice = resolveCommanderCasualties(hired, [{ id: 'u1', commanderId: 'g1' }], 5);
    expect(once).toEqual(twice);
    if (once.fallen.length) expect(once.hiredCommanders.g1).toBeUndefined();
    else expect(once.hiredCommanders.g1.assignedUnitId).toBeNull();
    // across many battles roughly a quarter fall
    let fell = 0;
    for (let t = 0; t < 400; t++) fell += resolveCommanderCasualties(hired, [{ id: 'u1', commanderId: 'g1' }], t).fallen.length;
    expect(fell).toBeGreaterThan(60); expect(fell).toBeLessThan(140);
    expect(hashRoll('x')).toBe(hashRoll('x'));
  });

  it('applyBattleAftermath ties it together', () => {
    const state = { regions: regions(), nations: { a: { warExhaustion: 0 }, d: { warExhaustion: 0 } }, hiredCommanders: {}, turnNumber: 3, year: 100 };
    const out = applyBattleAftermath(state, {
      regionId: someRegionId,
      beforeA: [{ id: 'x', homeRegionId: someRegionId, strength: 1000 }], afterA: [{ id: 'x', strength: 900 }],
      beforeD: [{ id: 'y', strength: 1000, synthetic: true }], afterD: [{ id: 'y', strength: 300, synthetic: true }],
      attackerId: 'a', defenderId: 'd', outcome: 'attacker'
    });
    expect(out.regions[someRegionId].currentPopulation).toBe(base - 100 * MEN_PER_STRENGTH);
    expect(out.regions[someRegionId].devastation).toBeGreaterThan(0);
    expect(out.nations.d.warExhaustion).toBeGreaterThan(out.nations.a.warExhaustion);
    expect(battleLossShare([{ strength: 1000 }], [{ strength: 250 }])).toBeCloseTo(0.75);
  });
});
