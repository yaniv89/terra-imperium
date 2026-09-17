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

// --- Revolts in CONQUERED territory: an end condition for rebellion, not just an army to grind ---
// A region taken by conquest (LAUNCH_INVASION, AMPHIBIOUS_ASSAULT, SETTLE_COLONIZE) carries
// `formerOwner` — whoever held it right before its new owner took it. Home territory (never taken
// from anyone, or a nation's own native region reclaimed) has no formerOwner and so nothing to
// revert to: an unresolved rebellion there just keeps fighting instead of ever flipping ownership.
// This is what makes garrisoning a conquest, not just winning the invasion, actually matter.

// How many consecutive turns an unresolved uprising in conquered land can run before it succeeds
// outright: the rebel army throws off the occupier and the region reverts to its formerOwner.
// Suppressing the rebellion (SUPPRESS_REBELLION) or letting unrest drop back below the threshold
// both remove the rebel unit this count is measured from, resetting the clock.
export const REVOLT_SUCCESS_TURNS = 6;

// Control% a conquered region must reach — while NOT presently rebelling — to count as fully
// integrated. This is the "good ending": formerOwner clears and the region durably stops being at
// risk of reverting, even if it rebels again later for some unrelated reason (e.g. a tax hike).
export const INTEGRATION_CONTROL_THRESHOLD = 75;

// Starting control/unrest for a region immediately after a successful revolt hands it back to its
// former owner — a fresh start, not an instant second uprising.
export const REVOLT_RECLAIMED_CONTROL = 40;
export const REVOLT_RECLAIMED_UNREST = 20;

// What `formerOwner` should be set to when `newOwnerId` takes a region away from `previousOwnerId`.
// A nation reclaiming its OWN native region (regionId === newOwnerId) is a homecoming, not a
// conquest — there's no former regime for the locals to revolt back to, so formerOwner is cleared
// rather than pointing at whoever was just driven out.
export const getFormerOwnerOnConquest = (regionId, previousOwnerId, newOwnerId) =>
  regionId === newOwnerId ? undefined : previousOwnerId;
