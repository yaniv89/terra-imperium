// src/engine/tributePricing.js
// What tribute costs, in one place (playtest audits CB08: I101, I108). Every kind of tribute is
// priced on the PAYER's city income, never on its saved treasury and never as a flat few gold:
//
//   city income   what a nation's cities add to its treasury a turn: the tax and the production of
//                 every city it holds (the two city terms of the gold income: helpers.js calcIncome
//                 for the player, the same development for an AI). Occupied cities and outposts
//                 pay nothing.
//   a major's one-off demand   accords.js tributeQuote (a share of that income over one cooldown,
//                 by strength ratio).
//   a running tribute          to or from an independent (raids.js, indepPolicy.js): every turn
//                 TRIBUTE_INCOME_SHARE of the payer's city income, at least the old flat price
//                 (data/independents.js tributeGold: 2 + the age's rank). Fixed when the deal is
//                 struck, for its whole length.
//
// So "3 gold a turn and no raids" stays the price for a people of one or two towns and grows with
// the payer: an empire earning 150 a turn from its cities pays 9. Pure.
import { tributeGold } from '../data/independents';

// PROVISIONAL (the rule is fixed; the value waits for the tuning pass, conflicts trap T1).
export const TRIBUTE_INCOME_SHARE = 0.06;

const cityIncomeCache = new WeakMap(); // regions -> Map nationId -> gold a turn
/** The gold `nationId`'s cities add to its treasury a turn (see the header). One pass per regions map. */
export const cityIncomeOf = (state, nationId) => {
  const regions = state?.regions || {};
  let m = cityIncomeCache.get(regions);
  if (!m) {
    m = new Map();
    Object.values(regions).forEach((c) => {
      if (!c?.owner || c.occupiedBy || c.outpost) return;
      m.set(c.owner, (m.get(c.owner) || 0) + Math.max(0, c.dev?.tax || 0) + Math.max(0, c.dev?.production || 0));
    });
    cityIncomeCache.set(regions, m);
  }
  return m.get(nationId) || 0;
};

/** The gold a turn of a running tribute paid by `payerId` (to or from an independent). */
export const tributePerTurn = (state, payerId, ageId = state?.age) => Math.max(tributeGold(ageId), Math.round(cityIncomeOf(state, payerId) * TRIBUTE_INCOME_SHARE));
