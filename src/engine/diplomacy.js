// src/engine/diplomacy.js
// Pure diplomatic state transitions shared between the reducer (player-initiated actions) and
// resolveTurn.js (AI-initiated wars). Keeping one implementation means a war declared by the
// player and one declared by an AI nation always produce the same shape of state change. Every
// nation (the player's included) is just an entry in state.nations with the same militaryStrength
// stat, so none of this needs to special-case which nation is the player.

import { RelationStatus } from '../data/types';
import { isAdjacentToOwner } from '../data/regions';

// Finds a region owned by `ownerId` that borders territory `attackerId` already holds — the
// natural "next target" for a war goal.
const findCaptureTarget = (regions, ownerId, attackerId) =>
  Object.keys(regions).find(id => regions[id].owner === ownerId && isAdjacentToOwner(id, regions, attackerId)) || null;

// Builds a war goal of a SPECIFIC type — exported so a player can pick one explicitly rather than
// only ever getting an auto-assigned one. Gracefully falls back to destroy_military if
// 'capture_region' is requested but no valid bordering target exists.
export const buildWarGoal = (state, nationId, aggressor, type) => {
  if (type === 'capture_region') {
    const targetRegion = findCaptureTarget(state.regions, nationId, aggressor);
    if (targetRegion) return { type: 'capture_region', regionId: targetRegion };
  }
  const nation = state.nations[nationId];
  return { type: 'destroy_military', threshold: Math.round((nation?.militaryStrength || 1000) * 0.5) };
};

// Picks a war goal for a newly-declared war when the caller doesn't supply one. Every war has a
// concrete objective instead of running until hostility happens to decay enough to seek peace.
export const assignDefaultWarGoal = (state, nationId, aggressor) => {
  // The human player always prefers taking territory over grinding down an army — this is a UI
  // default, not a doctrine-driven AI behavior.
  if (aggressor === state.playerNationId) {
    return buildWarGoal(state, nationId, aggressor, 'capture_region');
  }
  const aggressorNation = state.nations[aggressor];
  // Blitz/opportunist doctrines fight for territory; attrition/cautious nations (when they do go
  // to war) grind down the defender's army instead.
  const prefersCapture = aggressorNation?.doctrine === 'blitz' || aggressorNation?.doctrine === 'opportunist';
  return buildWarGoal(state, nationId, aggressor, prefersCapture ? 'capture_region' : 'destroy_military');
};

// True once a war's goal condition is actually met. Pure and side-effect-free — the caller
// (resolveTurn.js) decides what to do with a newly-achieved goal.
export const checkWarGoal = (war, state) => {
  if (!war.goal || war.goalAchieved || !war.active) return false;

  if (war.goal.type === 'capture_region') {
    const region = state.regions[war.goal.regionId];
    return !!region && region.owner === war.aggressor;
  }

  if (war.goal.type === 'destroy_military') {
    const nation = state.nations[war.enemy];
    return !!nation && nation.militaryStrength <= war.goal.threshold;
  }

  return false;
};

// Declares war on `nationId`. No-op (returns state unchanged) if the nation doesn't exist or is
// already at war. If the target had a peace treaty, this sets a permanent hostilityFloor — the
// nation remembers the betrayal and can never fully cool back down, even after a later peace.
export const declareWar = (state, nationId, { aggressor, goal = null } = {}) => {
  const nation = state.nations[nationId];
  if (!nation || nation.isAtWar) return state;

  const brokePeace = !!nation.hasPeaceTreaty;
  const resolvedGoal = goal || assignDefaultWarGoal(state, nationId, aggressor);
  return {
    ...state,
    nations: {
      ...state.nations,
      [nationId]: {
        ...nation,
        isAtWar: true,
        hostility: 100,
        relationStatus: RelationStatus.WAR,
        hostilityFloor: brokePeace ? Math.max(nation.hostilityFloor || 0, 40) : (nation.hostilityFloor || 0)
      }
    },
    wars: [...state.wars, {
      id: `war_${nationId}_${state.year}`,
      enemy: nationId,
      startYear: state.year,
      active: true,
      aggressor,
      goal: resolvedGoal,
      goalAchieved: false
    }]
  };
};
