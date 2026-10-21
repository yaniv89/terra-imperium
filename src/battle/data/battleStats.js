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
  // The battle economy's worker (phase R1, src/battle/sim/economy.js): one figure, gathers, builds and
  // repairs, never fights; a soft target.
  worker: { speed: T(1.7), range: 0, minRange: 0, sight: 6, attackTicks: 0, soldiers: 1, worker: true },
  // Naval squads never take part in a land battle (invasions only take land units); listed so a
  // stray naval unit can't crash a lookup.
  naval: { speed: 0, range: 0, minRange: 0, sight: 6, attackTicks: 0, soldiers: 2 }
};

// Gunpowder and Modern turn the melee lines into shooters; Modern cavalry are tanks and Modern
// support is an Anti-Air battery (it only ever targets aircraft).
export const AGE_OVERRIDES = {
  // Stone (U37): no drilled ranks, so no flank or rear bonus for its blows (`noFormation`); Hunters
  // shoot short and fast; a Warband loses heart faster (morale only, a soft penalty: the player's
  // side turns Shaken, never routs, morale.js).
  stone: {
    infantry: { noFormation: true, moraleLoss: 1.25 },
    ranged: { noFormation: true, range: 5 * Q, attackTicks: S(1.0) },
    siege: { noFormation: true },
    support: { noFormation: true }
  },
  gunpowder: {
    infantry: { range: 4 * Q, melee: false, attackTicks: S(1.6) },
    cavalry: { speed: T(3.0) }
  },
  // Modern (U50): Machine Gun Teams suppress what they hit (`suppress` ticks: it fires slower,
  // sim/effects.js attackRateMult).
  modern: {
    infantry: { range: 5 * Q, melee: false, speed: T(1.9), attackTicks: S(1.0) },
    cavalry: { range: 6 * Q, melee: false, speed: T(3.0), soldiers: 4, attackTicks: S(1.8), charge: false },
    ranged: { range: 9 * Q, attackTicks: S(2.0), suppress: S(2) },
    support: { range: 8 * Q, attackTicks: S(1.0), airOnly: true, supplyAura: 0 }
  }
};
// Information (U50): guided weapons land their first shot harder (`precision`, sim/combat.js);
// Strike Drones are a swarm of small, quick, fragile craft; a SAM Battery reaches further.
AGE_OVERRIDES.information = {
  ...AGE_OVERRIDES.modern,
  ranged: { range: 9 * Q, attackTicks: S(2.0), precision: 1.5 },
  siege: { precision: 1.5 },
  air: { speed: T(5.5), range: 5 * Q, attackTicks: S(1.0), soldiers: 6, moraleLoss: 1.25 },
  support: { ...AGE_OVERRIDES.modern.support, range: 10 * Q }
};
// Future (U66): shields soak hits first and come back out of combat (`shield`, percent of full
// strength, sim/combat.js); Hover Tanks ignore the ground's drag (`hover`, sim/movement.js);
// Railgun Teams' shots go through to the squad behind (`pierce`, percent); Plasma Artillery and the
// Shield Projector's point-defence lasers are beams (`beam`: drawn as a line, no projectile).
AGE_OVERRIDES.future = {
  ...AGE_OVERRIDES.information,
  infantry: { ...AGE_OVERRIDES.information.infantry, speed: T(2.0), shield: 20 },
  cavalry: { ...AGE_OVERRIDES.information.cavalry, speed: T(3.6), hover: true, shield: 20 },
  ranged: { range: 10 * Q, attackTicks: S(2.2), pierce: 30 },
  siege: { beam: true },
  air: { ...AGE_OVERRIDES.information.air, soldiers: 8 },
  support: { ...AGE_OVERRIDES.information.support, beam: true, shield: 40 }
};

export const getBattleStats = (classId, ageId) => ({ ...(CLASS_BASE[classId] || CLASS_BASE.infantry), ...(AGE_OVERRIDES[ageId]?.[classId] || {}) });

