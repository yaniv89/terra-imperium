// src/data/victoryConditions.js
// One victory model (differentiation plan KD4, R10): domination is the one direct win, checked
// every turn in resolveTurn.js; otherwise the game ends on the one ending signal (src/engine/
// ending.js) and the legacy score (src/engine/legacy.js) ranks every major once. Each entry is
// kept for the game-over screen's `VICTORY_CONDITIONS[state.victoryConditionId]` lookup.

import { GameStatus } from './types';
import { getCapital, getNationCapital } from './regions';

// Domination: the capitals of DOMINATION_CAPITAL_SHARE of every other nation under the player's
// flag (their historic seat or wherever they moved it after losing it; a nation eliminated by
// elimination.js still counts), rewarding decapitating strikes on the seats of power.
export const DOMINATION_CAPITAL_SHARE = 0.25;

export const VICTORY_CONDITIONS = {
  domination: {
    id: 'domination',
    name: 'Domination Victory',
    description: `Hold the capital of at least ${Math.round(DOMINATION_CAPITAL_SHARE * 100)}% of the world's other nations.`,
    check: (state) => {
      const others = Object.values(state.nations).filter(n => !n.isPlayer);
      if (others.length === 0) return false;
      // Their historic capital or wherever they moved it after losing it — conquering the capital
      // relocates it (src/engine/conquest.js), and taking it should still count.
      const held = (id) => !!id && state.regions[id]?.owner === state.playerNationId;
      const capitalsHeld = others.filter(n => held(getCapital(state, n.id)) || held(state.scenario?.starts?.[n.id] || getNationCapital(n.id))).length;
      return capitalsHeld / others.length >= DOMINATION_CAPITAL_SHARE;
    }
  },
  // First in legacy at the ending: ranked in resolveTurn.js, never fired through this table.
  finalScore: {
    id: 'finalScore',
    name: 'Legacy Victory',
    description: 'Lead the world in legacy when the game ends.',
    check: () => false
  }
};

// Returns the id of the first satisfied condition, or null — one already recorded in
// `state.victoriesAchieved` ("Continue playing after victory") is skipped, so keeping on past a
// win doesn't re-fire the same game-over screen the very next turn.
export const checkVictoryConditions = (state) => {
  const alreadyAchieved = state.victoriesAchieved || [];
  const satisfied = Object.values(VICTORY_CONDITIONS).find(
    (condition) => !alreadyAchieved.includes(condition.id) && condition.check(state)
  );
  return satisfied ? satisfied.id : null;
};

// Applies a victory: sets gameStatus and records which condition triggered it, for a game-over screen.
export const applyVictory = (state, conditionId) => ({
  ...state,
  gameStatus: GameStatus.VICTORY,
  victoryConditionId: conditionId
});
