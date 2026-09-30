// src/battle/sim/moraleMath.js
// Morale lost per 1% of the squad's own starting strength lost — the same scale-free rule as
// auto-resolve (a big regiment and a small one break at the same casualty rate): a
// fresh squad breaks at ~67% losses. Before, morale fell by damage/25 in absolute terms, so a normal 1,000-man squad could
// lose every man before losing enough morale to rout — battles were fights to the death.
// Dependency-free so combat.js, effects.js and objectives.js can all use it without a cycle.
export const RTS_MORALE_PER_PERCENT = 1.2;
export const moraleFromLosses = (q, damage) => Math.round(((100 * damage) / Math.max(1, q.startStrength || q.strength || 1)) * RTS_MORALE_PER_PERCENT);
