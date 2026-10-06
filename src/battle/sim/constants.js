// src/battle/sim/constants.js
// Units used throughout the tactical sim (Tactical Battles plan §4.3, §8.1):
//   positions are integers in Q8 fixed point — 1 map tile = 256 units — so movement never
//   accumulates floating-point drift between devices; time is integer ticks at TICK_HZ.
export const TICK_HZ = 20;
export const Q = 256;                               // units per tile
export const BATTLE_LIMIT_TICKS = 6 * 60 * TICK_HZ; // the default clock (older setups); the defender holds if it runs out
// Adaptive clocks (setup.limitTicks): a field battle is a fast, decisive 5:00; a fortified siege gets
// 7:30 so siege engines have time to breach. The longest possible battle, for replay validation:
export const FIELD_BATTLE_TICKS = 5 * 60 * TICK_HZ;
export const SIEGE_BATTLE_TICKS = 7.5 * 60 * TICK_HZ;
// A battle with the economy (phase R1) runs the master plan's clocks (6.1): 15 minutes in the field,
// 30 for a city assault.
export const ECONOMY_FIELD_TICKS = 15 * 60 * TICK_HZ;
export const ECONOMY_SIEGE_TICKS = 30 * 60 * TICK_HZ;
export const MAX_BATTLE_TICKS = ECONOMY_SIEGE_TICKS;
export const battleLimitTicks = (setup) => setup?.limitTicks || BATTLE_LIMIT_TICKS;
export const SQUAD_RADIUS = 154;                    // ~0.6 tile
export const SIDE_ATTACKER = 0;
export const SIDE_DEFENDER = 1;
export const secondsToTicks = (s) => Math.round(s * TICK_HZ);
export const tilesPerSecToQ = (t) => Math.round((t * Q) / TICK_HZ);
