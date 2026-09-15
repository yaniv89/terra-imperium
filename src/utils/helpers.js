// src/utils/helpers.js
// Utility functions for the game

import { GamePhases, RelationStatus } from '../data/types';
import { REGIONS_DATA, CORE_REGION_IDS } from '../data/regions';
import { TECH_TREE } from '../data/techTree';

// ============ NUMBER FORMATTING ============

export const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const formatMoney = (num) => {
  return `$${formatNumber(num)}`;
};

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

// Calculate average control of core Israeli regions
export const getAvgCoreControl = (state) => {
  const coreRegions = CORE_REGION_IDS
    .map(id => state.regions[id])
    .filter(r => r && r.owner === 'player');
  
  if (coreRegions.length === 0) return 0;
  const total = coreRegions.reduce((sum, r) => sum + (r.control || 0), 0);
  return Math.round(total / coreRegions.length);
};

// Calculate societal slider bonuses
export const calcSocietalBonuses = (slider) => {
  // 0 = Secular, 100 = Religious
  if (slider <= 30) {
    // Secular bonuses
    return {
      label: 'Secular',
      techMult: 1.2,
      manMult: 0.9,
      defBonus: 0,
      dipBonus: 0.15,
      description: '+20% Tech, -10% Manpower, +15% Western Diplomacy'
    };
  } else if (slider >= 70) {
    // Religious bonuses
    return {
      label: 'Religious',
      techMult: 0.8,
      manMult: 1.2,
      defBonus: 0.1,
      dipBonus: 0,
      description: '-20% Tech, +20% Manpower, +10% Defense Morale'
    };
  } else {
    // Balanced
    return {
      label: 'Balanced',
      techMult: 1,
      manMult: 1,
      defBonus: 0,
      dipBonus: 0,
      description: 'No bonuses or penalties'
    };
  }
};

// Calculate military power
export const calcMilitaryPower = (state) => {
  if (state.phase === GamePhases.PRE_STATE) {
    return state.undergroundStrength || 0;
  }

  let power = sumUnits(state.militaryUnits);

  // Tech bonuses
  const techBonuses = getTechBonuses(state.techTree);
  if (techBonuses.combatBonus) {
    power *= (1 + techBonuses.combatBonus);
  }

  // Societal bonuses
  const societalBonuses = calcSocietalBonuses(state.societalSlider);
  power *= (1 + societalBonuses.defBonus);

  return Math.round(power);
};

// Calculate income per turn
export const calcIncome = (state) => {
  const playerRegions = Object.values(state.regions).filter(r => r.owner === 'player');
  const techBonuses = getTechBonuses(state.techTree);
  const societalBonuses = calcSocietalBonuses(state.societalSlider);
  
  let baseMoney = 0;
  let baseManpower = 0;
  
  playerRegions.forEach(region => {
    const regData = REGIONS_DATA[region.id];
    if (!regData) return;

    // Base resources from region
    const controlMult = region.control / 100;
    const infraMult = 1 + (region.currentInfrastructure || 0) * 0.1;
    // Desert Blooming makes the Negev itself specifically more productive, not the whole economy.
    const negevMult = region.id === 'negev' ? 1 + (techBonuses.negevBonus || 0) : 1;

    baseMoney += (regData.resources.money || 0) * controlMult * infraMult * negevMult;
    baseManpower += (regData.resources.manpower || 0) * controlMult * infraMult * negevMult;
  });

  // Trade agreement bonuses
  const tradePartners = Object.values(state.nations).filter(n => n.hasTradeAgreement);
  baseMoney += tradePartners.length * 2000;

  // Tech bonuses
  if (techBonuses.moneyMult) {
    baseMoney *= techBonuses.moneyMult;
  }

  // Societal bonuses
  baseManpower *= societalBonuses.manMult;

  // Tech points (post-state only)
  let techPoints = 0;
  if (state.phase === GamePhases.POST_STATE) {
    techPoints = 5 + Math.floor(playerRegions.length * 2);
    if (techBonuses.techPointMult) {
      techPoints *= techBonuses.techPointMult;
    }
    techPoints *= societalBonuses.techMult;
  }

  // Diplomacy points
  const dpGain = 3 + Math.floor(baseMoney / 10000) + (techBonuses.diplomacyIncomeBonus || 0);

  return {
    money: Math.round(baseMoney),
    manpower: Math.round(baseManpower),
    techPoints: Math.round(techPoints),
    diplomacyPoints: Math.round(dpGain)
  };
};

