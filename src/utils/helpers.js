// src/utils/helpers.js
// Generic utility functions shared across the engine and UI. Combat/unit-composition helpers
// tied to the old infantry/armor/air model were removed here — Phase C ("Military") replaces
// that with the unit-class/counter/morale system described in the plan, built fresh rather than
// adapted from this one.

import { RelationStatus } from '../data/types';
import { REGIONS_DATA, getNationCapital } from '../data/regions';
import { RESOURCE_IDS } from '../data/resources';
import { hasDeposit } from '../data/deposits';
import { getSatelliteEffectTotal } from '../data/satellites';
import { SPACE_MISSIONS_BY_ID } from '../data/spaceMissions';
import { getHistoricalPopulationShare } from '../data/historicalPopulation';
import { getModifier, getRegionModifier } from '../engine/modifiers/sheet';
import { getPopFactor, seedDevelopment } from '../engine/development';
// Re-exported so every existing `import { getNationBonusTotal } from '../utils/helpers'` site
// keeps working unchanged — the actual summation now lives in the modifier engine (plan §M1),
// which also exposes explainNationBonus for a future breakdown tooltip.
export { getNationBonusTotal, explainNationBonus } from '../engine/modifiers/sheet';

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

// Administrative Capacity, now split three ways (plan §M2): a flat pool/turn regardless of empire
// size meant a 50-region late-game empire acted exactly as often per turn as its 1-region start —
// nothing about maturing your state ever expanded what you could actually DO in a turn. This adds
// a real, already-existing lever on top of the base: government maturity (apBonus on
// GOVERNMENT_TYPES' effect object) and the Governance tech line (Code of Laws through Digital
// Administration), applied to all three pools equally since neither source differentiates by pool
// yet — M3's rulers and M7's per-line tech effects are what eventually make ADM/DIP/MIL grow at
// different rates from each other.
export const BASE_POWER_PER_TURN = 3;

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
export const getFieldedStrength = (state, nationId) =>
  Object.values(state.units || {}).reduce((sum, u) => sum + (u.ownerId === nationId ? (u.strength || 0) : 0), 0);

// Plan §M2/§M3: replaces the old single-pool getMaxActionPoints with the three power pools' per-
// turn income. Recomputed fresh from current government/ruler/advisors/tech every turn rather than
// read from a stored field, so adopting a government, a succession, or finishing a Governance tech
// all take effect on the very next turn automatically. `national.apBonus` (government maturity,
// Governance techs) applies equally to all three pools; `national.admBonus`/`dipBonus`/`milBonus`
// (ruler skill, advisors, pool-specific traits — src/engine/modifiers/sources.js) each touch only
// their own pool, which is what actually makes ADM/DIP/MIL grow at different rates from each other.
//
// A Communications Satellite's dipPerTurn and a completed space mission's recurringReward.
// dipPerTurn belong here, not in calcIncome's generic per-resource forEach: resolveTurn.js banks
// each pool up to a CAP OF 2x THIS FUNCTION'S OWN RETURN VALUE, so a recurring DIP bonus has to be
// part of that return value to actually raise the cap it lives under — added the other way (via
// calcIncome, before the cap is applied), the very next turn's bank-up would clip it straight back
// down to 2x the un-boosted base, silently discarding the bonus a player just earned.
export const getPowerIncome = (state) => {
  const nationId = state.playerNationId;
  const allPoolsBonus = getModifier(state, nationId, 'national.apBonus').total;
  const admBonus = getModifier(state, nationId, 'national.admBonus').total;
  const dipBonus = getModifier(state, nationId, 'national.dipBonus').total;
  const milBonus = getModifier(state, nationId, 'national.milBonus').total;
  const satelliteDip = getSatelliteEffectTotal(state.satellites || {}, nationId, 'dipPerTurn', state.orbitalDebrisLevel);
  const missionDip = (state.completedMissions || []).reduce((sum, id) => sum + (SPACE_MISSIONS_BY_ID[id]?.recurringReward?.dipPerTurn || 0), 0);
  return {
    adm: BASE_POWER_PER_TURN + allPoolsBonus + admBonus,
    dip: BASE_POWER_PER_TURN + allPoolsBonus + dipBonus + satelliteDip + missionDip,
    mil: BASE_POWER_PER_TURN + allPoolsBonus + milBonus
  };
};

