// src/battle/sim/constants.js
// Units used throughout the tactical sim (Tactical Battles plan §4.3, §8.1):
//   positions are integers in Q8 fixed point — 1 map tile = 256 units — so movement never
//   accumulates floating-point drift between devices; time is integer ticks at TICK_HZ.
export const TICK_HZ = 20;
export const Q = 256;                               // units per tile
export const BATTLE_LIMIT_TICKS = 6 * 60 * TICK_HZ; // 6 minutes; the defender holds if it runs out
export const SQUAD_RADIUS = 154;                    // ~0.6 tile
export const SIDE_ATTACKER = 0;
export const SIDE_DEFENDER = 1;
export const secondsToTicks = (s) => Math.round(s * TICK_HZ);
export const tilesPerSecToQ = (t) => Math.round((t * Q) / TICK_HZ);
