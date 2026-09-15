import { describe, it, expect } from 'vitest';
import { applyEventEffects } from './applyEventEffects';
import { createInitialState } from '../context/GameContext';
import { HISTORICAL_EVENTS } from '../data/events';
import { GameStatus } from '../data/types';

describe('applyEventEffects', () => {
  it('applies resource effects atomically in one state transition', () => {
    const state = createInitialState();
    const event = HISTORICAL_EVENTS.dreyfus_affair_1894; // +10 diplomacyPoints, single option
    const next = applyEventEffects(state, event, 0);
    expect(next.resources.diplomacyPoints).toBe(state.resources.diplomacyPoints + 10);
    expect(next.activeEventId).toBeNull();
    expect(next.firedEvents[event.id]).toBe(true);
  });

  it('sets gameStatus to VICTORY when the choice carries effects.victory (regression: was silently ignored)', () => {
    const state = createInitialState();
    const event = HISTORICAL_EVENTS.galactic_age_2150;
    const next = applyEventEffects(state, event, 0);
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
  });

  it('declares war on hamas for the October 7th event (regression: nation did not exist)', () => {
    const state = createInitialState();
    expect(state.nations.hamas).toBeDefined();
    const event = HISTORICAL_EVENTS.october_war_2023;
    const next = applyEventEffects(state, event, 0);
    expect(next.nations.hamas.isAtWar).toBe(true);
    expect(next.wars.some(w => w.enemy === 'hamas' && w.active)).toBe(true);
  });

  it('does not mutate the input state', () => {
    const state = createInitialState();
    const snapshotMoney = state.resources.money;
    applyEventEffects(state, HISTORICAL_EVENTS.dreyfus_affair_1894, 0);
    expect(state.resources.money).toBe(snapshotMoney);
    expect(state.activeEventId).toBeNull(); // unchanged - was already null
  });

  it('accumulates event defenseBonus so it can feed combat (regression: defenseBonus was declared and never applied)', () => {
    const state = createInitialState();
    const event = HISTORICAL_EVENTS.war_attrition_1969; // "Build Bar-Lev Line" option has defenseBonus: 0.2
    const optionIndex = event.options.findIndex(o => o.effects?.defenseBonus);
    expect(optionIndex).toBeGreaterThanOrEqual(0);
    const next = applyEventEffects(state, event, optionIndex);
    expect(next.eventDefenseBonus).toBeGreaterThan(0);
  });

  it('applies militaryBonus to militaryUnits.infantry (regression: still referenced the removed flat militaryPower field)', () => {
    const state = createInitialState();
    state.militaryUnits = { infantry: 500, armor: 100, air: 0 };
    const event = HISTORICAL_EVENTS.independence_1948; // "Rally the nation" -> militaryBonus: 5000
    const next = applyEventEffects(state, event, 0);
    expect(next.militaryUnits).toEqual({ infantry: 5500, armor: 100, air: 0 });
    expect(Number.isNaN(next.militaryUnits.infantry)).toBe(false);
  });

  describe('nationHostility (Phase 6: procedural events target a single nation)', () => {
    it('adjusts only the named nation\'s hostility, clamped to [0, 100]', () => {
      const state = createInitialState();
      state.nations.egypt = { ...state.nations.egypt, hostility: 50 };
      const event = { id: 'test_event', title: 'Test', options: [{ label: 'a', effects: { nationHostility: { egypt: 20 } } }] };
      const next = applyEventEffects(state, event, 0);
      expect(next.nations.egypt.hostility).toBe(70);
      expect(next.nations.syria.hostility).toBe(state.nations.syria.hostility); // untouched

      const capped = applyEventEffects({ ...state, nations: { ...state.nations, egypt: { ...state.nations.egypt, hostility: 95 } } }, event, 0);
      expect(capped.nations.egypt.hostility).toBe(100);
    });

    it('ignores an unknown nation id rather than throwing', () => {
      const state = createInitialState();
      const event = { id: 'test_event', title: 'Test', options: [{ label: 'a', effects: { nationHostility: { not_a_real_nation: 10 } } }] };
      expect(() => applyEventEffects(state, event, 0)).not.toThrow();
    });
  });

  it('clears activeProceduralEvent when resolving a procedural event (Phase 6)', () => {
    const state = { ...createInitialState(), activeEventId: null, activeProceduralEvent: { id: 'procedural_test_1', title: 'Test', options: [{ label: 'ok', effects: { money: 100 } }] } };
    const next = applyEventEffects(state, state.activeProceduralEvent, 0);
    expect(next.activeProceduralEvent).toBeNull();
    expect(next.resources.money).toBe(state.resources.money + 100);
  });

  describe('spawnFollowUp (Phase 10: event chains with memory)', () => {
    it('schedules a pendingEventChains entry at turnNumber + delayTurns', () => {
      const state = { ...createInitialState(), turnNumber: 40 };
      const event = { id: 'test_chain_source', title: 'Test', options: [{ label: 'a', effects: { spawnFollowUp: { id: 'refugee_startup_ipo', delayTurns: 6 } } }] };
      const next = applyEventEffects(state, event, 0);
      expect(next.pendingEventChains).toEqual([{ id: 'refugee_startup_ipo', dueTurn: 46 }]);
    });

    it('appends to any existing pendingEventChains rather than overwriting them', () => {
      const state = { ...createInitialState(), turnNumber: 10, pendingEventChains: [{ id: 'some_other_chain', dueTurn: 12 }] };
      const event = { id: 'test_chain_source', title: 'Test', options: [{ label: 'a', effects: { spawnFollowUp: { id: 'refugee_startup_ipo', delayTurns: 6 } } }] };
      const next = applyEventEffects(state, event, 0);
      expect(next.pendingEventChains).toEqual([
        { id: 'some_other_chain', dueTurn: 12 },
        { id: 'refugee_startup_ipo', dueTurn: 16 }
      ]);
    });

    it('leaves pendingEventChains untouched when the option has no spawnFollowUp', () => {
      const state = { ...createInitialState(), pendingEventChains: [{ id: 'x', dueTurn: 5 }] };
      const next = applyEventEffects(state, HISTORICAL_EVENTS.dreyfus_affair_1894, 0);
      expect(next.pendingEventChains).toEqual([{ id: 'x', dueTurn: 5 }]);
    });
  });
});
