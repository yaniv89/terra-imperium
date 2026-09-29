// src/engine/intel.js
// What the player actually knows about a foreign nation's provinces. A foreign region's inner data
// (population, stability, development, garrisons, buildings, deposits) is hidden until a successful
// espionage operation against its owner — any op (gather intelligence, steal tech, support rebels)
// puts agents inside the country, and what they report stays current for INTEL_DURATION_TURNS.
// Stored as `state.intel[nationId] = lastTurnWithIntel`.
import { INTEL_DURATION_TURNS } from '../data/actionCosts';

export const grantIntel = (state, nationId) => ({
  ...(state.intel || {}),
  [nationId]: (state.turnNumber || 1) + INTEL_DURATION_TURNS
});

export const hasIntel = (state, nationId) => (state.intel?.[nationId] ?? -Infinity) >= (state.turnNumber || 1);

// Turn ends the intel still survives (INTEL_DURATION_TURNS right after an op; 0 on its last turn,
// when it is still visible; null when there is no intel at all).
export const getIntelTurnsLeft = (state, nationId) =>
  hasIntel(state, nationId) ? state.intel[nationId] - (state.turnNumber || 1) : null;

// Whether the player can see inside a region: their own, any whose owner they currently have intel
// on, and land nobody governs (no nation left to hide it).
export const canSeeRegionDetails = (state, regionId) => {
  const owner = state.regions?.[regionId]?.owner;
  if (!owner || owner === state.playerNationId) return true;
  const nation = state.nations?.[owner];
  if (!nation || nation.isEliminated) return true;
  return hasIntel(state, owner);
};
