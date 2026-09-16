// src/data/difficulty.js
// Difficulty select (plan §8.6) — a scenario-level choice at new-game time. Scales yields and AI
// aggression, never the rules themselves (the AI always uses the same engine as the player — see
// aiLogic.js). Applied once via applyDifficulty when a new game starts; aiAggressionMult is
// threaded into state.difficultyMultiplier for aiLogic.js to read every turn.

export const DIFFICULTIES = {
  settler: {
    id: 'settler',
    name: 'Settler',
    description: 'AI nations are passive and rarely declare war. You start with +50% resources, AI with -25%.',
    playerYieldMult: 1.5,
    aiYieldMult: 0.75,
    aiAggressionMult: 0.5
  },
  chieftain: {
    id: 'chieftain',
    name: 'Chieftain',
    description: 'A cautious AI. You start with +20% resources.',
    playerYieldMult: 1.2,
    aiYieldMult: 1,
    aiAggressionMult: 0.8
  },
  prince: {
    id: 'prince',
    name: 'Prince',
    description: 'Fully symmetrical — the fair fight. No yield or aggression modifiers either way.',
    playerYieldMult: 1,
    aiYieldMult: 1,
    aiAggressionMult: 1
  },
  king: {
    id: 'king',
    name: 'King',
    description: 'AI nations get +25% resources and are more aggressive.',
    playerYieldMult: 1,
    aiYieldMult: 1.25,
    aiAggressionMult: 1.25
  },
  emperor: {
    id: 'emperor',
    name: 'Emperor',
    description: 'AI nations get +50% resources and are ruthless: optimal counter-building, coordinated wars.',
    playerYieldMult: 1,
    aiYieldMult: 1.5,
    aiAggressionMult: 1.5
  }
};

// Pure: applies a difficulty's yield multipliers onto a freshly-created state (the player's own
// resources, and every AI nation's starting military/resource proxy) and records the aggression
// multiplier for aiLogic.js to read every turn. Falls back to 'prince' (fully neutral) for an
// unknown id rather than throwing.
export const applyDifficulty = (state, difficultyId) => {
  const difficulty = DIFFICULTIES[difficultyId] || DIFFICULTIES.prince;

  const resources = {};
  Object.entries(state.resources).forEach(([id, amount]) => {
    resources[id] = Math.round(amount * difficulty.playerYieldMult);
  });

  const nations = {};
  Object.entries(state.nations).forEach(([id, nation]) => {
    nations[id] = nation.isPlayer
      ? nation
      : { ...nation, militaryStrength: Math.round(nation.militaryStrength * difficulty.aiYieldMult) };
  });

  return {
    ...state,
    resources,
    nations,
    difficultyId: difficulty.id,
    difficultyMultiplier: difficulty.aiAggressionMult
  };
};
