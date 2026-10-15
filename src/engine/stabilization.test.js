import { describe, it, expect } from 'vitest';
import { addCity } from './testWorld';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { applyPeace, getPeaceCost } from './peace';
import { processAllAINations, getSortedByMilitary, processAIRecruitment } from '../utils/aiLogic';
import { getNeighborIds } from '../data/regions';

describe('peace treasury integrity', () => {
  const setup = () => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    state.nations.de.economy.gold = 800;
    state.nations.it.economy.gold = 200;
    state.wars = [{ id: 'w', aggressor: 'fr', enemy: 'de', active: true, score: 100 }];
    return state;
  };
  it('transfers indemnities out of the AI treasury instead of creating money', () => {
    const state = setup();
    const result = applyPeace(state, state.wars[0], 'fr', [{ type: 'gold', amount: 300 }]);
    expect(result.resources.gold).toBe(state.resources.gold + 300);
    expect(result.nations.de.economy.gold).toBe(500);
    expect(state.nations.de.economy.gold).toBe(800);
  });
  it('transfers gold between two AI nations', () => {
    const state = setup();
    const result = applyPeace(state, { aggressor: 'it', enemy: 'de' }, 'it', [{ type: 'gold', amount: 300 }]);
    expect(result.nations.de.economy.gold).toBe(500);
    expect(result.nations.it.economy.gold).toBe(500);
    expect(result.resources).toBe(state.resources);
  });
  it.each([-100, Infinity, NaN, '300', 900])('rejects invalid or unfunded gold demand %s', (amount) => {
    const state = setup();
    const terms = [{ type: 'gold', amount }];
    expect(getPeaceCost(state, state.wars[0], 'fr', terms)).toBe(Infinity);
    const next = gameReducer(state, { type: ActionTypes.OFFER_PEACE, payload: { warId: 'w', terms } });
    expect(next.resources.gold).toBe(state.resources.gold);
    expect(next.wars[0].active).toBe(true);
  });
  it('rejects split demands that together exceed the treasury', () => {
    const state = setup();
    expect(getPeaceCost(state, state.wars[0], 'fr', [{ type: 'gold', amount: 500 }, { type: 'gold', amount: 500 }])).toBe(Infinity);
  });
  it('never creates gold when applying a stale offer after treasury loss', () => {
    const state = setup();
    const result = applyPeace(state, state.wars[0], 'fr', [{ type: 'gold', amount: 1000 }]);
    expect(result.resources.gold - state.resources.gold).toBe(800);
    expect(result.nations.de.economy.gold).toBe(0);
  });
});

describe('AI lifecycle and recruitment', () => {
  it('excludes eliminated nations from passive growth and military ranking', () => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    state.nations.de.isEliminated = true;
    expect(processAllAINations(state, state.year, { next: () => 0 }).nationUpdates.de).toBeUndefined();
    expect(getSortedByMilitary(state)).not.toContain('de');
  });
  it('never recruits into an occupied province even when it is the most populous', () => {
    const state = addCity(createInitialState({ playerNationId: 'fr', rngSeed: 7 }), 'de').state;
    const owned = Object.values(state.regions).filter(r => r.owner === 'de');
    const occupied = owned[0];
    occupied.currentPopulation = 1e12;
    occupied.occupiedBy = 'fr';
    state.nations = { de: { ...state.nations.de, economy: { gold: 1e6, hr: 1e6, mil: 999 } } };
    const result = processAIRecruitment(state, {}, state.nations, state.regions, ['de'], state.age, { next: () => 0 });
    expect(Object.values(result.units)).toHaveLength(1);
    expect(Object.values(result.units)[0].regionId).not.toBe(occupied.id);
  });
  it('reinforces a threatened border before a distant population center', () => {
    const state = addCity(createInitialState({ playerNationId: 'fr', rngSeed: 7 }), 'de').state;
    const owned = Object.values(state.regions).filter(r => r.owner === 'de');
    const front = owned.find(r => getNeighborIds(r.id).some(id => state.regions[id]?.owner === 'fr'));
    const interior = owned.find(r => !getNeighborIds(r.id).some(id => state.regions[id]?.owner === 'fr'));
    expect(front).toBeDefined();
    interior.currentPopulation = 1e12;
    state.wars = [{ id: 'w', aggressor: 'fr', enemy: 'de', active: true, goal: { type: 'capture_region', regionId: front.id } }];
    state.nations = { de: { ...state.nations.de, isAtWar: true, economy: { gold: 1e6, hr: 1e6, mil: 999 } } };
    const result = processAIRecruitment(state, {}, state.nations, state.regions, ['de'], state.age, { next: () => 0 });
    expect(Object.values(result.units)[0].regionId).toBe(front.id);
  });
});
