import { describe, it, expect } from 'vitest';
import { STARTING_DOCTRINES, applyStartingDoctrine } from './startingDoctrines';
import { ACHIEVEMENTS } from './achievements';
import { createInitialState } from '../context/GameContext';

describe('applyStartingDoctrine', () => {
  it('leaves state untouched for "none" (no effects)', () => {
    const state = createInitialState();
    const next = applyStartingDoctrine(state, 'none');
    expect(next.resources).toEqual(state.resources);
  });

  it('leaves state untouched for an unknown doctrine id rather than throwing', () => {
    const state = createInitialState();
    expect(() => applyStartingDoctrine(state, 'not_a_real_doctrine')).not.toThrow();
    expect(applyStartingDoctrine(state, 'not_a_real_doctrine')).toEqual(state);
  });

  it('does not mutate the input state', () => {
    const state = createInitialState();
    const snapshotGold = state.resources.gold;
    applyStartingDoctrine(state, 'none');
    expect(state.resources.gold).toBe(snapshotGold);
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
