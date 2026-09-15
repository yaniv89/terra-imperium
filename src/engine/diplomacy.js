// src/engine/diplomacy.js
// Pure diplomatic state transitions shared between the reducer (player-initiated actions) and
// resolveTurn.js (AI-initiated wars, Phase 4). Keeping one implementation means a war declared
// by the player and one declared by an AI nation always produce the same shape of state change.

import { RelationStatus } from '../data/types';
import { isAdjacentToOwner } from '../data/regions';
import { calcMilitaryPower } from '../utils/helpers';

// Finds a region owned by `ownerId` that borders territory `attackerId` already holds — the
// natural "next target" for a war goal, reusing the Phase 3 adjacency graph. Player is exempted
// from needing territory of its own here in the same way aiLogic's stateless-nation targeting is:
// this is only ever called with attackerId either 'player' (which always has territory once
// POST_STATE) or an AI nation, so no stateless-actor case applies to war-goal assignment.
const findCaptureTarget = (regions, ownerId, attackerId) =>
  Object.keys(regions).find(id => regions[id].owner === ownerId && isAdjacentToOwner(id, regions, attackerId)) || null;

// Builds a war goal of a SPECIFIC type — exported so the player can pick one explicitly (see
// DiplomacyPanel's two "Declare War" variants) rather than only ever getting an auto-assigned
// one. Gracefully falls back to destroy_military if 'capture_region' is requested but no valid
// bordering target exists, so a player/AI choice can never produce a goal nothing can satisfy.
export const buildWarGoal = (state, nationId, aggressor, type) => {
  if (type === 'capture_region') {
    const ownerToCapture = aggressor === 'player' ? nationId : 'player';
    const targetRegion = findCaptureTarget(state.regions, ownerToCapture, aggressor);
    if (targetRegion) return { type: 'capture_region', regionId: targetRegion };
  }
  if (aggressor === 'player') {
    const nation = state.nations[nationId];
    return { type: 'destroy_military', threshold: Math.round((nation?.militaryStrength || 1000) * 0.5) };
  }
  return { type: 'destroy_military', threshold: Math.round(calcMilitaryPower(state) * 0.5) };
};

// Picks a war goal for a newly-declared war when the caller doesn't supply one (Phase 7). Every
// war now has a concrete objective instead of running until hostility happens to decay enough to
// seek peace — see checkWarGoal below for how completion is detected.
export const assignDefaultWarGoal = (state, nationId, aggressor) => {
  if (aggressor === 'player') {
    // Player is attacking `nationId`: prefer taking a bordering region if one exists (buildWarGoal
    // itself falls back to destroy_military when there isn't one).
    return buildWarGoal(state, nationId, aggressor, 'capture_region');
  }

  // `nationId` (an AI nation) is attacking the player. Blitz/opportunist doctrines fight for
  // territory; attrition/cautious nations (when they do go to war) grind down the player's army —
  // matching how those doctrines already behave in aiLogic.js's own targeting and war rolls.
  const nation = state.nations[nationId];
  const prefersCapture = nation?.doctrine === 'blitz' || nation?.doctrine === 'opportunist';
  return buildWarGoal(state, nationId, aggressor, prefersCapture ? 'capture_region' : 'destroy_military');
};

// True once a war's goal condition is actually met. Pure and side-effect-free — the caller
// (resolveTurn.js) decides what to do with a newly-achieved goal (nudging the loser's hostility
// low enough that peace can be sought, per its own comment).
export const checkWarGoal = (war, state) => {
  if (!war.goal || war.goalAchieved || !war.active) return false;

  if (war.goal.type === 'capture_region') {
    const region = state.regions[war.goal.regionId];
    if (!region) return false;
    const wantedOwner = war.aggressor === 'player' ? 'player' : war.aggressor;
    return region.owner === wantedOwner;
  }

  if (war.goal.type === 'destroy_military') {
    if (war.aggressor === 'player') {
      const nation = state.nations[war.enemy];
      return !!nation && nation.militaryStrength <= war.goal.threshold;
    }
    return calcMilitaryPower(state) <= war.goal.threshold;
  }

  return false;
};

// Declares war on `nationId`. No-op (returns state unchanged) if the nation doesn't exist or is
// already at war. If the target had a peace treaty, this sets a permanent hostilityFloor — the
// nation remembers the betrayal and can never fully cool back down, even after a later peace.
// `aggressor` ('player' or an AI nation id) and `goal` are new in Phase 7 — every war now tracks
// who declared it and what they're trying to achieve, auto-assigned when the caller doesn't pick
// one explicitly (see assignDefaultWarGoal above).
export const declareWar = (state, nationId, { aggressor = 'player', goal = null } = {}) => {
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