// Ships in a sea battle (plans/civ-map-rework.md D5b), by naval line (navalLines.js) and age: a
// squad is one ship. Oared and sailing ships ram and board (melee); gunpowder broadsides and
// modern guns fire at range. A transport fights badly and a raider lightly through the line's
// combat multiplier in battle.js, not here. Ships never capture anything.
const SHIP = { minRange: 0, soldiers: 1, canCapture: false, ship: true };
export const NAVAL_LINE_STATS = {
  warship: {
    stone: { ...SHIP, speed: T(1.8), range: MELEE_REACH, sight: 7, attackTicks: S(1.3), melee: true },
    bronze: { ...SHIP, speed: T(2.0), range: MELEE_REACH, sight: 8, attackTicks: S(1.2), melee: true, charge: true },
    classical: { ...SHIP, speed: T(2.3), range: MELEE_REACH, sight: 8, attackTicks: S(1.1), melee: true, charge: true },
    kingdoms: { ...SHIP, speed: T(2.0), range: 3 * Q, sight: 9, attackTicks: S(1.4), melee: false },
    gunpowder: { ...SHIP, speed: T(2.4), range: 6 * Q, sight: 10, attackTicks: S(2.0), melee: false },
    modern: { ...SHIP, speed: T(4.0), range: 10 * Q, sight: 12, attackTicks: S(1.6), melee: false },
    information: { ...SHIP, speed: T(4.0), range: 10 * Q, sight: 12, attackTicks: S(1.6), melee: false },
    future: { ...SHIP, speed: T(4.0), range: 10 * Q, sight: 12, attackTicks: S(1.6), melee: false }
  },
  transport: {
    stone: { ...SHIP, speed: T(1.6), range: MELEE_REACH, sight: 6, attackTicks: S(1.5), melee: true },
    bronze: { ...SHIP, speed: T(1.8), range: MELEE_REACH, sight: 7, attackTicks: S(1.4), melee: true },
    classical: { ...SHIP, speed: T(2.0), range: MELEE_REACH, sight: 7, attackTicks: S(1.4), melee: true },
    kingdoms: { ...SHIP, speed: T(1.8), range: 2 * Q, sight: 8, attackTicks: S(1.6), melee: false },
    gunpowder: { ...SHIP, speed: T(2.0), range: 4 * Q, sight: 8, attackTicks: S(2.4), melee: false },
    modern: { ...SHIP, speed: T(3.0), range: 5 * Q, sight: 9, attackTicks: S(2.0), melee: false },
    information: { ...SHIP, speed: T(3.0), range: 5 * Q, sight: 9, attackTicks: S(2.0), melee: false },
    future: { ...SHIP, speed: T(3.0), range: 5 * Q, sight: 9, attackTicks: S(2.0), melee: false }
  },
  raider: {
    stone: { ...SHIP, speed: T(2.4), range: MELEE_REACH, sight: 9, attackTicks: S(1.2), melee: true },
    bronze: { ...SHIP, speed: T(2.8), range: MELEE_REACH, sight: 10, attackTicks: S(1.1), melee: true, charge: true },
    classical: { ...SHIP, speed: T(2.8), range: MELEE_REACH, sight: 10, attackTicks: S(1.1), melee: true, charge: true },
    kingdoms: { ...SHIP, speed: T(2.6), range: 3 * Q, sight: 11, attackTicks: S(1.3), melee: false },
    gunpowder: { ...SHIP, speed: T(3.0), range: 5 * Q, sight: 12, attackTicks: S(1.8), melee: false },
    modern: { ...SHIP, speed: T(3.4), range: 8 * Q, sight: 13, attackTicks: S(2.2), melee: false },
    information: { ...SHIP, speed: T(3.4), range: 8 * Q, sight: 13, attackTicks: S(2.2), melee: false },
    future: { ...SHIP, speed: T(3.4), range: 8 * Q, sight: 13, attackTicks: S(2.2), melee: false }
  },
  carrier: {
    modern: { ...SHIP, speed: T(3.0), range: 11 * Q, sight: 14, attackTicks: S(2.4), melee: false },
    information: { ...SHIP, speed: T(3.0), range: 11 * Q, sight: 14, attackTicks: S(2.4), melee: false },
    future: { ...SHIP, speed: T(3.0), range: 11 * Q, sight: 14, attackTicks: S(2.4), melee: false }
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
