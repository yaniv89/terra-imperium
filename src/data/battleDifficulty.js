// src/data/battleDifficulty.js
// The battle difficulty the player picks (lane battle-skill-8): the battle AI level of every battle they
// fight, an AI_DIFFICULTY key of src/battle/sim/tacticalAI.js. A save from before the setting keeps the
// battle AI its campaign difficulty gave it: Settler and Chieftain Easy, King and Emperor Hard, else Normal.
export const BATTLE_DIFFICULTIES = ['easy', 'normal', 'hard'];
const FROM_CAMPAIGN = { settler: 'easy', chieftain: 'easy', king: 'hard', emperor: 'hard' };
export const battleAiOf = (state) => (BATTLE_DIFFICULTIES.includes(state?.battleSettings?.difficulty)
  ? state.battleSettings.difficulty
  : FROM_CAMPAIGN[state?.difficultyId] || 'normal');
