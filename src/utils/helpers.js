// src/utils/helpers.js
// Generic utility functions shared across the engine and UI. Combat/unit-composition helpers
// tied to the old infantry/armor/air model were removed here — Phase C ("Military") replaces
// that with the unit-class/counter/morale system described in the plan, built fresh rather than
// adapted from this one.

import { RelationStatus } from '../data/types';
import { t as tNow, getLanguage } from '../i18n/core';
import { REGIONS_DATA, getCapital } from '../data/regions';
import { RESOURCE_IDS } from '../data/resources';
import { regionHasDeposit } from '../data/deposits';
import { getModifier, getRegionModifier } from '../engine/modifiers/sheet';
import { getPopFactor, seedDevelopment, getTotalDev } from '../engine/development';
import { devastationIncomeMult } from '../engine/aftermath';
import { lawRulesOf } from '../engine/lawRules';
import { BASE_TECHPOINTS_PER_TURN, SCIENCE_PER_DEV } from '../data/actionCosts';
// Re-exported so every existing `import { getNationBonusTotal } from '../utils/helpers'` site
// keeps working unchanged — the actual summation now lives in the modifier engine (plan §M1),
// which also exposes explainNationBonus for a future breakdown tooltip.
export { getNationBonusTotal, explainNationBonus } from '../engine/modifiers/sheet';

// ============ NUMBER FORMATTING ============

export const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}${getLanguage() === 'he' ? tNow('p1.num.m') : 'M'}`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}${getLanguage() === 'he' ? tNow('p1.num.k') : 'K'}`;
  return num.toString();
};

export const formatMoney = (num) => `${formatNumber(num)}g`;

// ============ COLOR HELPERS ============

export const getControlColor = (control) => {
  if (control >= 80) return '#22c55e'; // green-500
  if (control >= 60) return '#84cc16'; // lime-500
  if (control >= 40) return '#eab308'; // yellow-500
  if (control >= 20) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
};

export const getRelationColor = (status) => {
  const colors = {
    [RelationStatus.WAR]: '#ef4444',
    [RelationStatus.HOSTILE]: '#f97316',
    [RelationStatus.COLD_PEACE]: '#eab308',
    [RelationStatus.NEUTRAL]: '#94a3b8',
    [RelationStatus.FRIENDLY]: '#22c55e',
    [RelationStatus.ALLIED]: '#3b82f6'
  };
  return colors[status] || '#94a3b8';
};

export const getHostilityColor = (hostility) => {
  if (hostility >= 80) return '#ef4444';
  if (hostility >= 60) return '#f97316';
  if (hostility >= 40) return '#eab308';
  if (hostility >= 20) return '#84cc16';
  return '#22c55e';
};

// ============ GAME CALCULATIONS ============

// Below this control level in the player's own home region (its capital, now that a nation holds
// many provinces), emergency "comeback" actions unlock.
export const COMEBACK_THRESHOLD = 30;

export const getPlayerControl = (state) => state.regions[getCapital(state, state.playerNationId)]?.control ?? 0;

// Base per-turn yield of a developed extraction building (Copper Mine / Iron Foundry / Oil Well),
// before the same control%/infrastructure scaling every other resource gets.
export const EXTRACTION_BASE_YIELD = 20;

