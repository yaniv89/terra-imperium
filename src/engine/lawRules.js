// src/engine/lawRules.js
// The real effects of laws and reforms on the tile world's systems (plans/civ-map-rework.md,
// C4.4). A law's `effects` are modifier lines (goldMult, stabilityBonus, ...); its `rules` are the
// hooks the newer systems read directly, summed over the nation's six laws and its active reforms:
//   loyaltyBonus        flat loyalty on every city (loyalty.js)
//   tolerance           no loyalty penalty for a foreign-culture city: the people term never falls
//                       below LOYALTY_NEUTRAL (loyalty.js)
//   unitUpkeepMult      the army's gold upkeep, +0.3 = 30% more (economy.js calcNationBalance)
//   warExhaustionMult   how fast war exhaustion rises, -0.2 = 20% slower (resolveTurn.js)
//   tradeGoldPerRoute   flat gold a turn per trade pact (utils/helpers.js calcIncome)
//   partnerOpinion      what every trade partner thinks of this nation for its trade law (opinion.js)
//   pillageGoldMult     gold from a raid on an enemy tile, +1 = double (threat.js pillageTile)
// Booleans combine with OR, numbers add. Memoised per nation record.
import { LAW_CATEGORIES, getLaw } from '../data/laws';
import { getActiveReforms } from '../data/government';

export const LAW_RULE_KEYS = ['loyaltyBonus', 'tolerance', 'unitUpkeepMult', 'warExhaustionMult', 'tradeGoldPerRoute', 'partnerOpinion', 'pillageGoldMult'];
export const EMPTY_RULES = Object.freeze({ loyaltyBonus: 0, tolerance: false, unitUpkeepMult: 0, warExhaustionMult: 0, tradeGoldPerRoute: 0, partnerOpinion: 0, pillageGoldMult: 0 });

const cache = new WeakMap();

const add = (into, rules) => {
  if (!rules) return;
  Object.entries(rules).forEach(([k, v]) => {
    if (typeof v === 'boolean') into[k] = !!into[k] || v;
    else into[k] = (into[k] || 0) + v;
  });
};

/** The summed rules of a nation's laws and reforms. */
export const lawRulesOf = (nation) => {
  if (!nation) return EMPTY_RULES;
  const hit = cache.get(nation);
  if (hit) return hit;
  const out = { ...EMPTY_RULES };
  Object.keys(LAW_CATEGORIES).forEach((category) => add(out, getLaw(category, nation.laws?.[category])?.rules));
  getActiveReforms(nation).forEach((reform) => add(out, reform.rules));
  cache.set(nation, out);
  return out;
};

/** One line per rule in force, for the laws card. */
export const describeRules = (rules) => {
  const out = [];
  if (rules.loyaltyBonus) out.push(`${rules.loyaltyBonus > 0 ? '+' : ''}${rules.loyaltyBonus} loyalty in every city`);
  if (rules.tolerance) out.push('no loyalty penalty for foreign-culture cities');
  if (rules.unitUpkeepMult) out.push(`army upkeep ${rules.unitUpkeepMult > 0 ? '+' : ''}${Math.round(rules.unitUpkeepMult * 100)}%`);
  if (rules.warExhaustionMult) out.push(`war exhaustion ${rules.warExhaustionMult > 0 ? '+' : ''}${Math.round(rules.warExhaustionMult * 100)}%`);
  if (rules.tradeGoldPerRoute) out.push(`${rules.tradeGoldPerRoute > 0 ? '+' : ''}${rules.tradeGoldPerRoute} gold per trade pact`);
  if (rules.partnerOpinion) out.push(`trade partners' opinion ${rules.partnerOpinion > 0 ? '+' : ''}${rules.partnerOpinion}`);
  if (rules.pillageGoldMult) out.push(`raids yield ${rules.pillageGoldMult > 0 ? '+' : ''}${Math.round(rules.pillageGoldMult * 100)}% gold`);
  return out;
};
