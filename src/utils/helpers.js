// src/utils/helpers.js
// Generic utility functions shared across the engine and UI. Combat/unit-composition helpers
// tied to the old infantry/armor/air model were removed here — Phase C ("Military") replaces
// that with the unit-class/counter/morale system described in the plan, built fresh rather than
// adapted from this one.

import { RelationStatus } from '../data/types';
import { REGIONS_DATA, getNationCapital } from '../data/regions';
import { RESOURCE_IDS } from '../data/resources';
import { hasDeposit } from '../data/deposits';
import { GOVERNMENT_TYPES } from '../data/government';
import { POLICIES } from '../data/policies';
import { WONDERS } from '../data/wonders';
import { TAX_RATES } from '../data/taxRates';
import { getSatelliteEffectTotal } from '../data/satellites';
import { SPACE_MISSIONS_BY_ID } from '../data/spaceMissions';

// ============ NUMBER FORMATTING ============

export const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
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

export const getPlayerControl = (state) => state.regions[getNationCapital(state.playerNationId)]?.control ?? 0;

// Base per-turn yield of a developed extraction building (Copper Mine / Iron Foundry / Oil Well),
// before the same control%/infrastructure scaling every other resource gets.
const EXTRACTION_BASE_YIELD = 20;

// Base per-turn tech points from one tier level of a region's Science building (Library ->
// Scriptorium -> University -> Research Lab), before control%/infrastructure scaling.
const SCIENCE_TECHPOINT_YIELD = 2;

// Sums a nation's government effect, every adopted policy's effect, and every completed World
// Wonder's effect for one bonus hook (goldMult/hrMult, read by calcIncome; stabilityBonus, read by
// nextUnrest) — the one place that summation happens, so government, policies and wonders never
// drift into their own separate math.
export const getNationBonusTotal = (nation, hookKey) => {
  const govBonus = GOVERNMENT_TYPES[nation?.government]?.effect?.[hookKey] || 0;
  const policyBonus = (nation?.policies || []).reduce((sum, id) => sum + (POLICIES[id]?.effect?.[hookKey] || 0), 0);
  const wonderBonus = (nation?.wonders || []).reduce((sum, id) => sum + (WONDERS[id]?.effect?.[hookKey] || 0), 0);
  return govBonus + policyBonus + wonderBonus;
};

