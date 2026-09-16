import { describe, it, expect } from 'vitest';
import { VICTORY_CONDITIONS, checkVictoryConditions, applyVictory } from './victoryConditions';
import { createInitialState } from '../context/GameContext';
import { GameStatus } from './types';
import { END_YEAR } from './ages';

describe('survival', () => {
  it('is satisfied once the year reaches END_YEAR', () => {
    const state = createInitialState();
    expect(VICTORY_CONDITIONS.survival.check({ ...state, year: END_YEAR - 1 })).toBe(false);
    expect(VICTORY_CONDITIONS.survival.check({ ...state, year: END_YEAR })).toBe(true);
  });
});

describe('checkVictoryConditions', () => {
  it('returns null when nothing is satisfied', () => {
    expect(checkVictoryConditions(createInitialState())).toBeNull();
  });

  it('returns the id of a satisfied condition', () => {
    expect(checkVictoryConditions({ ...createInitialState(), year: END_YEAR })).toBe('survival');
  });
});

describe('applyVictory', () => {
  it('sets gameStatus to VICTORY and records which condition triggered it', () => {
    const state = createInitialState();
    const next = applyVictory(state, 'survival');
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('survival');
  });

  it('does not mutate the input state', () => {
    const state = createInitialState();
    applyVictory(state, 'survival');
    expect(state.gameStatus).toBe(GameStatus.ACTIVE);
  });
});
