// src/data/rebellion.js
// Rebellion (plan §9): low stability doesn't just sit there as a number — past a threshold it
// spawns an actual hostile army in the region, fought and won or lost like any other unit,
// matching the plan's explicit "spawns rebel armies, not just a number" framing. Spawning, growth
// and dissolution are driven every turn by resolveTurn.js; fighting one back is the
// SUPPRESS_REBELLION action (src/context/GameContext.jsx). This module just holds the shared
// constants and the spawn-strength formula.

// Rebels aren't a real nation — this id never appears in state.nations. Every place that reads a
// unit's owner already falls back to the raw id when a nation lookup misses (e.g. `?.name || id`),
// so an unregistered owner id is safe to use rather than needing a whole fake nation entry.
export const REBEL_OWNER_ID = 'rebels';

export const REBELLION_UNREST_THRESHOLD = 90;

// +15% strength per turn a rebellion is left unaddressed — ignoring one gets more costly to fix,
// not less, which is the point.
export const REBEL_GROWTH_RATE = 0.15;

// Log-scaled against real population, mirroring build-world-regions.mjs's gold/HR formulas — the
// same reason applies: real population figures need compressing into a playable band rather than
// producing a rebel army bigger than the garrison that could ever realistically hold it.
export const getRebelSpawnStrength = (region) =>
  Math.round(300 + 100 * Math.log10(Math.max(region.currentPopulation || 1, 1)));
