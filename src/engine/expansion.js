// src/engine/expansion.js
// Plan §M12: Aggressive Expansion. Real, but deliberately simpler than the plan's own "culture
// group + neighbors of the ceded region" distribution — this codebase has no culture-group data
// at all (M3 never built the culture-group name pools the plan's own §M3 section describes), so AE
// spreads to the captured region's own immediate neighbors plus its previous owner, not a whole
// culture group. That's still a real, geography-driven "who gets angry" rule, just a narrower one.
import { getNeighborIds } from '../data/regions';
import { leansNegative } from '../data/identity';
import { AE_PER_DEV_POINT, AE_DECAY_PER_TURN, AE_PRUNE_BELOW, AE_ISOLATIONIST_DISCOUNT } from '../data/actionCosts';

// Called once per successful capture (player LAUNCH_INVASION/AMPHIBIOUS_ASSAULT in gameReducer.js,
// AI captures in diplomacy.js's resolveWarProgress) — region/dev must be read from the state
// BEFORE ownership changed, since AE is proportional to what was actually taken.
export const applyAggressiveExpansion = (nations, regions, regionId, previousOwnerId, takerId) => {
  if (!previousOwnerId || previousOwnerId === takerId) return nations;
  const dev = regions[regionId]?.dev;
  const devTotal = (dev?.tax || 0) + (dev?.production || 0) + (dev?.manpower || 0);
  if (devTotal <= 0) return nations;

  const taker = nations[takerId];
  const discount = leansNegative(taker?.identity, 'globalism') ? AE_ISOLATIONIST_DISCOUNT : 1;
  const aeGain = Math.round(devTotal * AE_PER_DEV_POINT * discount);
  if (aeGain <= 0) return nations;

  const affectedIds = new Set([previousOwnerId]);
  getNeighborIds(regionId).forEach((neighborId) => {
    const owner = regions[neighborId]?.owner;
    if (owner) affectedIds.add(owner);
  });
  affectedIds.delete(takerId);

  let next = nations;
  affectedIds.forEach((id) => {
    const nation = next[id];
    if (!nation) return;
    next = { ...next, [id]: { ...nation, ae: { ...(nation.ae || {}), [takerId]: (nation.ae?.[takerId] || 0) + aeGain } } };
  });
  return next;
};

// Runs once per turn (resolveTurn.js) for every nation: each AE entry decays toward 0 and is
// pruned once it's negligible, so the sparse `ae` map never accumulates stale near-zero entries
// over a long game. Returns the SAME nations reference when nothing changed, matching every other
// per-turn pass's no-op-safe shape.
export const decayAggressiveExpansion = (nations) => {
  let changed = false;
  const next = { ...nations };
  Object.entries(nations).forEach(([id, nation]) => {
    if (!nation.ae || Object.keys(nation.ae).length === 0) return;
    let nationChanged = false;
    const ae = {};
    Object.entries(nation.ae).forEach(([targetId, value]) => {
      const decayed = value - AE_DECAY_PER_TURN;
      if (decayed >= AE_PRUNE_BELOW) {
        ae[targetId] = decayed;
      } else {
        nationChanged = true;
      }
      if (decayed !== value) nationChanged = true;
    });
    if (nationChanged) {
      next[id] = { ...nation, ae };
      changed = true;
    }
  });
  return changed ? next : nations;
};
