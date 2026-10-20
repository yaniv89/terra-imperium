// src/battle/sim/losses.js
// Every strength a squad loses has a cause (audit H-03: squads bled with lastHitTick never set and
// nobody could say why). Each damage path in the sim takes strength off through `loseStrength`, which
// books the men actually lost (never more than the squad had) under one cause:
//   melee      a blow from an enemy squad (combat.js)
//   ranged     a shot from an enemy squad (combat.js), siege splash included
//   tower      a shot from the city's towers, the keep or a worker-built tower (objectives.js, economy.js)
//   impact     a commander power or bombardment (effects.js)
//   attrition  an invader bleeding on enemy soil without supply (support.js)
// `q.lossBy` is bookkeeping only: never read by the sim's rules, never hashed. Dependency-free so
// every module can use it without an import cycle.

export const LOSS_CAUSES = ['melee', 'ranged', 'tower', 'impact', 'attrition'];

export const emptyLosses = () => ({ melee: 0, ranged: 0, tower: 0, impact: 0, attrition: 0 });

/** Take up to `amount` strength off squad `q` and book what was lost under `cause`. Returns the loss. */
export const loseStrength = (q, amount, cause) => {
  const lost = Math.max(0, Math.min(q.strength, amount));
  q.strength -= lost;
  if (!q.lossBy) q.lossBy = emptyLosses();
  q.lossBy[cause] = (q.lossBy[cause] || 0) + lost;
  return lost;
};

/** The sum of a squad's booked losses (equals startStrength - strength + healing). */
export const lossTotal = (q) => (q.lossBy ? LOSS_CAUSES.reduce((s, k) => s + (q.lossBy[k] || 0), 0) : 0);
