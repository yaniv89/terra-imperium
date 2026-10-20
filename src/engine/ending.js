// src/engine/ending.js
// The one ending signal (eight-ages plan KTD3, R9). A game ends when either comes first:
//   turnLimit   the turn reaches the speed's turn limit (ages.js GAME_SPEEDS[speed].turnLimit)
//   futureGoal  a nation has researched every tech of the final goal age (the Future, with both
//               robot techs, once that age exists; until then nothing fires it)
// It is the only owner of "is the game over by time or goal"; resolveTurn's ranked ending and the
// game-over screen read it. What the ending scores belongs to the sibling plan's legacy ranking.
import { AGES, speedTurnLimit } from '../data/ages';
import { getTechsForAge } from '../data/techTree';
import { getResearched } from './nationState';
import { isIndependentNation } from '../data/independents';

export const FINAL_GOAL_AGE_ID = 'future';

/** The techs of the final goal: every tech of that age (none while the age does not exist). */
export const finalGoalTechs = (ageId = FINAL_GOAL_AGE_ID) => (AGES[ageId] ? getTechsForAge(ageId).map((t) => t.id) : []);

/**
 * { reason: 'turnLimit' } | { reason: 'futureGoal', nationId } | null. The goal is checked before
 * the turn limit; among nations, by id, so the result is deterministic. `goalTechs` is for tests.
 */
export const endingSignal = (state, { goalTechs = finalGoalTechs() } = {}) => {
  if (goalTechs.length) {
    const ids = Object.keys(state.nations || {}).sort();
    for (const id of ids) {
      const n = state.nations[id];
      if (!n || n.isEliminated || isIndependentNation(n)) continue;
      const known = new Set(getResearched(state, id));
      if (goalTechs.every((t) => known.has(t))) return { reason: 'futureGoal', nationId: id };
    }
  }
  if ((state.turnNumber || 0) >= speedTurnLimit(state.gameSpeed)) return { reason: 'turnLimit' };
  return null;
};
