// src/engine/ending.js
// The one ending signal (eight-ages plan KTD3, R9). A game ends when either comes first:
//   turnLimit   the turn reaches the speed's turn limit (ages.js GAME_SPEEDS[speed].turnLimit)
//   futureGoal  a nation has researched every tech of the final goal age (the Future, with both
//               robot techs)
//   dominance   (the AoE and Civ report's rank 8, Civ VII 1.4.0) from DOMINANCE_STEPS' first share of
//               the turn limit, a major whose legacy score is at least the current multiple of the
//               second major's (the second counted as at least 1) for DOMINANCE_HOLD reference turns
//               (speedTurns at the leader's age). The multiple falls as the game goes on: 6x from 40%
//               of the turn limit, 4x from 55%, 3x from 70%, 2x from 80%, 1.5x from 90%. The streak
//               is state.dominance { nationId, since }, kept by resolveTurn (nextDominance); a game it
//               ends is ranked by legacy like any other (the leader is first by construction).
// It is the only owner of "is the game over by time or goal"; resolveTurn's ranked ending and the
// game-over screen read it. What the ending scores belongs to the sibling plan's legacy ranking.
import { speedTurnLimit, speedTurns } from '../data/ages';
import { TECH_TREE } from '../data/techTree';
import { getResearched, ageOf } from './nationState';
import { legacyScore } from './legacy';
import { isIndependentNation } from '../data/independents';

export const FINAL_GOAL_AGE_ID = 'future';

// [share of the turn limit in %, multiple x2] from the latest: doubled so every comparison is integer.
export const DOMINANCE_STEPS = [[90, 3], [80, 4], [70, 6], [55, 8], [40, 12]];
export const DOMINANCE_HOLD = 5; // reference turns

const isMajor = (n) => n && !n.isEliminated && !isIndependentNation(n);

/** The multiple (x2) a leader needs now, or null before the first step. */
export const dominanceMultipleX2 = (turn, limit) => DOMINANCE_STEPS.find(([pct]) => turn * 100 >= pct * limit)?.[1] ?? null;

/** The major dominating this turn, or null: { nationId, top, second, multX2 }. Legacy scores only (cheap). */
export const dominantNation = (state) => {
  const multX2 = dominanceMultipleX2(state.turnNumber || 0, speedTurnLimit(state.gameSpeed));
  if (!multX2) return null;
  const scores = Object.keys(state.nations || {}).sort().filter((id) => isMajor(state.nations[id]))
    .map((id) => [id, legacyScore(state, id).total]).sort((a, b) => b[1] - a[1]);
  if (scores.length < 2) return null;
  const [[nationId, top], [, second]] = scores;
  return top * 2 >= Math.max(1, second) * multX2 ? { nationId, top, second, multX2 } : null;
};

/** The streak resolveTurn keeps on the state: the same object while the same major dominates. */
export const nextDominance = (state) => {
  const d = dominantNation(state);
  if (!d) return null;
  return state.dominance?.nationId === d.nationId ? state.dominance : { nationId: d.nationId, since: state.turnNumber || 0 };
};

/** Turns a dominance streak must last for this leader (DOMINANCE_HOLD reference turns). */
export const dominanceHold = (state, nationId) => speedTurns(DOMINANCE_HOLD, state.gameSpeed, ageOf(state, nationId));

/** The techs of the final goal: every tech of that age, the robot techs too, not the repeatable Future Tech. */
export const finalGoalTechs = (ageId = FINAL_GOAL_AGE_ID) => Object.values(TECH_TREE).filter((t) => t.ageId === ageId && !t.repeatable).map((t) => t.id);

/**
 * { reason: 'turnLimit' } | { reason: 'futureGoal' | 'dominance', nationId } | null. The goal, then
 * dominance, are checked before the turn limit; among nations, by id, so the result is deterministic. `goalTechs` is for tests.
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
  const d = state.dominance;
  if (d && isMajor(state.nations?.[d.nationId]) && (state.turnNumber || 0) - d.since >= dominanceHold(state, d.nationId)) return { reason: 'dominance', nationId: d.nationId };
  if ((state.turnNumber || 0) >= speedTurnLimit(state.gameSpeed)) return { reason: 'turnLimit' };
  return null;
};
