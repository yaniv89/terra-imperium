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
});
