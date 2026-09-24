// src/engine/elimination.js
// Nation elimination: once a nation holds no regions at all, it's declared dead rather than
// removed from state.nations (the 240-nation roster is referenced by id everywhere — aiLogic.js,
// diplomacy.js, worldNations.js — so deleting the entry would break every one of those lookups).
// Checked once per turn in resolveTurn.js against BOTH AI-vs-AI conquest (resolveWarProgress,
// same file) and the player's own invasions — those land immediately via gameReducer.js, so this
// turn-end sweep is what actually notices a player conquest reduced someone to zero regions.
import { getOwnedRegionIds } from '../data/regions';

// A modest one-time prize for finishing a nation off entirely — sized like a single mid-tier
// action's cost (src/data/actionCosts.js), not a windfall.
export const NATION_ELIMINATION_REWARD = { gold: 200, dip: 15 };

export const checkNationElimination = (nations, regions, nationId) => {
  const nation = nations[nationId];
  if (!nation || nation.isPlayer || nation.isEliminated) return null;
  if (getOwnedRegionIds(regions, nationId).length > 0) return null;
  return { ...nation, isEliminated: true, isAtWar: false };
};

// Ends every war naming a newly eliminated nation — it has nothing left to fight with or for.
export const closeWarsForEliminatedNation = (wars, nationId) =>
  (wars || []).filter(w => w.aggressor !== nationId && w.enemy !== nationId);

// True if the player holds at least one region taken directly FROM `nationId` (region.formerOwner,
// set by getFormerOwnerOnConquest whenever a LAUNCH_INVASION/AMPHIBIOUS_ASSAULT/AI war-progress
// capture lands) — the signal used to decide whether the PLAYER gets credit (and the reward) for
// an elimination, as opposed to it being incidental AI-vs-AI conquest or a rebellion collapse the
// player had no part in.
export const wasEliminatedByPlayer = (regions, playerNationId, nationId) =>
  Object.values(regions).some(r => r.owner === playerNationId && r.formerOwner === nationId);
