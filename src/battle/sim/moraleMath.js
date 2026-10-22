// src/battle/sim/moraleMath.js
// Morale lost per 1% of the squad's own starting strength lost — the same scale-free rule as
// auto-resolve (a big regiment and a small one break at the same casualty rate). Before, morale fell by damage/25 in absolute terms, so a normal 1,000-man squad could
// lose every man before losing enough morale to rout — battles were fights to the death.
// ONE break point for both resolutions: a fresh unit reaches the rout line after losing
// BREAK_LOSS_PERCENT of itself, in the real-time battle and on Auto (src/engine/battle.js), so a
// skipped battle ends with the same fallen and fled shares as the fought one.
// Dependency-free so combat.js, effects.js and objectives.js can all use it without a cycle.
export const MORALE_ROUT_THRESHOLD = 20;
export const BREAK_LOSS_PERCENT = 200 / 3; // about 67% losses
export const MORALE_PER_LOSS_PERCENT = (100 - MORALE_ROUT_THRESHOLD) / BREAK_LOSS_PERCENT; // 1.2
export const RTS_MORALE_PER_PERCENT = MORALE_PER_LOSS_PERCENT;
export const moraleFromLosses = (q, damage) => Math.round(((100 * damage) / Math.max(1, q.startStrength || q.strength || 1)) * RTS_MORALE_PER_PERCENT);