// Real fielded army strength for a nation — the sum of every unit it actually owns' `strength`
// (src/context/GameContext.jsx's flat state.units dict). This is what's shown to the player for any
// "my power vs. their power" comparison (ResourceBar, MilitaryPanel, DiplomacyPanel,
// RegionInfoModal) instead of nation.militaryStrength, which stays exactly what it always was
// internally — the AI's abstract, unbounded economy/readiness score that drives passive growth,
// threat-tiering (getSortedByMilitary) and the runaway-leader coalition check (findRunawayLeader,
// both aiLogic.js). That number was never meant to be player-facing: it grows every turn for every
// AI nation regardless of what's actually on the map, so showing it directly is exactly what let "my
// power" and "their power" read as wildly, nonsensically far apart even though neither side's real
// army was. A real fielded-strength comparison can't do that — it's bounded by what was actually
// recruited (and, for the player, by RECRUIT_UNIT/DISBAND_UNIT's own strength math).
// Plan §M16: memoized per `state.units` OBJECT REFERENCE the same way src/data/regions.js's own
// getOwnedRegionsIndex is — units are never mutated in place (src/engine/battle.js clones a unit
// before touching its strength, and every write path replaces the units map via spread), so a
// same-reference `units` really does mean the same per-nation totals. This was a real, measured
// cost once M16's getSortedByMilitary started calling getFieldedStrength (via
// getEffectiveMilitaryPower) from inside a .sort() comparator for all 240 AI nations every turn —
// O(n log n) comparator calls x a fresh O(units) scan each, the same class of perf trap
// nationalPower.js's own getOwnedRegionCount fix already called out.
// Same index also backs getUnitCount below (aiEconomy.js's per-nation unit upkeep needs a COUNT,
// not a strength sum) — one O(units) pass covers both rather than two separate scans.
const fieldedStrengthIndexCache = new WeakMap(); // units -> { [ownerId]: { strength, count } }
const getFieldedStrengthIndex = (units) => {
  let index = fieldedStrengthIndexCache.get(units);
  if (!index) {
    index = {};
    Object.values(units).forEach((u) => {
      const entry = index[u.ownerId] || { strength: 0, count: 0 };
      entry.strength += u.strength || 0;
      entry.count += 1;
      index[u.ownerId] = entry;
    });
    fieldedStrengthIndexCache.set(units, index);
  }
  return index;
};
export const getFieldedStrength = (state, nationId) => getFieldedStrengthIndex(state.units || {})[nationId]?.strength || 0;
export const getUnitCount = (state, nationId) => getFieldedStrengthIndex(state.units || {})[nationId]?.count || 0;

// Per-turn resource income for the player's nation: gold/hr from every owned region's gdp/
// population-derived base value, plus copper/iron/oil from any region that has both the deposit
// (src/data/deposits.js) and the matching extraction building actually built
// (src/data/buildings.js) — geography and construction gate strategic resources, not just age.
// Plan §M13: an occupied region gives its OWNER nothing and its OCCUPIER a lesser, tax-only share
// — occupation is a war-only revenue stream, not annexation. Player-only real computation (this
// file's own established pattern: AI has no simulated per-region economy until M16).
const OCCUPATION_TAX_SHARE = 0.25;

