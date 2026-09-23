// src/data/policies.js
// Policy cards (plan §9, "policy slots") — a shared pool, not government-specific, slotted into
// however many a nation's government type allows (src/data/government.js). Every effect uses the
// same two hooks government bonuses do (goldMult/hrMult in calcIncome, stabilityBonus in
// nextUnrest), so stacking a government bonus with several policies is just summing the same two
// numbers rather than a bespoke interaction per pairing. (population.js's popGrowthBonus hook is
// currently only granted by a wonder, src/data/wonders.js's greatLibrary — policies.test.js holds
// every policy here to exactly one recognized effect, unlike wonders.)

export const POLICIES = {
  levy_system: { id: 'levy_system', name: 'Levy System', description: '+10% HR income', effect: { hrMult: 0.1 } },
  merchant_charter: { id: 'merchant_charter', name: 'Merchant Charter', description: '+10% Gold income', effect: { goldMult: 0.1 } },
  standing_army_policy: { id: 'standing_army_policy', name: 'Standing Army', description: '+8 Stability', effect: { stabilityBonus: 8 } },
  civic_pride: { id: 'civic_pride', name: 'Civic Pride', description: '+6 Stability', effect: { stabilityBonus: 6 } },
  trade_charters: { id: 'trade_charters', name: 'Trade Charters', description: '+15% Gold income', effect: { goldMult: 0.15 } },
  granary_reserves: { id: 'granary_reserves', name: 'Granary Reserves', description: '+15% HR income', effect: { hrMult: 0.15 } },
  frontier_militia: { id: 'frontier_militia', name: 'Frontier Militia', description: '+10% HR income', effect: { hrMult: 0.1 } },
  royal_bureaucracy: { id: 'royal_bureaucracy', name: 'Royal Bureaucracy', description: '+10 Stability', effect: { stabilityBonus: 10 } }
};

export const POLICY_IDS = Object.keys(POLICIES);

export const getPolicy = (id) => POLICIES[id] || null;
