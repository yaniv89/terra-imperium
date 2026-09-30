// src/engine/buildingEffects.test.js
// "Do region buildings actually do anything?" — end to end, for every building line: build its
// first tier in a real province and check the number it promises really moves (income, manpower,
// research, defense in battle, unrest, population growth), not just that a modifier exists. The
// income lines must pay at least their flat yield even in a development-1 province, where a
// percentage alone used to round to nothing.
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { calcIncome } from '../utils/helpers';
import { getRegionModifier } from './modifiers/sheet';
import { getDefenseBattleContext } from './defense';
import { getNationCapital, REGIONS_DATA } from '../data/regions';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { HISTORICAL_EVENTS } from '../data/events';

const CAPITAL = getNationCapital('fr');
const base = () => {
  const s = createInitialState({ playerNationId: 'fr', rngSeed: 42 });
  return {
    ...s,
    firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {}),
    proceduralEventCooldown: 999999,
    battleSettings: { autoDefend: true }
  };
};
// The first tier of a line that has effects (a few lines start one age later).
const firstTierWithEffects = (categoryId) => Math.max(0, BUILDING_CATEGORIES[categoryId].tiers.findIndex((t) => t.effects));
const withBuilding = (state, categoryId, tier = firstTierWithEffects(categoryId), regionId = CAPITAL) => {
  const region = state.regions[regionId];
  return { ...state, regions: { ...state.regions, [regionId]: { ...region, buildings: { ...region.buildings, categories: { ...region.buildings.categories, [categoryId]: tier } } } } };
};

describe('region buildings have real effects', () => {
  it('Economy (Market…) raises gold income', () => {
    const s = base();
    expect(calcIncome(withBuilding(s, 'economy')).gold - calcIncome(s).gold).toBeGreaterThanOrEqual(3);
  });

  it('Industry (Workshop…) raises gold income', () => {
    const s = base();
    expect(calcIncome(withBuilding(s, 'industry')).gold - calcIncome(s).gold).toBeGreaterThanOrEqual(3);
  });

  it('Military (Barracks…) raises manpower', () => {
    const s = base();
    expect(calcIncome(withBuilding(s, 'military')).hr - calcIncome(s).hr).toBeGreaterThanOrEqual(3);
  });

  it('Science (Library…) produces research points', () => {
    const s = base();
    expect(calcIncome(withBuilding(s, 'science')).techPoints || 0).toBeGreaterThan(calcIncome(s).techPoints || 0);
  });

  it('Naval (Harbor…) adds trade income in a coastal province', () => {
    const s = base();
    const port = Object.keys(s.regions).find((id) => s.regions[id].owner === 'fr' && REGIONS_DATA[id]?.coastal !== false && getRegionModifier(withBuilding(s, 'naval', firstTierWithEffects('naval'), id), id, 'local.tradeIncome').total > 0);
    expect(calcIncome(withBuilding(s, 'naval', firstTierWithEffects('naval'), port)).gold).toBeGreaterThan(calcIncome(s).gold);
  });

  it('Defense (Palisade…) makes the province harder to take in battle', () => {
    const s = base();
    const def = { id: 'd', regionId: CAPITAL, aggressorId: 'de', warId: 'w', synthetic: [], attackerUnitIds: [], defenderUnitIds: [] };
    const open = getDefenseBattleContext(s, def);
    const walled = getDefenseBattleContext(withBuilding(s, 'defense'), def);
    expect(walled.fortLevel).toBeGreaterThan(open.fortLevel);
    expect(walled.defenderDamageReductionMultiplier).toBeLessThan(open.defenderDamageReductionMultiplier);
  });

  it('Culture (Shrine…) lowers unrest turn over turn', () => {
    const s0 = base();
    const s = { ...s0, regions: { ...s0.regions, [CAPITAL]: { ...s0.regions[CAPITAL], unrest: 40 } } };
    const plain = resolveTurn(s).regions[CAPITAL].unrest;
    const shrine = resolveTurn(withBuilding(s, 'culture')).regions[CAPITAL].unrest;
    expect(shrine).toBeLessThan(plain);
  });

  it('Food (Granary…) speeds up population growth', () => {
    const s = base();
    const plain = resolveTurn(s).regions[CAPITAL].currentPopulation;
    const granary = resolveTurn(withBuilding(s, 'food', 0)).regions[CAPITAL].currentPopulation;
    expect(granary).toBeGreaterThan(plain);
  });

  it('Logistics (Road Post…) extends supply range', () => {
    const s = base();
    expect(getRegionModifier(withBuilding(s, 'logistics'), CAPITAL, 'local.supplyRange').total).toBeGreaterThan(0);
  });
});
