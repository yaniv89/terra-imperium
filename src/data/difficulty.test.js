import { describe, it, expect } from 'vitest';
import { DIFFICULTIES, applyDifficulty } from './difficulty';
import { createInitialState } from '../context/GameContext';

describe('applyDifficulty', () => {
  it('normal is a no-op multiplier-wise', () => {
    const state = createInitialState();
    const next = applyDifficulty(state, 'normal');
    expect(next.resources.money).toBe(state.resources.money);
    expect(next.resources.manpower).toBe(state.resources.manpower);
    expect(next.difficultyMultiplier).toBe(1);
  });

  it('easy boosts starting resources and lowers the aggression multiplier', () => {
    const state = createInitialState();
    const next = applyDifficulty(state, 'easy');
    expect(next.resources.money).toBe(Math.round(state.resources.money * 1.5));
    expect(next.resources.manpower).toBe(Math.round(state.resources.manpower * 1.5));
    expect(next.difficultyMultiplier).toBeLessThan(1);
  });

  it('hard raises the aggression multiplier without boosting resources', () => {
    const state = createInitialState();
    const next = applyDifficulty(state, 'hard');
    expect(next.resources.money).toBe(state.resources.money);
    expect(next.difficultyMultiplier).toBeGreaterThan(1);
  });

  it('falls back to normal for an unknown difficulty id rather than throwing', () => {
    const state = createInitialState();
    expect(() => applyDifficulty(state, 'nightmare')).not.toThrow();
    expect(applyDifficulty(state, 'nightmare').difficultyMultiplier).toBe(1);
  });

  it('does not mutate the input state', () => {
    const state = createInitialState();
    const snapshotMoney = state.resources.money;
    applyDifficulty(state, 'easy');
    expect(state.resources.money).toBe(snapshotMoney);
  });

  it('every difficulty has a unique id matching its key', () => {
    Object.entries(DIFFICULTIES).forEach(([key, d]) => {
      expect(d.id).toBe(key);
    });
  });
});
