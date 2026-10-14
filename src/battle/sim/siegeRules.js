// src/battle/sim/siegeRules.js
// The rules that keep a city assault hard but winnable and the battle economy's auxiliaries worth
// training (playtest audit I211, I212). Dependency-free so combat.js, objectives.js, economy.js and
// buildings.js can all use it without an import cycle.

// Frontage (I211): a company trained in battle (an auxiliary, 200 men) can only be reached by so
// many men at once. A bigger squad strikes it as if it were at most AUX_FRONTAGE times the
// company's own starting strength, so a full regiment no longer cuts one down in a few blows.
export const AUX_FRONTAGE = 2.5;
export const isAuxiliary = (q) => !!q.original?.auxiliary && !q.worker; // laborers are not companies
/** The strength `a` strikes `t` with (the frontage rule for auxiliaries). */
export const strikingStrength = (a, t) => (isAuxiliary(t) ? Math.min(a.strength, AUX_FRONTAGE * t.startStrength) : a.strength);

// A tower's or the keep's shot (a flat volley) takes at most this share of an auxiliary's starting
// strength (objectives.js resolveStructureFire, economy.js fireEcoTowers).
export const AUX_SHOT_CAP = 0.15;
/** A building's shot at squad `t`, capped for an auxiliary (AUX_SHOT_CAP). */
export const capShotOn = (t, damage) => (isAuxiliary(t) ? Math.min(damage, Math.max(1, Math.round(t.startStrength * AUX_SHOT_CAP))) : damage);

// A tower, the keep or a worker-built tower fires in proportion to what is left of it (I212): at
// full HP its full volley (with its garrison's), at the last HP STRUCTURE_FIRE_FLOOR of it.
export const STRUCTURE_FIRE_FLOOR = 0.4;
export const fireShare = (s) => STRUCTURE_FIRE_FLOOR + (1 - STRUCTURE_FIRE_FLOOR) * Math.max(0, Math.min(1, s.hp / Math.max(1, s.maxHp)));

// Storming through a breach (I212): once the ring is broken, men without engines carry ladders and
// rams to the keep itself; their blows on a walled keep count KEEP_STORM_MULT times (combat.js).
export const KEEP_STORM_MULT = 2.5;
/** Is the city's wall ring broken (a wall segment or the gate down)? The keep then loses its walls' cover (combat.js). */
export const ringBroken = (w) => w.structures.some((s) => !s.alive && (s.kind === 'wall' || s.kind === 'gate'));

// Repairs under attack (I212): a structure hit in the last few seconds regains at most this many HP
// a second from all its repairers together (economy.js), and the Workshop's own field repairs
// (buildings.js) wait until it is no longer under attack. Repairs slow a breach, never stop it.
export const REPAIR_UNDER_ATTACK_MAX_PER_SEC = 6;
export const recentlyHit = (w, s, ticks) => w.tick - (s.lastHitTick ?? -100000) < ticks;
