import { describe, it, expect } from 'vitest';
import { VICTORY_CONDITIONS, checkVictoryConditions, applyVictory, DOMINATION_CAPITAL_SHARE } from './victoryConditions';
import { GameStatus } from './types';
import { END_YEAR } from './ages';
import { getNationCapital } from './regions';
import { peoplesWorld } from '../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 3 });
const FR = WORLD.playerNationId;

// One victory model (KD4): domination and the legacy ranking at the ending (resolveTurn.js), nothing else.
describe('the victory table', () => {
  it('holds domination and the legacy ranking only', () => {
    expect(Object.keys(VICTORY_CONDITIONS)).toEqual(['domination', 'finalScore']);
  });

  it('finalScore never fires on its own: the ending ranks it', () => {
    const state = peoplesWorld();
    expect(VICTORY_CONDITIONS.finalScore.check({ ...state, year: END_YEAR })).toBe(false);
  });
});

describe('domination (capitals held)', () => {
  it('is false at the start of a fresh game (owns no one else\'s capital)', () => {
    const state = peoplesWorld({ seed: 3 });
    expect(VICTORY_CONDITIONS.domination.check(state)).toBe(false);
  });

  it('is true once the player holds enough of the world\'s other capitals, a nation later eliminated still counting', () => {
    const state = peoplesWorld({ seed: 3 });
    const regions = { ...state.regions }; const nations = { ...state.nations };
    const otherNationIds = Object.keys(state.nations).filter(id => id !== FR);
    const needed = Math.ceil(otherNationIds.length * DOMINATION_CAPITAL_SHARE);
    let handedOver = 0;
    for (const nationId of otherNationIds) {
      const capitalId = getNationCapital(nationId);
      if (!capitalId) continue;
      regions[capitalId] = { ...regions[capitalId], owner: FR };
      if (handedOver % 2 === 0) nations[nationId] = { ...nations[nationId], isEliminated: true };
      handedOver += 1;
      if (handedOver >= needed) break;
    }
    expect(VICTORY_CONDITIONS.domination.check({ ...state, regions, nations })).toBe(true);
  });
});

describe('checkVictoryConditions', () => {
  it('returns null when nothing is satisfied', () => {
    expect(checkVictoryConditions(peoplesWorld())).toBeNull();
  });

  const dominating = () => {
    const state = peoplesWorld({ seed: 3 });
    const regions = { ...state.regions };
    const others = Object.keys(state.nations).filter(id => id !== FR);
    others.slice(0, Math.ceil(others.length * DOMINATION_CAPITAL_SHARE)).forEach((id) => { const c = getNationCapital(id); if (c) regions[c] = { ...regions[c], owner: FR }; });
    return { ...state, regions };
  };

  it('returns the id of a satisfied condition', () => {
    expect(checkVictoryConditions(dominating())).toBe('domination');
  });

  it('ignores the diplomatic streak an old save carries', () => {
    expect(checkVictoryConditions({ ...peoplesWorld(), diplomaticLeadershipStreak: 99 })).toBeNull();
  });

  // Plan §M18: "Continue playing after victory" — an ambition already recorded as achieved must
  // not immediately re-fire the next turn just because its threshold, naturally, is often still met.
  it('skips an ambition already recorded in state.victoriesAchieved', () => {
    const state = { ...dominating(), victoriesAchieved: ['domination'] };
    expect(checkVictoryConditions(state)).toBeNull();
  });

  it('never returns the END_YEAR calendar limit on its own — that is resolveTurn.js\'s own ranked step, not a `check` in this table', () => {
    expect(checkVictoryConditions({ ...peoplesWorld(), year: END_YEAR })).toBeNull();
  });
});

describe('applyVictory', () => {
  it('sets gameStatus to VICTORY and records which condition triggered it', () => {
    const state = peoplesWorld();
    const next = applyVictory(state, 'domination');
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('domination');
  });

  it('does not mutate the input state', () => {
    const state = peoplesWorld();
    applyVictory(state, 'domination');
    expect(state.gameStatus).toBe(GameStatus.ACTIVE);
  });
});