// Per-turn resource income for the player's nation: gold/hr from every owned region's gdp/
// population-derived base value, plus copper/iron/oil from any region that has both the deposit
// (src/data/deposits.js) and the matching extraction building actually built
// (src/data/buildings.js) — geography and construction gate strategic resources, not just age.
export const calcIncome = (state) => {
  const playerRegions = Object.values(state.regions).filter(r => r.owner === state.playerNationId);

  const income = {};
  RESOURCE_IDS.forEach(id => { income[id] = 0; });

  playerRegions.forEach(region => {
    const regData = REGIONS_DATA[region.id];
    if (!regData) return;
    const controlMult = region.control / 100;
    const infraMult = 1 + (region.currentInfrastructure || 0) * 0.1;
    // Population Policy (plan §5, "more HR and tax later"): gold/hr scale with how much this
    // region has grown past its starting population. Deposit/extraction/tech yields below don't
    // scale with it — they're geography- and building-driven, not population-driven.
    const popGrowthMult = regData.population > 0 ? (region.currentPopulation || regData.population) / regData.population : 1;
    Object.entries(regData.resources || {}).forEach(([resId, amount]) => {
      if (income[resId] === undefined) return; // not unlocked at the current age
      const growthMult = (resId === 'gold' || resId === 'hr') ? popGrowthMult : 1;
      income[resId] += amount * controlMult * infraMult * growthMult;
    });

    Object.entries(region.buildings?.extraction || {}).forEach(([resId, built]) => {
      if (!built || income[resId] === undefined) return;
      if (!hasDeposit(regData.startOwner, resId)) return; // building without a deposit produces nothing — deposits are geological, keyed by the province's home country
      income[resId] += EXTRACTION_BASE_YIELD * controlMult * infraMult;
    });

    // Tech points (Research tab): a Science building's tier level, same controlMult/infraMult
    // scaling as every other region yield. techPoints isn't in RESOURCE_IDS (it's a meta-currency,
    // like actionPoints), but resolveTurn.js applies every key calcIncome returns generically, so
    // adding it here is enough to make it flow into resources each turn.
    const scienceTier = region.buildings?.categories?.science;
    if (scienceTier !== undefined && scienceTier >= 0) {
      income.techPoints = (income.techPoints || 0) + (scienceTier + 1) * SCIENCE_TECHPOINT_YIELD * controlMult * infraMult;
    }
  });

  // Trade agreement bonuses.
  const tradePartners = Object.values(state.nations).filter(n => n.hasTradeAgreement);
  income.gold = (income.gold || 0) + tradePartners.length * 20;

  // Government/policy/wonder/satellite bonuses (plan §9/§10.4) — summed on the same hook
  // (getNationBonusTotal), applied as one multiplier, plus Set Tax Rate's own goldMult and every
  // owned satellite's goldMult/hrMult (getSatelliteEffectTotal, scaled by the shared orbital
  // debris penalty) on top.
  const playerNation = state.nations[state.playerNationId];
  const satellites = state.satellites || {};
  const taxGoldMult = TAX_RATES[playerNation?.taxRate]?.goldMult || 0;
  const satelliteGoldMult = getSatelliteEffectTotal(satellites, state.playerNationId, 'goldMult', state.orbitalDebrisLevel);
  const satelliteHrMult = getSatelliteEffectTotal(satellites, state.playerNationId, 'hrMult', state.orbitalDebrisLevel);
  const goldMult = 1 + getNationBonusTotal(playerNation, 'goldMult') + taxGoldMult + satelliteGoldMult;
  const hrMult = 1 + getNationBonusTotal(playerNation, 'hrMult') + satelliteHrMult;
  income.gold = (income.gold || 0) * goldMult;
  income.hr = (income.hr || 0) * hrMult;

  // A Communications Satellite's flat diplomacyPoints/turn and a Spy Satellite's flat
  // techPoints/turn — additive income, not multipliers, so they're summed separately from the
  // goldMult/hrMult hooks above rather than forced into that multiplicative shape.
  const satelliteDiplomacyPoints = getSatelliteEffectTotal(satellites, state.playerNationId, 'diplomacyPointsPerTurn', state.orbitalDebrisLevel);
  const satelliteTechPoints = getSatelliteEffectTotal(satellites, state.playerNationId, 'techPointsPerTurn', state.orbitalDebrisLevel);
  if (satelliteDiplomacyPoints) income.diplomacyPoints = (income.diplomacyPoints || 0) + satelliteDiplomacyPoints;
  if (satelliteTechPoints) income.techPoints = (income.techPoints || 0) + satelliteTechPoints;

  // Space mission ladder (plan §10.4 Layer 3) — every completed mission's recurringReward is a
  // flat per-turn addition (gold/diplomacyPoints/techPoints already exist as income keys;
  // rareMetals/helium3 have no deposit or extraction building of their own — completing
  // asteroid_mining/outer_planets IS their only real source, per resources.js's own header).
  (state.completedMissions || []).forEach(missionId => {
    const reward = SPACE_MISSIONS_BY_ID[missionId]?.recurringReward;
    if (!reward) return;
    if (reward.goldPerTurn) income.gold = (income.gold || 0) + reward.goldPerTurn;
    if (reward.diplomacyPointsPerTurn) income.diplomacyPoints = (income.diplomacyPoints || 0) + reward.diplomacyPointsPerTurn;
    if (reward.techPointsPerTurn) income.techPoints = (income.techPoints || 0) + reward.techPointsPerTurn;
    if (reward.rareMetalsPerTurn && income.rareMetals !== undefined) income.rareMetals += reward.rareMetalsPerTurn;
    if (reward.helium3PerTurn && income.helium3 !== undefined) income.helium3 += reward.helium3PerTurn;
  });

  // Set Research Focus (Research tab): a flat research-speed bonus for committing to a line.
  // Which category is stored for later systems (e.g. AI reading a rival's focus) to react to —
  // the immediate mechanical payoff is deliberately general rather than per-category, so it
  // doesn't need to reach into RESEARCH_TECH's own cost/afford checks to have a real effect.
  if (state.researchFocus && income.techPoints) income.techPoints *= 1.2;

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

const RESOURCE_LABELS = { gold: 'Gold', hr: 'HR', copper: 'Copper', iron: 'Iron', oil: 'Oil', rareMetals: 'Rare Metals', helium3: 'Helium-3' };

export const getCostString = (costs) => {
  const parts = [];
  Object.entries(costs).forEach(([key, value]) => {
    if (!value) return;
    if (RESOURCE_LABELS[key]) parts.push(`${formatNumber(value)} ${RESOURCE_LABELS[key]}`);
    else if (key === 'diplomacyPoints') parts.push(`${value} DP`);
    else if (key === 'techPoints') parts.push(`${value} TP`);
    else if (key === 'actionPoints') parts.push(`${value} AP`);
  });
  return parts.join(', ');
};
