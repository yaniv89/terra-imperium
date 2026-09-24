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
  'national.milBonus': { scope: 'nation', unit: 'flat', label: 'Military Power' },
  // Plan §M5: Develop Province's own cost multiplier. Nothing sources this yet (M6/M8's building/
  // reform effect tables are the plan's named sources) other than the Administrator ruler trait
  // below, which is exactly the "first real consumer" this key was added for.
  'national.developmentCost': { scope: 'nation', unit: 'pct', label: 'Development Cost' },
  // Region-scoped (plan §M5's income formula: local.taxIncome/productionIncome/manpower feed a
  // region's own tax/production/manpower yield). M6's building tiers (src/data/buildings.js) are
  // the first real source for all of these.
  'local.taxIncome': { scope: 'region', unit: 'pct', label: 'Local Tax Income' },
  'local.productionIncome': { scope: 'region', unit: 'pct', label: 'Local Production Income' },
  'local.manpower': { scope: 'region', unit: 'pct', label: 'Local Manpower' },
  // Plan §M6: building-tier effects for the categories that don't feed the three income keys
  // above. techPoints/tradeIncome/supplyRange are flat; fortLevel and stabilityBonus follow their
  // national namesakes' own sign convention (stabilityBonus: positive reduces unrest).
  'local.techPoints': { scope: 'region', unit: 'flat', label: 'Local Tech Points' },
  'local.tradeIncome': { scope: 'region', unit: 'flat', label: 'Local Trade Income' },
  'local.supplyRange': { scope: 'region', unit: 'flat', label: 'Local Supply Range' },
  'local.fortLevel': { scope: 'region', unit: 'flat', label: 'Fort Level' },
  'local.stabilityBonus': { scope: 'region', unit: 'flat', label: 'Local Stability' },
  // Plan §M6.1: Develop Province's national.developmentCost sibling for buildings — sourced by the
  // Architect ruler trait (M3), which this milestone rewires from its old goldMult stand-in now
  // that the real hook exists.
  'national.buildingCost': { scope: 'nation', unit: 'pct', label: 'Building Cost' },
  // Plan §M7: research cost (power + techPoints) and stability cost (Increase Stability, M4)
  // multipliers, and the national counterparts of M6's local.supplyRange/attrition (a nation-wide
  // road/rail tech applies once to the empire-wide max, on top of whichever single region already
  // supplies the farthest — see resolveTurn.js's supply-attrition pass).
  'national.researchCost': { scope: 'nation', unit: 'pct', label: 'Research Cost' },
  'national.stabilityCost': { scope: 'nation', unit: 'pct', label: 'Stability Cost' },
  'national.supplyRange': { scope: 'nation', unit: 'flat', label: 'Supply Range' },
  'national.attrition': { scope: 'nation', unit: 'pct', label: 'Attrition' }
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
  milBonus: 'national.milBonus',
  developmentCost: 'national.developmentCost',
  buildingCost: 'national.buildingCost',
  researchCost: 'national.researchCost',
  stabilityCost: 'national.stabilityCost',
  supplyRange: 'national.supplyRange',
  attrition: 'national.attrition'
};
