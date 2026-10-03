// src/battle/data/battleStats.js
// How each combat class moves and fights on the tactical battlefield (Tactical Battles plan §6).
// A squad's HIT POINTS are its strategic `strength`, so casualties map back 1:1; these stats only
// decide where it can be and how often it swings. How HARD it hits comes from battle.js's shared
// computeHitMultiplier (counters, promotions, generals, roster age, terrain) — never from here.
import { UNIT_ROSTER } from '../../data/unitClasses';
import { Q, secondsToTicks as S, tilesPerSecToQ as T } from '../sim/constants';
import { AGE_ORDER } from '../../data/ages';

const MELEE_REACH = Math.round(0.9 * Q);

export const CLASS_BASE = {
  infantry: { speed: T(1.6), range: MELEE_REACH, minRange: 0, sight: 7, attackTicks: S(1.0), soldiers: 12, melee: true, canCapture: true },
  cavalry: { speed: T(3.2), range: MELEE_REACH, minRange: 0, sight: 10, attackTicks: S(1.0), soldiers: 8, melee: true, canCapture: true, charge: true },
  ranged: { speed: T(1.5), range: 7 * Q, minRange: 0, sight: 9, attackTicks: S(1.4), soldiers: 10 },
  siege: { speed: T(0.9), range: 11 * Q, minRange: 3 * Q, sight: 8, attackTicks: S(3.0), soldiers: 3, splash: Math.round(1.2 * Q), structureBonus: true },
  air: { speed: T(5.0), range: 4 * Q, minRange: 0, sight: 12, attackTicks: S(1.2), soldiers: 3, flying: true },
  support: { speed: T(1.4), range: 0, minRange: 0, sight: 7, attackTicks: 0, soldiers: 4, supplyAura: 6 * Q },
  // Naval squads never take part in a land battle (invasions only take land units); listed so a
  // stray naval unit can't crash a lookup.
  naval: { speed: 0, range: 0, minRange: 0, sight: 6, attackTicks: 0, soldiers: 2 }
};

// Gunpowder and Modern turn the melee lines into shooters; Modern cavalry are tanks and Modern
// support is an Anti-Air battery (it only ever targets aircraft).
export const AGE_OVERRIDES = {
  gunpowder: {
    infantry: { range: 4 * Q, melee: false, attackTicks: S(1.6) },
    cavalry: { speed: T(3.0) }
  },
  modern: {
    infantry: { range: 5 * Q, melee: false, speed: T(1.9), attackTicks: S(1.0) },
    cavalry: { range: 6 * Q, melee: false, speed: T(3.0), soldiers: 4, attackTicks: S(1.8), charge: false },
    ranged: { range: 9 * Q, attackTicks: S(2.0) },
    support: { range: 8 * Q, attackTicks: S(1.0), airOnly: true, supplyAura: 0 }
  }
};

export const getBattleStats = (classId, ageId) => ({ ...(CLASS_BASE[classId] || CLASS_BASE.infantry), ...(AGE_OVERRIDES[ageId]?.[classId] || {}) });

// Ships in a sea battle (plans/civ-map-rework.md D5b), by naval line (navalLines.js) and age: a
// squad is one ship. Oared and sailing ships ram and board (melee); gunpowder broadsides and
// modern guns fire at range. A transport fights badly and a raider lightly through the line's
// combat multiplier in battle.js, not here. Ships never capture anything.
const SHIP = { minRange: 0, soldiers: 1, canCapture: false, ship: true };
export const NAVAL_LINE_STATS = {
  warship: {
    bronze: { ...SHIP, speed: T(2.0), range: MELEE_REACH, sight: 8, attackTicks: S(1.2), melee: true, charge: true },
    classical: { ...SHIP, speed: T(2.3), range: MELEE_REACH, sight: 8, attackTicks: S(1.1), melee: true, charge: true },
    kingdoms: { ...SHIP, speed: T(2.0), range: 3 * Q, sight: 9, attackTicks: S(1.4), melee: false },
    gunpowder: { ...SHIP, speed: T(2.4), range: 6 * Q, sight: 10, attackTicks: S(2.0), melee: false },
    modern: { ...SHIP, speed: T(4.0), range: 10 * Q, sight: 12, attackTicks: S(1.6), melee: false }
  },
  transport: {
    bronze: { ...SHIP, speed: T(1.8), range: MELEE_REACH, sight: 7, attackTicks: S(1.4), melee: true },
    classical: { ...SHIP, speed: T(2.0), range: MELEE_REACH, sight: 7, attackTicks: S(1.4), melee: true },
    kingdoms: { ...SHIP, speed: T(1.8), range: 2 * Q, sight: 8, attackTicks: S(1.6), melee: false },
    gunpowder: { ...SHIP, speed: T(2.0), range: 4 * Q, sight: 8, attackTicks: S(2.4), melee: false },
    modern: { ...SHIP, speed: T(3.0), range: 5 * Q, sight: 9, attackTicks: S(2.0), melee: false }
  },
  raider: {
    bronze: { ...SHIP, speed: T(2.8), range: MELEE_REACH, sight: 10, attackTicks: S(1.1), melee: true, charge: true },
    classical: { ...SHIP, speed: T(2.8), range: MELEE_REACH, sight: 10, attackTicks: S(1.1), melee: true, charge: true },
    kingdoms: { ...SHIP, speed: T(2.6), range: 3 * Q, sight: 11, attackTicks: S(1.3), melee: false },
    gunpowder: { ...SHIP, speed: T(3.0), range: 5 * Q, sight: 12, attackTicks: S(1.8), melee: false },
    modern: { ...SHIP, speed: T(3.4), range: 8 * Q, sight: 13, attackTicks: S(2.2), melee: false }
  },
  carrier: {
    modern: { ...SHIP, speed: T(3.0), range: 11 * Q, sight: 14, attackTicks: S(2.4), melee: false }
  }
};
/** The stats of a ship squad: its line's entry for the age, else the nearest earlier age's. */
export const getNavalStats = (line, ageId) => {
  const byAge = NAVAL_LINE_STATS[line] || NAVAL_LINE_STATS.warship;
  const i = Math.max(0, AGE_ORDER.indexOf(ageId));
  for (let k = i; k >= 0; k--) if (byAge[AGE_ORDER[k]]) return byAge[AGE_ORDER[k]];
  return byAge[AGE_ORDER.find((a) => byAge[a])];
};
/** The stats of any strategic unit in a battle: a ship by its line, anything else by its class. */
export const getUnitBattleStats = (unit, ageId) => (unit?.classId === 'naval' ? getNavalStats(unit.navalLine && NAVAL_LINE_STATS[unit.navalLine] ? unit.navalLine : 'warship', ageId) : getBattleStats(unit?.classId, ageId));

export const getSquadDisplayName = (classId, ageId) => UNIT_ROSTER[ageId]?.[classId]?.name || classId;

// How many soldiers to draw for a squad at a given strength (cosmetic only, never simulated).
export const getSoldierCount = (stats, strength, maxStrength) =>
  strength <= 0 ? 0 : Math.max(1, Math.ceil((stats.soldiers * strength) / Math.max(1, maxStrength)));
