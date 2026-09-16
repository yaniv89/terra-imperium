import { describe, it, expect } from 'vitest';
import { DIFFICULTIES, applyDifficulty } from './difficulty';
import { createInitialState } from '../context/GameContext';

describe('applyDifficulty', () => {
  it('prince is fully symmetrical (a no-op)', () => {
    const state = createInitialState();
    const next = applyDifficulty(state, 'prince');
    expect(next.resources.gold).toBe(state.resources.gold);
    expect(next.difficultyMultiplier).toBe(1);
    Object.values(next.nations).forEach(n => {
      if (n.isPlayer) return;
      expect(n.militaryStrength).toBe(state.nations[n.id].militaryStrength);
    });
  });

  it('settler boosts player resources, shrinks AI military, and lowers aggression', () => {
    const state = createInitialState();
    const next = applyDifficulty(state, 'settler');
    expect(next.resources.gold).toBe(Math.round(state.resources.gold * 1.5));
    expect(next.difficultyMultiplier).toBeLessThan(1);
    const anyAi = Object.values(next.nations).find(n => !n.isPlayer);
    const beforeAi = state.nations[anyAi.id];
    expect(anyAi.militaryStrength).toBe(Math.round(beforeAi.militaryStrength * 0.75));
  });

  it('emperor boosts AI military and aggression without boosting player resources', () => {
    const state = createInitialState();
    const next = applyDifficulty(state, 'emperor');
    expect(next.resources.gold).toBe(state.resources.gold);
    expect(next.difficultyMultiplier).toBeGreaterThan(1);
    const anyAi = Object.values(next.nations).find(n => !n.isPlayer);
    const beforeAi = state.nations[anyAi.id];
    expect(anyAi.militaryStrength).toBeGreaterThan(beforeAi.militaryStrength);
  });

  it('falls back to prince for an unknown difficulty id rather than throwing', () => {
    const state = createInitialState();
    expect(() => applyDifficulty(state, 'nightmare')).not.toThrow();
    expect(applyDifficulty(state, 'nightmare').difficultyMultiplier).toBe(1);
  });

  it('does not mutate the input state', () => {
    const state = createInitialState();
    const snapshotGold = state.resources.gold;
    applyDifficulty(state, 'settler');
    expect(state.resources.gold).toBe(snapshotGold);
  });

  it('every difficulty has a unique id matching its key', () => {
    Object.entries(DIFFICULTIES).forEach(([key, d]) => {
      expect(d.id).toBe(key);
    });
  });

  it('has exactly five difficulty levels', () => {
    expect(Object.keys(DIFFICULTIES).length).toBe(5);
  });
});