// A realistic DISPLAY population for a region at the game's CURRENT year — region.currentPopulation
// itself is always seeded from the modern (~2024) figure regardless of start year, since it also
// drives calcIncome's popGrowthMult below (pinned at 1.0 for a fresh game); scaling that pair down
// for a 2000 BCE start would crater income by the same historical-scarcity factor. This keeps the
// historical curve (src/data/historicalPopulation.js) purely cosmetic: any growth the player has
// actually earned via Population Policy (currentPopulation exceeding the region's modern baseline)
// still shows proportionally, just applied on top of the era-appropriate share rather than the
// modern number.
export const getDisplayPopulation = (region, regionData, year) => {
  const modernBaseline = regionData?.population || 0;
  if (modernBaseline <= 0) return 0;
  const growthRatio = (region?.currentPopulation || modernBaseline) / modernBaseline;
  return Math.max(1, Math.round(modernBaseline * getHistoricalPopulationShare(year) * growthRatio));
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
    // Province development (plan §M5): gold/hr now come from region.dev.tax/production/manpower —
    // the LIVE economic base — instead of REGIONS_DATA's static resources.gold/hr directly. The
    // clamped popFactor (development.js) replaces the old unclamped popGrowthMult specifically to
    // stop population and development from compounding without limit, per the plan's own concern;
    // `local.*` lines are always 0 today (nothing populates state.regionModifiers yet — M6's
    // building tiers are the plan's first real source, same "plumbing before it has a source"
    // pattern as national.apBonus's Governance-tech line before M2 gave it a reader).
    if (income.gold !== undefined && income.hr !== undefined) {
      const dev = region.dev || seedDevelopment(region.id);
      const popFactor = getPopFactor(region, regData);
      const localTax = getRegionModifier(state, region.id, 'local.taxIncome').total;
      const localProduction = getRegionModifier(state, region.id, 'local.productionIncome').total;
      const localManpower = getRegionModifier(state, region.id, 'local.manpower').total;
      const taxIncome = dev.tax * (1 + localTax) * controlMult * infraMult * popFactor;
      const productionIncome = dev.production * (1 + localProduction) * controlMult * infraMult * popFactor;
      const manpowerIncome = dev.manpower * (1 + localManpower) * controlMult * infraMult * popFactor;
      income.gold += taxIncome + productionIncome;
      income.hr += manpowerIncome;
    }

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
  // (the modifier engine, src/engine/modifiers/), applied as one multiplier — government, policy,
  // wonder, identity, Set Tax Rate, and every owned satellite (scaled by the shared orbital debris
  // penalty) are all sources feeding these same two keys now, so this is one lookup each instead
  // of hand-summing every source at every call site.
  const satellites = state.satellites || {};
  const goldMult = 1 + getModifier(state, state.playerNationId, 'national.goldMult').total;
  const hrMult = 1 + getModifier(state, state.playerNationId, 'national.hrMult').total;
  income.gold = (income.gold || 0) * goldMult;
  income.hr = (income.hr || 0) * hrMult;

  // A Spy Satellite's flat techPoints/turn — additive income, not a multiplier, so it's summed
  // separately from the goldMult/hrMult hooks above rather than forced into that multiplicative
  // shape. (A Communications Satellite's dipPerTurn is NOT handled here — see getPowerIncome's own
  // header for why a DIP-pool bonus has to live there instead of in this generic income object.)
  const satelliteTechPoints = getSatelliteEffectTotal(satellites, state.playerNationId, 'techPointsPerTurn', state.orbitalDebrisLevel);
  if (satelliteTechPoints) income.techPoints = (income.techPoints || 0) + satelliteTechPoints;

  // Space mission ladder (plan §10.4 Layer 3) — every completed mission's recurringReward is a
  // flat per-turn addition (gold/techPoints already exist as income keys; rareMetals/helium3 have
  // no deposit or extraction building of their own — completing asteroid_mining/outer_planets IS
  // their only real source, per resources.js's own header). dipPerTurn is handled in
  // getPowerIncome instead, for the same reason satellite dipPerTurn is.
  (state.completedMissions || []).forEach(missionId => {
    const reward = SPACE_MISSIONS_BY_ID[missionId]?.recurringReward;
    if (!reward) return;
    if (reward.goldPerTurn) income.gold = (income.gold || 0) + reward.goldPerTurn;
    if (reward.techPointsPerTurn) income.techPoints = (income.techPoints || 0) + reward.techPointsPerTurn;
    if (reward.rareMetalsPerTurn && income.rareMetals !== undefined) income.rareMetals += reward.rareMetalsPerTurn;
    if (reward.helium3PerTurn && income.helium3 !== undefined) income.helium3 += reward.helium3PerTurn;
  });

  // Set Research Focus (Research tab): a flat research-speed bonus for committing to a line.
  // Which category is stored for later systems (e.g. AI reading a rival's focus) to react to —
  // the immediate mechanical payoff is deliberately general rather than per-category, so it
  // doesn't need to reach into RESEARCH_TECH's own cost/afford checks to have a real effect.
  if (state.researchFocus && income.techPoints) income.techPoints *= 1.2;
  // A ruler's Scholar trait (plan §M3) — gated on the same "no base techPoints, no bonus" rule as
  // Research Focus above, so a nation with no Science buildings yet isn't shown a phantom gain.
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

// Scales every field of a cost object by a flat multiplier — used for RESEARCH_TECH's
// ages-behind penalty (src/data/ages.js's getAgesBehindResearchCostMultiplier), so falling behind
// the calendar makes catching up cost more without needing a second cost table per age gap.
export const scaleCosts = (costs, mult) =>
  Object.fromEntries(Object.entries(costs).map(([key, value]) => [key, Math.round(value * mult)]));

const RESOURCE_LABELS = { gold: 'Gold', hr: 'HR', copper: 'Copper', iron: 'Iron', oil: 'Oil', rareMetals: 'Rare Metals', helium3: 'Helium-3' };
// Plan §M2: the three power pools, each measured against its own cap (maxAdm/maxDip/maxMil),
// exactly like actionPoints was measured against maxActionPoints before the pool split.
const POWER_POOL_LABELS = { adm: 'ADM', dip: 'DIP', mil: 'MIL' };

// How much of the player's CURRENT pool a cost would consume — the binary canAfford() check above
// says nothing about a cost that's affordable but still eats most/all of what the player has right
// now (e.g. turn-1 government adoption using most of starting ADM, or a first unit recruit that
// costs exactly 100% of starting HR). A power pool is measured against its own cap (a real ceiling);
// every other resource has no cap, so it's measured against the current on-hand amount instead.
// Returns null when the cost isn't a meaningful strain (below 50% of any pool), so callers can just
// check truthiness rather than branching on a 'normal' level themselves.
export const getResourceStrain = (costs, resources) => {
  if (!costs || !resources) return null;
  let worst = { fraction: 0, key: null };
  Object.entries(costs).forEach(([key, value]) => {
    if (!value) return;
    const isPower = !!POWER_POOL_LABELS[key];
    const denominator = isPower ? (resources[`max${key[0].toUpperCase()}${key.slice(1)}`] || resources[key] || 0) : (resources[key] || 0);
    if (denominator <= 0) return;
    const fraction = value / denominator;
    if (fraction > worst.fraction) worst = { fraction, key };
  });
  if (!worst.key || worst.fraction < 0.5) return null;
  const label = POWER_POOL_LABELS[worst.key] || RESOURCE_LABELS[worst.key] || worst.key;
  return { level: worst.fraction >= 0.9 ? 'critical' : 'high', label };
};

export const getCostString = (costs) => {
  const parts = [];
  Object.entries(costs).forEach(([key, value]) => {
    if (!value) return;
    if (RESOURCE_LABELS[key]) parts.push(`${formatNumber(value)} ${RESOURCE_LABELS[key]}`);
    else if (key === 'techPoints') parts.push(`${value} TP`);
    else if (POWER_POOL_LABELS[key]) parts.push(`${value} ${POWER_POOL_LABELS[key]}`);
  });
  return parts.join(', ');
};