// `goldParts` (optional, an array): the gold's sources before the national multiplier are pushed
// to it as { kind: 'city' | 'occupied' | 'trade', id, gold } (the top bar's gold reasons, playtest
// issue 13). The result is the same with or without it.
export const calcIncome = (state, { goldParts = null } = {}) => {
  // Occupied-by-someone-else regions are excluded from the owner's own income below (`!r.occupiedBy`)
  // — see the OCCUPATION_TAX_SHARE block after this loop for what the OCCUPIER gets instead.
  const playerRegions = Object.values(state.regions).filter(r => r.owner === state.playerNationId && !r.occupiedBy);

  const income = {};
  RESOURCE_IDS.forEach(id => { income[id] = 0; });

  playerRegions.forEach(region => {
    const regData = REGIONS_DATA[region.id];
    if (!regData) return;
    const controlMult = region.control / 100;
    const infraMult = 1 + (region.currentInfrastructure || 0) * 0.1;
    // Province development (plan §M5): gold/hr now come from region.dev.tax/production/manpower —
    // the LIVE economic base — instead of REGIONS_DATA's static resources.gold/hr directly. The
    // clamped popFactor (development.js) replaces the old unclamped popGrowthMult specifically to
    // stop population and development from compounding without limit, per the plan's own concern.
    // `local.*` lines come from M6's building tiers (Economy/Industry/Military, src/data/
    // buildings.js), read generically through getRegionModifier.
    if (income.gold !== undefined && income.hr !== undefined) {
      const dev = region.dev || seedDevelopment(region.id);
      const popFactor = getPopFactor(region, regData) * devastationIncomeMult(region); // a battlefield earns less while it recovers
      const localTax = getRegionModifier(state, region.id, 'local.taxIncome').total;
      const localProduction = getRegionModifier(state, region.id, 'local.productionIncome').total;
      const localManpower = getRegionModifier(state, region.id, 'local.manpower').total;
      const taxIncome = dev.tax * (1 + localTax) * controlMult * infraMult * popFactor;
      const productionIncome = dev.production * (1 + localProduction) * controlMult * infraMult * popFactor;
      const manpowerIncome = dev.manpower * (1 + localManpower) * controlMult * infraMult * popFactor;
      const cityGold = taxIncome + productionIncome + getRegionModifier(state, region.id, 'local.flatGold').total * controlMult;
      income.gold += cityGold;
      income.hr += manpowerIncome + getRegionModifier(state, region.id, 'local.flatManpower').total * controlMult;
      // Naval building line (plan §M6): a flat trade-income trickle per tier, coastal-only by
      // construction (BUILDING_CATEGORIES.naval.coastalOnly gates the building itself).
      const harbourGold = getRegionModifier(state, region.id, 'local.tradeIncome').total * controlMult;
      income.gold += harbourGold;
      goldParts?.push({ kind: 'city', id: region.id, gold: cityGold + harbourGold });
    }

    Object.entries(region.buildings?.extraction || {}).forEach(([resId, built]) => {
      if (!built || income[resId] === undefined) return;
      if (!regionHasDeposit(regData, resId)) return; // building without a deposit produces nothing — deposits are geological, keyed by the province's home country
      income[resId] += EXTRACTION_BASE_YIELD * controlMult * infraMult;
    });

    // Tech points (Research tab): the Science building line's own authored per-tier values (plan
    // §M6: Library +2, Scriptorium +4, University +6, Research Lab +9 — src/data/buildings.js),
    // replacing the old uniform (tier+1)*SCIENCE_TECHPOINT_YIELD formula. techPoints isn't in
    // RESOURCE_IDS (it's a meta-currency, like the power pools), but resolveTurn.js applies every
    // key calcIncome returns generically, so adding it here is enough to make it flow each turn.
    const localTechPoints = getRegionModifier(state, region.id, 'local.techPoints').total;
    if (localTechPoints) {
      income.techPoints = (income.techPoints || 0) + localTechPoints * controlMult * infraMult;
    }
    // Science from development (src/engine/research.js): a share of the province's development,
    // plus the city's own science (size and Science buildings, src/engine/world/cities.js).
    income.techPoints = (income.techPoints || 0) + SCIENCE_PER_DEV * getTotalDev({ dev: region.dev || seedDevelopment(region.id) }) * controlMult
      + (region.lastYields?.science || 0) * controlMult;
  });

  // Occupation (plan §M13): the occupier gets a lesser tax-only share of what it holds, rather than
  // full income — a real but reduced war-time revenue stream, distinct from a region it actually
  // owns. Read before the goldMult multiplication below so it benefits from national bonuses the
  // same way owned income does.
  Object.values(state.regions).forEach((region) => {
    if (region.occupiedBy !== state.playerNationId || region.owner === state.playerNationId) return;
    const regData = REGIONS_DATA[region.id];
    if (!regData) return;
    const dev = region.dev || seedDevelopment(region.id);
    const controlMult = region.control / 100;
    const infraMult = 1 + (region.currentInfrastructure || 0) * 0.1;
    const popFactor = getPopFactor(region, regData);
    const localTax = getRegionModifier(state, region.id, 'local.taxIncome').total;
    const taxIncome = dev.tax * (1 + localTax) * controlMult * infraMult * popFactor;
    income.gold = (income.gold || 0) + taxIncome * OCCUPATION_TAX_SHARE;
    goldParts?.push({ kind: 'occupied', id: region.id, gold: taxIncome * OCCUPATION_TAX_SHARE });
  });

  // Trade Pact income (plan §M12: "+5% x pact count", replacing the old flat +20 gold/partner) is
  // now a real goldMult line in the modifier engine (sources.js's contextSources), summed into the
  // same goldMult lookup a few lines below rather than added here as a flat bonus. Mercantilism and
  // the Merchant Republic add flat gold per pact on top (lawRules.js tradeGoldPerRoute).
  const perRoute = lawRulesOf(state.nations?.[state.playerNationId]).tradeGoldPerRoute || 0;
  if (perRoute) {
    const tradeGold = perRoute * Object.values(state.nations || {}).filter((n) => !n.isPlayer && n.hasTradeAgreement && !n.isEliminated).length;
    income.gold = (income.gold || 0) + tradeGold;
    goldParts?.push({ kind: 'trade', id: 'trade', gold: tradeGold });
  }

  // Government/policy/wonder bonuses (plan §9/§10.4) — summed on the same hook
  // (the modifier engine, src/engine/modifiers/), applied as one multiplier — government, policy,
  // wonder, identity and Set Tax Rate are all sources feeding these same two keys now, so this is one lookup each instead
  // of hand-summing every source at every call site.
  const goldMult = 1 + getModifier(state, state.playerNationId, 'national.goldMult').total;
  const hrMult = 1 + getModifier(state, state.playerNationId, 'national.hrMult').total;
  income.gold = (income.gold || 0) * goldMult;
  income.hr = (income.hr || 0) * hrMult;
  // Research Focus doesn't change science income here: science spent on a tech of the focused line
  // counts FOCUS_SCIENCE_BONUS more (src/engine/research.js).
  // A flat base trickle for every nation that still holds territory (BASE_TECHPOINTS_PER_TURN's own
  // header comment) — added before the Scholar/techPointsMult bonus below so that bonus applies to it.
  if (playerRegions.length > 0) income.techPoints = (income.techPoints || 0) + BASE_TECHPOINTS_PER_TURN;
  // A ruler's Scholar trait (plan §M3) and other techPointsMult sources scale whatever techPoints
  // income exists, base trickle included.
  const techPointsMult = getModifier(state, state.playerNationId, 'national.techPointsMult').total;
  if (techPointsMult && income.techPoints) income.techPoints *= (1 + techPointsMult);

  Object.keys(income).forEach(id => { income[id] = Math.round(income[id]); });
  return income;
};