// Get accumulated tech bonuses
export const getTechBonuses = (techTree) => {
  const bonuses = {
    moneyMult: 1,
    techPointMult: 1,
    defenseBonus: 0,
    combatBonus: 0,
    infantryBonus: 0,
    tankBonus: 0,
    tankDiscount: 0,
    airBonus: 0,
    jetDiscount: 0,
    // Layered point-defense (Iron Dome + Arrow 3 + Iron Beam): additive, capped so it can never
    // fully negate incoming damage.
    missileDefenseBonus: 0,
    hostilityReduction: 0,
    negevBonus: 0,
    diplomacyIncomeBonus: 0,
    enemyDebuff: 0,
    combatPrediction: false,
    covertOps: false,
    cyber: false,
    globalIntel: false
  };

  if (!techTree) return bonuses;

  Object.entries(techTree).forEach(([techId, techState]) => {
    if (!techState.researched) return;

    const tech = TECH_TREE[techId];
    if (!tech || !tech.effects) return;

    const effects = tech.effects;

    if (effects.moneyMult) bonuses.moneyMult *= effects.moneyMult;
    if (effects.techPointMult) bonuses.techPointMult *= effects.techPointMult;
    if (effects.defenseBonus) bonuses.defenseBonus += effects.defenseBonus;
    if (effects.infantryBonus) bonuses.infantryBonus += effects.infantryBonus;
    if (effects.tankBonus) bonuses.tankBonus += effects.tankBonus;
    if (effects.tankDiscount) bonuses.tankDiscount += effects.tankDiscount;
    if (effects.airBonus) bonuses.airBonus += effects.airBonus;
    if (effects.jetDiscount) bonuses.jetDiscount += effects.jetDiscount;
    if (effects.missileDefenseBonus) bonuses.missileDefenseBonus += effects.missileDefenseBonus;
    if (effects.hostilityReduction) bonuses.hostilityReduction += effects.hostilityReduction;
    if (effects.negevBonus) bonuses.negevBonus += effects.negevBonus;
    if (effects.diplomacyIncomeBonus) bonuses.diplomacyIncomeBonus += effects.diplomacyIncomeBonus;
    if (effects.enemyDebuff) bonuses.enemyDebuff += effects.enemyDebuff;
    if (effects.combatBonus) bonuses.combatBonus += effects.combatBonus;
    if (effects.aiBonus) bonuses.combatBonus += effects.aiBonus;
    if (effects.combatPrediction) bonuses.combatPrediction = true;
    if (effects.covertOps) bonuses.covertOps = true;
    if (effects.cyber) bonuses.cyber = true;
    if (effects.globalIntel) bonuses.globalIntel = true;
  });

  bonuses.missileDefenseBonus = Math.min(0.9, bonuses.missileDefenseBonus);

  return bonuses;
};

// ============ UNIT COMPOSITION ============
// The player's arsenal (POST_STATE) is split into three types instead of one scalar, so terrain
// and force mix are real tradeoffs. AI nations still fight as a single scalar `militaryStrength`
// — giving every AI nation its own composition is a much larger undertaking and out of scope
// here; only the player's committed forces use these type-vs-terrain multipliers.

export const UNIT_TYPES = ['infantry', 'armor', 'air'];

export const emptyUnits = () => ({ infantry: 0, armor: 0, air: 0 });

export const sumUnits = (units) => {
  if (!units) return 0;
  return UNIT_TYPES.reduce((total, type) => total + (units[type] || 0), 0);
};

export const addUnits = (units, delta) => {
  const next = { ...emptyUnits(), ...units };
  UNIT_TYPES.forEach(type => { next[type] = Math.max(0, next[type] + (delta[type] || 0)); });
  return next;
};

export const hasEnoughUnits = (units, composition) => {
  return UNIT_TYPES.every(type => (units?.[type] || 0) >= (composition?.[type] || 0));
};

// How well each unit type performs on a given terrain, applied to the ATTACKER's committed
// composition (mirrors, but is independent from, TERRAIN_MODS which favors the defender based
// on the same terrain — attacking with armor into mountains is doubly bad: your armor performs
// worse there AND the defender gets their own terrain bonus).
const COMPOSITION_TERRAIN_MODS = {
  plains: { infantry: 1.0, armor: 1.2, air: 1.0 },
  coastal: { infantry: 1.0, armor: 1.0, air: 1.05 },
  desert: { infantry: 0.9, armor: 1.3, air: 1.1 },
  port: { infantry: 1.0, armor: 0.95, air: 1.0 },
  island: { infantry: 0.9, armor: 0.7, air: 1.2 },
  hills: { infantry: 1.15, armor: 0.85, air: 1.0 },
  highlands: { infantry: 1.15, armor: 0.8, air: 1.0 },
  urban: { infantry: 1.3, armor: 0.7, air: 1.0 },
  mountains: { infantry: 1.3, armor: 0.6, air: 0.9 }
};

// H2 (the second half of the year) is modeled as the harsher season — armor and air suffer a
// small penalty, infantry unaffected. Cheap to add given the game already tracks an H1/H2 period
// per turn (Phase 7): it's a real timing lever ("wait for H1 to press the attack") without any
// new state. Only applied to composition-based (player) strength — enemy invasions are a flat
// strength number with no unit-type breakdown to apply a per-type seasonal penalty to.
const SEASONAL_MODS = {
  0: { infantry: 1, armor: 1, air: 1 },      // H1
  1: { infantry: 1, armor: 0.9, air: 0.95 }  // H2
};

