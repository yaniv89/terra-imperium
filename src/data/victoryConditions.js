// src/data/victoryConditions.js
// Multiple win conditions (plan §10.4: Domination / Space Ascendancy / Economic Hegemony /
// Diplomatic / Score). Each condition here is a pure predicate over a resolved state snapshot,
// checked every turn in resolveTurn.js; the first one satisfied ends the game and its id is
// recorded so a game-over screen can show which victory was actually achieved.
//
// Only `survival` (the Score fallback) exists for now — Domination needs region-share tracking,
// Economic Hegemony needs the new resource economy, and Space Ascendancy needs the space race
// mission ladder, none of which exist yet (later phases). Adding a condition here is additive and
// never requires touching resolveTurn.js, which just iterates this table.

import { GameStatus } from './types';
import { END_YEAR } from './ages';

export const VICTORY_CONDITIONS = {
  survival: {
    id: 'survival',
    name: 'Score Victory',
    description: `Lead your nation all the way to ${END_YEAR}.`,
    check: (state) => state.year >= END_YEAR
  }
};

// Returns the id of the first satisfied victory condition, or null.
export const checkVictoryConditions = (state) => {
  const satisfied = Object.values(VICTORY_CONDITIONS).find(condition => condition.check(state));
  return satisfied ? satisfied.id : null;
};

// Applies a victory: sets gameStatus and records which condition triggered it, for a game-over screen.
export const applyVictory = (state, conditionId) => ({
  ...state,
  gameStatus: GameStatus.VICTORY,
  victoryConditionId: conditionId
});