// Infrastructure -> supply capacity (plan §5/§9): how far an army can operate from this region
// before it starts bleeding strength, in adjacency hops. Consumed by Phase C's combat/attrition
// system once armies exist; exposed now so Build Infrastructure is already strategically
// load-bearing rather than a pure economy button.
export const getSupplyCapacity = (infrastructureLevel) => 1 + Math.floor((infrastructureLevel || 0) / 2);

// Stability is just unrest inverted for display — one stored field (region.unrest), not two
// numbers that could drift out of sync with each other.
export const getStability = (region) => 100 - (region?.unrest || 0);

const UNREST_RISE_PER_TURN = 3;
const UNREST_FALL_PER_TURN = 1;
// Below this control%, a region's own populace resists it — matches the plan's "low stability
// spawns rebel armies" framing conceptually, though the rebel-army consequence itself is Phase C
// work (it needs the unit/combat system this drift doesn't depend on).
const UNREST_CONTROL_THRESHOLD = 50;

// One turn's unrest drift for a single region — rises under low control, settles otherwise.
// `stabilityBonus` (a region's owner's government + policy total, getNationBonusTotal) shaves
// straight off the delta, so a government reform is felt immediately rather than only on the next
// threshold crossing. `taxUnrestDelta` (Set Tax Rate's own per-turn unrest change, TAX_RATES) adds
// on top — High Taxes' unrest cost applies even to a region that's otherwise perfectly stable,
// same as stabilityBonus can pull a region below the threshold's own drift. Exported standalone
// (not just inlined in resolveTurn) so the threshold/rate constants above are unit-testable
// without needing a full turn resolution.
export const nextUnrest = (region, stabilityBonus = 0, taxUnrestDelta = 0) => {
  const delta = (region.control || 0) < UNREST_CONTROL_THRESHOLD ? UNREST_RISE_PER_TURN : -UNREST_FALL_PER_TURN;
  return Math.max(0, Math.min(100, (region.unrest || 0) + delta - stabilityBonus + taxUnrestDelta));
};

