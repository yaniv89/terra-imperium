// src/engine/modifiers/registry.js
// Plan §M1: the modifier engine's key catalogue. Today's five hooks (LEGACY_HOOK) are exactly the
// ones src/utils/helpers.js's getNationBonusTotal already summed across government/policy/wonder/
// identity — this file doesn't invent new mechanics, it names the ones that already exist so they
// can go through one engine with a real breakdown instead of a bare number. Later milestones (M2's
// power pools, M4's stability, M6's buildings, ...) each add their own keys here as they're built;
// nothing below is speculative ahead of a milestone that actually reads it.
export const MODIFIER_KEYS = {
  'national.goldMult': { scope: 'nation', unit: 'pct', label: 'Gold Income' },
  'national.hrMult': { scope: 'nation', unit: 'pct', label: 'Manpower Income' },
  'national.techPointsMult': { scope: 'nation', unit: 'pct', label: 'Tech Point Income' },
  'national.stabilityBonus': { scope: 'nation', unit: 'flat', label: 'Stability' },
  'national.popGrowthBonus': { scope: 'nation', unit: 'flat', label: 'Population Growth' },
  // apBonus (all three pools equally: government maturity, Governance techs) vs. admBonus/dipBonus/
  // milBonus (one pool each: plan §M3's ruler skill, advisors, and pool-specific traits) are kept
  // as separate keys rather than merged, so a source that's only ever meant to touch one pool can't
  // accidentally leak onto the other two.
  'national.apBonus': { scope: 'nation', unit: 'flat', label: 'All Power Pools' },
  'national.admBonus': { scope: 'nation', unit: 'flat', label: 'Administrative Power' },
  'national.dipBonus': { scope: 'nation', unit: 'flat', label: 'Diplomatic Power' },
  'national.milBonus': { scope: 'nation', unit: 'flat', label: 'Military Power' }
};

// Maps getNationBonusTotal's old hook-name argument to its modifier key here, so every existing
// data file (government.js, policies.js, wonders.js, identity.js, traits.js) keeps using the short
// hook names in its own `effect: { goldMult: 0.1 }` shape unchanged — only the summation point moves.
export const LEGACY_HOOK = {
  goldMult: 'national.goldMult',
  hrMult: 'national.hrMult',
  techPointsMult: 'national.techPointsMult',
  stabilityBonus: 'national.stabilityBonus',
  popGrowthBonus: 'national.popGrowthBonus',
  apBonus: 'national.apBonus',
  admBonus: 'national.admBonus',
  dipBonus: 'national.dipBonus',
  milBonus: 'national.milBonus'
};
