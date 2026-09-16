// src/utils/helpers.js
// Generic utility functions shared across the engine and UI. Combat/unit-composition helpers
// tied to the old infantry/armor/air model were removed here — Phase C ("Military") replaces
// that with the unit-class/counter/morale system described in the plan, built fresh rather than
// adapted from this one.

import { RelationStatus } from '../data/types';
import { REGIONS_DATA } from '../data/regions';
import { RESOURCE_IDS } from '../data/resources';

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

// Below this control level in the player's own home region, emergency "comeback" actions unlock
// (plan §9's stability/unrest layer will generalize this once regions actually subdivide per
// nation — for now, one region per nation, so this is just that region's own control%).
export const COMEBACK_THRESHOLD = 30;

export const getPlayerControl = (state) => state.regions[state.playerNationId]?.control ?? 0;

// Per-turn resource income for the player's nation: each unlocked resource's regional yield,
// scaled by that region's control% and infrastructure level. Deposits (which regions produce
// which resource) are geography, not implemented yet (Phase B) — every region currently yields
// gold and hr only, from REGIONS_DATA's gdp/population-derived proxy values.
export const calcIncome = (state) => {
  const playerRegions = Object.values(state.regions).filter(r => r.owner === state.playerNationId);

  const income = {};
  RESOURCE_IDS.forEach(id => { income[id] = 0; });

  playerRegions.forEach(region => {
    const regData = REGIONS_DATA[region.id];
    if (!regData) return;
    const controlMult = region.control / 100;
    const infraMult = 1 + (region.currentInfrastructure || 0) * 0.1;
    Object.entries(regData.resources || {}).forEach(([resId, amount]) => {
      if (income[resId] === undefined) return; // not unlocked at the current age
      income[resId] += amount * controlMult * infraMult;
    });
  });

  // Trade agreement bonuses.
  const tradePartners = Object.values(state.nations).filter(n => n.hasTradeAgreement);
  income.gold = (income.gold || 0) + tradePartners.length * 20;

  Object.keys(income).forEach(id => { income[id] = Math.round(income[id]); });
  return income;
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
