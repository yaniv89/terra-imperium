// src/battle/data/battleStats.js
// How each combat class moves and fights on the tactical battlefield (Tactical Battles plan §6).
// A squad's HIT POINTS are its strategic `strength`, so casualties map back 1:1; these stats only
// decide where it can be and how often it swings. How HARD it hits comes from battle.js's shared
// computeHitMultiplier (counters, promotions, generals, roster age, terrain) — never from here.
import { UNIT_ROSTER } from '../../data/unitClasses';
import { Q, secondsToTicks as S, tilesPerSecToQ as T } from '../sim/constants';

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

export const getSquadDisplayName = (classId, ageId) => UNIT_ROSTER[ageId]?.[classId]?.name || classId;

// How many soldiers to draw for a squad at a given strength (cosmetic only, never simulated).
export const getSoldierCount = (stats, strength, maxStrength) =>
  strength <= 0 ? 0 : Math.max(1, Math.ceil((stats.soldiers * strength) / Math.max(1, maxStrength)));
