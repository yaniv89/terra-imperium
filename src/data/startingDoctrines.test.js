import { describe, it, expect } from 'vitest';
import { STARTING_DOCTRINES, applyStartingDoctrine } from './startingDoctrines';
import { ACHIEVEMENTS } from './achievements';
import { createInitialState } from '../context/GameContext';

describe('applyStartingDoctrine', () => {
  it('leaves state untouched for "none" (no effects)', () => {
    const state = createInitialState();
    const next = applyStartingDoctrine(state, 'none');
    expect(next.resources).toEqual(state.resources);
    expect(next.undergroundStrength).toBe(state.undergroundStrength);
  });

  it('leaves state untouched for an unknown doctrine id rather than throwing', () => {
    const state = createInitialState();
    expect(() => applyStartingDoctrine(state, 'not_a_real_doctrine')).not.toThrow();
    expect(applyStartingDoctrine(state, 'not_a_real_doctrine')).toEqual(state);
  });

  it('applies economic_vanguard\'s flat money bonus additively on top of the default start', () => {
    const state = createInitialState();
    const next = applyStartingDoctrine(state, 'economic_vanguard');
    expect(next.resources.money).toBe(state.resources.money + 15000);
  });

  it('applies diplomatic_corps\' diplomacyPoints bonus', () => {
    const state = createInitialState();
    const next = applyStartingDoctrine(state, 'diplomatic_corps');
    expect(next.resources.diplomacyPoints).toBe(state.resources.diplomacyPoints + 15);
  });

  it('applies veteran_command\'s undergroundStrength bonus', () => {
    const state = createInitialState();
    const next = applyStartingDoctrine(state, 'veteran_command');
    expect(next.undergroundStrength).toBe(state.undergroundStrength + 300);
  });

  it('does not mutate the input state', () => {
    const state = createInitialState();
    const snapshotMoney = state.resources.money;
    applyStartingDoctrine(state, 'economic_vanguard');
    expect(state.resources.money).toBe(snapshotMoney);
  });

  it('every non-"none" doctrine requires a real, existing achievement id', () => {
    Object.values(STARTING_DOCTRINES).forEach(d => {
      if (d.id === 'none') {
        expect(d.requiresAchievement).toBeNull();
      } else {
        expect(ACHIEVEMENTS[d.requiresAchievement], `${d.id} references unknown achievement ${d.requiresAchievement}`).toBeDefined();
      }
    });
  });
});
