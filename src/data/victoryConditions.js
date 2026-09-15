// src/data/victoryConditions.js
// Multiple win conditions (Phase 10). Previously there was exactly one way to win — survive to
// 2150 via the scripted galactic_age_2150 event — so every playthrough converged on the same
// long grind. Each condition here is a pure predicate over a resolved POST_STATE snapshot,
// checked every turn in resolveTurn.js; the first one satisfied ends the game and its id is
// recorded so GameOverModal can show which victory was actually achieved.

import { GameStatus } from './types';
import { INDEPENDENCE_WAR_ATTACKERS, HOSTILE_BLOCS } from './nations';
import { getNationCapital } from './regions';

const allHostileBlocMembers = () => Object.values(HOSTILE_BLOCS).flat();

export const VICTORY_CONDITIONS = {
  survival: {
    id: 'survival',
    name: 'Galactic Age',
    description: 'Lead Israel all the way to the year 2150.',
    check: (state) => state.year >= 2150
  },
  military_conquest: {
    id: 'military_conquest',
    name: 'Total Regional Victory',
    description: 'Hold the capitals of every nation that invaded you in the War of Independence.',
    check: (state) => INDEPENDENCE_WAR_ATTACKERS.every(nationId => {
      const capital = getNationCapital(nationId);
      return !capital || state.regions[capital]?.owner === 'player';
    })
  },
  economic_ascendancy: {
    id: 'economic_ascendancy',
    name: 'Economic Ascendancy',
    description: 'Build a $5M treasury and 2,000 banked Tech Points.',
    check: (state) => state.resources.money >= 5000000 && state.resources.techPoints >= 2000
  },
  diplomatic_hegemony: {
    id: 'diplomatic_hegemony',
    name: 'Diplomatic Hegemony',
    description: 'Hold a peace treaty or trade agreement with every historically hostile nation.',
    check: (state) => allHostileBlocMembers().every(nationId => {
      const nation = state.nations[nationId];
      return !nation || nation.hasPeaceTreaty || nation.hasTradeAgreement;
    })
  }
};

// Returns the id of the first satisfied victory condition, or null. Only meaningful once
// POST_STATE — none of these conditions are reachable (or checked) before independence.
export const checkVictoryConditions = (state) => {
  const satisfied = Object.values(VICTORY_CONDITIONS).find(condition => condition.check(state));
  return satisfied ? satisfied.id : null;
};

// Applies a victory: sets gameStatus and records which condition triggered it, for GameOverModal.
export const applyVictory = (state, conditionId) => ({
  ...state,
  gameStatus: GameStatus.VICTORY,
  victoryConditionId: conditionId
});