// Effective attacking strength for a committed composition on a given terrain — this is what
// gets passed into calcCombatResult as the attacker's raw strength. `techBonuses` layers the
// unit-specific research bonuses (Uzi Production, Merkava/Air Superiority doctrine) on top of
// the terrain multiplier — a well-equipped force on bad terrain can still underperform, but it's
// never as weak as an unresearched one on the same ground.
export const calcCompositionStrength = (units, terrain = 'plains', techBonuses = {}, period = 0) => {
  const mods = COMPOSITION_TERRAIN_MODS[terrain] || { infantry: 1, armor: 1, air: 1 };
  const seasonal = SEASONAL_MODS[period] || SEASONAL_MODS[0];
  const typeBonus = {
    infantry: 1 + (techBonuses.infantryBonus || 0),
    armor: 1 + (techBonuses.tankBonus || 0),
    air: 1 + (techBonuses.airBonus || 0)
  };
  return UNIT_TYPES.reduce((total, type) => total + (units[type] || 0) * mods[type] * typeBonus[type] * seasonal[type], 0);
};

// Splits a flat casualty count back across unit types proportional to each type's share of the
// raw (pre-terrain-multiplier) composition, so e.g. an all-armor force takes all-armor losses.
export const distributeCasualties = (units, totalCasualties) => {
  const total = sumUnits(units);
  const losses = emptyUnits();
  if (total <= 0 || totalCasualties <= 0) return losses;
  UNIT_TYPES.forEach(type => {
    const share = (units[type] || 0) / total;
    losses[type] = Math.min(units[type] || 0, Math.round(totalCasualties * share));
  });
  return losses;
};

export const subtractUnits = (units, losses) => {
  const next = { ...emptyUnits(), ...units };
  UNIT_TYPES.forEach(type => { next[type] = Math.max(0, next[type] - (losses[type] || 0)); });
  return next;
};

// Uniformly shrinks a composition by a factor (e.g. 0.85 for a 15% attrition hit), used when an
// invasion's whole committed force degrades rather than taking type-specific casualties.
export const scaleUnits = (units, factor) => {
  const next = emptyUnits();
  UNIT_TYPES.forEach(type => { next[type] = Math.floor((units[type] || 0) * factor); });
  return next;
};

// ============ COMBAT CALCULATIONS ============

// Terrain modifiers apply to the DEFENDER's score — rugged/urban terrain should favor
// whoever is dug in, not the attacker. (Previously these multiplied the defender down,
// which made the Golan Heights and every enemy capital the easiest ground in the game
// to take — the opposite of the intent.)
const TERRAIN_MODS = {
  plains: 1,
  coastal: 1,
  desert: 1.05,
  port: 1.05,
  island: 1.2,
  hills: 1.15,
  highlands: 1.25,
  urban: 1.3,
  mountains: 1.4
};

const DEFAULT_RNG = { next: () => Math.random() };

export const calcCombatResult = (attacker, defender, techBonuses = {}, terrain = 'plains', rng = DEFAULT_RNG) => {
  const terrainMod = TERRAIN_MODS[terrain] || 1;
  // AI Warfare's combatPrediction narrows the random band (0.9-1.1 instead of 0.8-1.2) — the
  // side with prediction is less likely to get an unlucky (or lucky) upset outcome.
  const randomFactor = techBonuses.combatPrediction
    ? 0.9 + rng.next() * 0.2
    : 0.8 + rng.next() * 0.4;

  const attackerScore = attacker * randomFactor;
  const defenderScore = defender * terrainMod * (1 + (techBonuses.defenseBonus || 0));
  
  const ratio = attackerScore / (defenderScore || 1);
  
  return {
    ratio,
    attackerWins: ratio > 1.5,
    defenderWins: ratio < 0.7,
    stalemate: ratio >= 0.7 && ratio <= 1.5,
    casualties: {
      attacker: Math.round(attacker * (ratio < 1 ? 0.15 : 0.05)),
      defender: Math.round(defender * (ratio > 1 ? 0.15 : 0.05))
    }
  };
};

// ============ YEAR CALCULATIONS ============

export const getYearIncrement = (year) => {
  if (year < 1920) return 5;
  if (year < 1948) return 2;
  return 1;
};

// ============ REGION HELPERS ============

export const getRegionOwnerName = (region, nations) => {
  if (!region) return 'Unknown';
  if (region.owner === 'player') return 'Israel';
  const nation = nations[region.owner];
  return nation?.name || 'Unknown';
};

export const isRegionPlayerOwned = (regionId, regions) => {
  const region = regions[regionId];
  return region && region.owner === 'player';
};

export const getPlayerRegions = (regions) => {
  return Object.values(regions).filter(r => r.owner === 'player');
};

export const getRegionsByOwner = (regions, ownerId) => {
  return Object.values(regions).filter(r => r.owner === ownerId);
};

// ============ INVASION HELPERS ============

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

export const getCostString = (costs) => {
  const parts = [];
  if (costs.money) parts.push(formatMoney(costs.money));
  if (costs.manpower) parts.push(`${formatNumber(costs.manpower)} Men`);
  if (costs.diplomacyPoints) parts.push(`${costs.diplomacyPoints} DP`);
  if (costs.techPoints) parts.push(`${costs.techPoints} TP`);
  if (costs.actionPoints) parts.push(`${costs.actionPoints} AP`);
  return parts.join(', ');
};
