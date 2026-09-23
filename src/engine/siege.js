// src/engine/siege.js
// Pure control-as-defense-HP math for multi-turn sieges. Shared between the player's own
// LAUNCH_INVASION/AMPHIBIOUS_ASSAULT (src/engine/gameReducer.js) and the AI's abstract war-progress
// capture roll (resolveWarProgress, src/engine/diplomacy.js) — mirrors how diplomacy.js itself is
// already shared the same way between player and AI war state. Deliberately kept out of battle.js
// (which knows nothing about regions/ownership) and out of src/data/actionCosts.js (that file is
// scoped to player-action costs, not shared combat math).
//
// Core idea (Civilization-inspired): a region's `control` (0-100, already the stat GlobeView's map
// legend colors by, and already what the revolt/settle-colonize systems treat as "how securely
// held") doubles as the defense HP a siege must grind down. A single won battle round no longer
// flips ownership outright — it damages `control` instead, the way MISSILE_STRIKE already does.
// Ownership only flips once `control` drops to/below the capture threshold AND the attacker still
// has a melee-capable unit standing to actually occupy the ground, same as Civ's "only melee units
// can move into and capture a city." A completely undefended region (no garrison at all) is still
// captured in one hit — walking into an empty city needs no siege — see the caller-side check in
// gameReducer.js (`defenderUnits.length === 0`), not handled here.

export const SIEGE_CONTROL_DAMAGE = { attacker: 30, stalemate: 10, defender: 0 };
export const SIEGE_CAPTURE_CONTROL_THRESHOLD = 15;
export const SIEGE_CONTROL_REGEN_PER_TURN = 4;
export const SIEGE_REGEN_COOLDOWN_TURNS = 2;

// -5%/level, floored at -50% at level 10 — a genuine "Walls" analog. Previously defenseLevel was
// only ever read as a boolean gate for the siege unit class's own fortification multiplier; this
// is in addition to, not instead of, that gate.
const DEFENSE_LEVEL_DAMAGE_REDUCTION_PER_LEVEL = 0.05;
const DEFENSE_LEVEL_DAMAGE_REDUCTION_CAP = 0.5;
export const getDefenseLevelDamageReductionMultiplier = (defenseLevel) =>
  1 - Math.min(DEFENSE_LEVEL_DAMAGE_REDUCTION_CAP, (defenseLevel || 0) * DEFENSE_LEVEL_DAMAGE_REDUCTION_PER_LEVEL);

// Only these classes can actually occupy ground once it's broken — ranged/siege/naval/air can
// soften a region but never take it, same as Civ's ranged-units-can't-capture-a-city rule.
export const OCCUPATION_CAPABLE_CLASSES = ['infantry', 'cavalry'];
export const hasMeleeUnitDeployed = (units) =>
  units.some((u) => OCCUPATION_CAPABLE_CLASSES.includes(u.classId) && u.strength > 0);

// The pure control-math core. Callers handle the undefended-region exception themselves (skip this
// entirely when there was no garrison to begin with) and assemble the rest of the region patch
// (owner/formerOwner/unrest reset on actual capture) themselves, same as every other region-state
// case already does.
//
// The no-melee clamp is what makes this idempotent and un-cheesable: once control is pinned at
// the threshold, a later hit without melee present can't push it any lower ("shattered but not yet
// occupied" stays exactly at the threshold), so there's no way to bank damage for a free finisher —
// the very next attacker-favorable round WITH melee present captures immediately, since control is
// already at/under the threshold.
export const resolveSiegeControlDamage = ({ currentControl, outcome, hasMeleeUnit }) => {
  const damaged = Math.max(0, (currentControl || 0) - (SIEGE_CONTROL_DAMAGE[outcome] ?? 0));
  const crossedThreshold = outcome === 'attacker' && damaged <= SIEGE_CAPTURE_CONTROL_THRESHOLD;
  if (!crossedThreshold) return { nextControl: damaged, captured: false };
  if (hasMeleeUnit) return { nextControl: damaged, captured: true };
  return { nextControl: SIEGE_CAPTURE_CONTROL_THRESHOLD, captured: false };
};

// resolveTurn.js's per-turn tick: a region not attacked in the last SIEGE_REGEN_COOLDOWN_TURNS
// turns recovers control — an interrupted siege doesn't bank its damage forever, mirroring how
// war exhaustion already pressures a dragging war rather than letting one linger for free.
export const nextSiegeControlRegen = (region, currentTurn) => {
  const sinceAttack = currentTurn - (region.lastAttackedTurn ?? -Infinity);
  if (sinceAttack < SIEGE_REGEN_COOLDOWN_TURNS) return region.control;
  return Math.min(100, (region.control || 0) + SIEGE_CONTROL_REGEN_PER_TURN);
};
