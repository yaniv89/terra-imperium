// src/engine/world/lod.js
// Level of detail for the simulation itself (plans/math-ideas.md 10.2, plans/math/perf.md).
// Rendering draws far things coarsely; the turn does the same for AI nations far from the player
// and at peace. Their per-turn bookkeeping (income, power, supplies, upkeep, city loyalty) is
// settled every few turns instead of every turn, with every turn since the last settlement
// credited at once, so the totals match the per-turn path whenever the inputs hold steady.
//
// Who is near (period 1, every turn): the player, every AI nation at war, in a civil war, bordering
// the player or among the strongest militaries (aiLogic.js getNationTier's Tier 1). Others follow
// their AI think period (aiEconomy.js AI_THINK_PERIOD) capped at LOD_MAX_PERIOD, on the same hash
// offset, so a nation that thinks this turn always settles first and decides on a fresh pool.
//
// Deterministic: the schedule is a pure function of the nation id, its tier and the turn number;
// the catch-up count is stored on the nation (`lodSettledTurn`), so a tier change never loses or
// double-counts a turn. Cost: O(nations) a turn; independent of the number of cells.
import { AI_THINK_PERIOD } from '../aiEconomy';

export const LOD_MAX_PERIOD = 5;
/** Settlement period of a nation of this tier (1 = every turn). */
export const lodPeriod = (tier, nation) => {
  if (!nation || nation.isPlayer || nation.isAtWar || nation.civilWar?.active) return 1;
  return Math.min(LOD_MAX_PERIOD, AI_THINK_PERIOD[tier] || 1);
};
const hash = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
/** Does this nation settle on `turn`? Same offset as aiEconomy.js thinksThisTurn. */
export const settlesThisTurn = (nationId, period, turn) => period <= 1 || (turn + hash(nationId)) % period === 0;
/** How many turns a settlement on `turn` covers: every turn since the nation's last one (1 for a
 * nation that has never been sliced, so old saves and new nations start on the per-turn path). */
export const turnsToSettle = (nation, turn) => {
  const last = nation?.lodSettledTurn;
  if (last == null || last >= turn) return 1;
  return turn - last;
};
