// src/utils/costs.js
// One cost helper (differentiation plan KTD2): a cost is resources (gold, hr, metals) taken from
// the payer's pool (state.resources for the player, nation.economy for an AI) plus `decrees` spent
// from the ruler's bank (nation.ruler.decrees, src/engine/decrees.js). Pure.
import { canAfford, applyCosts } from './helpers';
import { decreesOf, spendDecree } from '../engine/decrees';

const poolOf = (state, nationId) => (nationId === state.playerNationId ? state.resources : state.nations?.[nationId]?.economy) || {};

/** What `nationId` holds, decrees included: the pool with `decrees` from the ruler's bank (for shortfall lines). */
export const walletOf = (state, nationId = state.playerNationId) => ({ ...poolOf(state, nationId), decrees: decreesOf(state.nations?.[nationId]) });

/** Whether `nationId` can pay `cost` now (default payer: the player). */
export const canPay = (state, cost, nationId = state.playerNationId) => canAfford(walletOf(state, nationId), cost || {});

/** The next state with `cost` paid; `actId` (a DECREE_ACTS key) names the spend in the ruler's log.
 * Callers check canPay first. */
export const payCost = (state, cost, actId, nationId = state.playerNationId) => {
  const { decrees = 0, ...resources } = cost || {};
  const pool = applyCosts(poolOf(state, nationId), resources);
  const before = state.nations?.[nationId];
  const nation = decrees ? spendDecree(before, actId, state.turnNumber, decrees) : before;
  if (nationId === state.playerNationId) return { ...state, resources: pool, ...(nation !== before ? { nations: { ...state.nations, [nationId]: nation } } : {}) };
  return { ...state, nations: { ...state.nations, [nationId]: { ...nation, economy: pool } } };
};
