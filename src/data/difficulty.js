// src/data/difficulty.js
// Difficulty select (Phase 10) — a scenario-level choice at new-game time, separate from
// per-run starting doctrines (src/data/startingDoctrines.js). Applied once via applyDifficulty
// when a new game starts; the multiplier itself is threaded into aiLogic's per-nation rolls
// through state.difficultyMultiplier so it doesn't require touching every doctrine constant.

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: 'Easy',
    description: 'AI nations are less aggressive; you start with more resources.',
    aggressionMult: 0.7,
    startingResourceMult: 1.5
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    description: 'The standard experience.',
    aggressionMult: 1,
    startingResourceMult: 1
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    description: 'AI nations are more aggressive and grow faster; standard starting resources.',
    aggressionMult: 1.4,
    startingResourceMult: 1
  }
};

// Pure: applies a difficulty's starting-resource multiplier onto a freshly-created state and
// records the aggression multiplier for aiLogic.js to read every turn. Falls back to 'normal'
// (a no-op multiplier-wise) for an unknown id rather than throwing.
export const applyDifficulty = (state, difficultyId) => {
  const difficulty = DIFFICULTIES[difficultyId] || DIFFICULTIES.normal;
  return {
    ...state,
    resources: {
      ...state.resources,
      money: Math.round(state.resources.money * difficulty.startingResourceMult),
      manpower: Math.round(state.resources.manpower * difficulty.startingResourceMult)
    },
    difficultyMultiplier: difficulty.aggressionMult
  };
};