// ============ REGION HELPERS ============

export const getRegionOwnerName = (region, nations) => {
  if (!region) return 'Unknown';
  const nation = nations[region.owner];
  return nation?.name || 'Unknown';
};

export const isRegionPlayerOwned = (regionId, regions, playerNationId) => {
  const region = regions[regionId];
  return !!region && region.owner === playerNationId;
};

export const getPlayerRegions = (regions, playerNationId) => {
  return Object.values(regions).filter(r => r.owner === playerNationId);
};

export const getRegionsByOwner = (regions, ownerId) => {
  return Object.values(regions).filter(r => r.owner === ownerId);
};

// ============ INVASION / WAR HELPERS ============

export const hasActiveInvasion = (regionId, invasions) => {
  return invasions.some(inv => inv.targetRegion === regionId && inv.active);
};

export const getInvasionForRegion = (regionId, invasions) => {
  return invasions.find(inv => inv.targetRegion === regionId && inv.active);
};

export const getActiveWars = (wars) => {
  return wars.filter(w => w.active);
};

// ============ VALIDATION HELPERS ============

export const canAfford = (resources, costs) => {
  return Object.entries(costs).every(([key, value]) => {
    return (resources[key] || 0) >= value;
  });
};

// Deducts costs from resources, returning a new resources object. Never used without a prior
// canAfford() check by callers in this codebase, but floors at 0 defensively either way.
export const applyCosts = (resources, costs) => {
  const next = { ...resources };
  Object.entries(costs).forEach(([key, value]) => {
    next[key] = Math.max(0, (next[key] || 0) - value);
  });
  return next;
};

// Scales every field of a cost object by a flat multiplier.
export const scaleCosts = (costs, mult) =>
  Object.fromEntries(Object.entries(costs).map(([key, value]) => [key, Math.round(value * mult)]));

const RESOURCE_LABELS = { gold: 'Gold', hr: 'HR', copper: 'Copper', iron: 'Iron', oil: 'Oil', rareMetals: 'Rare Metals' };
// Decrees (src/engine/decrees.js) are counted from the ruler's bank, not from resources.

// How much of the player's CURRENT on-hand amount a cost would consume — the binary canAfford()
// check above says nothing about a cost that's affordable but still eats most/all of what the player
// has right now (e.g. turn-1 government adoption using most of the banked ADM, or a first unit recruit
// that costs exactly 100% of starting HR).
// Returns null when the cost isn't a meaningful strain (below 50% of any pool), so callers can just
// check truthiness rather than branching on a 'normal' level themselves.
export const getResourceStrain = (costs, resources) => {
  if (!costs || !resources) return null;
  let worst = { fraction: 0, key: null };
  Object.entries(costs).forEach(([key, value]) => {
    if (!value) return;
    const denominator = resources[key] || 0;
    if (denominator <= 0) return;
    const fraction = value / denominator;
    if (fraction > worst.fraction) worst = { fraction, key };
  });
  if (!worst.key || worst.fraction < 0.5) return null;
  const english = RESOURCE_LABELS[worst.key] || worst.key;
  const label = getLanguage() === 'he' && RESOURCE_LABELS[worst.key] ? tNow(`res.${worst.key}`) : english;
  return { level: worst.fraction >= 0.9 ? 'critical' : 'high', label };
};

export const getCostString = (costs) => {
  const parts = [];
  Object.entries(costs).forEach(([key, value]) => {
    if (!value) return;
    if (RESOURCE_LABELS[key]) parts.push(`${formatNumber(value)} ${getLanguage() === 'he' ? tNow(`res.${key}`) : RESOURCE_LABELS[key]}`);
    else if (key === 'techPoints') parts.push(`${value} ${getLanguage() === 'he' ? tNow('res.techPoints') : 'TP'}`);
    else if (key === 'decrees') parts.push(`${value} ${getLanguage() === 'he' ? tNow('res.decrees') : value === 1 ? 'decree' : 'decrees'}`);
  });
  return parts.join(', ');
};
