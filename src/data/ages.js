// src/data/ages.js
// The age registry (plans/2026-10-20-001-feat-eight-ages-plan.md U1, KTD12): the ages, each
// age's nominal year range (a display label only: no rule reads the year, KTD3), unit power and
// cost, and the game-speed cost table. A nation's age is its research age (ageOf in
// src/engine/nationState.js). Code outside this file never names the first or last age or compares
// age ids by hand: it uses FIRST_AGE_ID / LAST_AGE_ID, isAgeAtLeast, isAgeBefore, agesFrom and
// nextAgeId, so adding an age is a data change plus the per-age tables keyed by age id.

export const START_YEAR = -5000; // 5000 BCE, the Stone Age's first label (U22)
export const END_YEAR = 2500; // the Future's last label (U64)

// Ordered oldest -> newest. Index in this array IS the age's rank, used for age-ahead/behind math.
export const AGE_ORDER = ['stone', 'bronze', 'classical', 'kingdoms', 'gunpowder', 'modern', 'information', 'future'];

// Year ranges deliberately non-Euro-centric — "Age of Kingdoms" fits Mali, Khmer, Song and the
// Abbasids equally, not just European feudalism.
export const AGES = {
  // Every game starts here (U22, R10). Power from KTD21; the unit cost multiplier is Bronze's until
  // the Stone roster (U37) is designed.
  stone: {
    id: 'stone',
    name: 'Stone Age',
    startYear: -5000,
    endYear: -2000,
    unlocksResources: ['copper'],
    power: { attack: 7, defense: 6 },
    unitCostMult: 1,
    peopleShown: 0.01
  },
  bronze: {
    id: 'bronze',
    name: 'Bronze Age',
    startYear: -2000,
    endYear: -800,
    unlocksResources: [],
    // The unit roster's attack and defence (src/data/unitClasses.js) and a unit's production cost
    // multiplier (src/engine/world/cities.js) in this age: explicit per age, not derived from the
    // age's position, so a new age can slot in anywhere.
    power: { attack: 10, defense: 8 },
    unitCostMult: 1,
    peopleShown: 0.05
  },
  classical: {
    id: 'classical',
    name: 'Classical Age',
    startYear: -800,
    endYear: 500,
    unlocksResources: ['iron'],
    power: { attack: 18, defense: 14 },
    unitCostMult: 1.6,
    peopleShown: 0.15
  },
  kingdoms: {
    id: 'kingdoms',
    name: 'Age of Kingdoms',
    startYear: 500,
    endYear: 1500,
    unlocksResources: [],
    power: { attack: 26, defense: 20 },
    unitCostMult: 2.2,
    peopleShown: 0.3
  },
  gunpowder: {
    id: 'gunpowder',
    name: 'Age of Gunpowder',
    startYear: 1500,
    endYear: 1900,
    unlocksResources: [],
    power: { attack: 34, defense: 26 },
    unitCostMult: 2.8,
    peopleShown: 0.6
  },
  modern: {
    id: 'modern',
    name: 'Modern Age',
    startYear: 1900,
    endYear: 1990,
    unlocksResources: ['oil'],
    power: { attack: 42, defense: 32 },
    unitCostMult: 3.4,
    peopleShown: 1
  },
  // Phase D (U48); power from KTD21.
  information: {
    id: 'information',
    name: 'Information Age',
    startYear: 1990,
    endYear: 2100,
    unlocksResources: [],
    power: { attack: 52, defense: 40 },
    unitCostMult: 4,
    peopleShown: 1
  },
  // Phase E (U64): the last age; finishing its techs is the final goal (src/engine/ending.js).
  future: {
    id: 'future',
    name: 'Future Age',
    startYear: 2100,
    endYear: 2500,
    unlocksResources: [],
    power: { attack: 64, defense: 48 },
    unitCostMult: 4.6,
    peopleShown: 1
  }
};

// Display only: the people a city SHOWS in this age (a Stone size 7 reads as a village, about
// 2,300). Rules keep the unscaled population.js numbers.
export const shownPeople = (people, ageId) => Math.round((people || 0) * (AGES[ageId]?.peopleShown ?? 1));

export const FIRST_AGE_ID = AGE_ORDER[0];
export const LAST_AGE_ID = AGE_ORDER[AGE_ORDER.length - 1];

export const getAgeIndex = (ageId) => AGE_ORDER.indexOf(ageId);
/** True when `ageId` is `minAgeId` or later. An unknown age is never at least anything. */
export const isAgeAtLeast = (ageId, minAgeId) => { const i = getAgeIndex(ageId); return i !== -1 && i >= getAgeIndex(minAgeId); };
/** True when `ageId` comes strictly before `limitAgeId`. An unknown age is never before anything. */
export const isAgeBefore = (ageId, limitAgeId) => { const i = getAgeIndex(ageId); return i !== -1 && i < getAgeIndex(limitAgeId); };
/** Every age from `fromAgeId` to the last, in order. */
export const agesFrom = (fromAgeId) => AGE_ORDER.slice(Math.max(0, getAgeIndex(fromAgeId)));
/** Steps from the Bronze Age, for per-age formulas tuned on the five ages from Bronze (prices, caps):
 * the Stone Age counts as Bronze there until its own values are designed. */
export const ageStep = (ageId) => Math.max(0, getAgeIndex(ageId) - getAgeIndex('bronze'));
/** Combat edge per age of difference (Civ's "flat points, exponential effect"): one fixed step,
 * x1.4 a step, so every pair of neighbouring ages has the same edge, and 3 or more ages ahead
 * caps at x2.744. Tuned with battle-lab parity and balance-sim (AoE and Civ report, rank 3). */
export const AGE_GAP_MULT = [1, 1.4, 1.96, 2.744];
/** The damage multiplier for a side of `ageId` against one of `otherAgeId` (behind: the reciprocal).
 * An unknown age counts as the first. */
export const ageGapMult = (ageId, otherAgeId) => {
  const gap = Math.max(0, getAgeIndex(ageId)) - Math.max(0, getAgeIndex(otherAgeId));
  const m = AGE_GAP_MULT[Math.min(AGE_GAP_MULT.length - 1, Math.abs(gap))];
  return gap < 0 ? 1 / m : m;
};
/** The age after `ageId`, or null at the last one (and for an unknown age). */
export const nextAgeId = (ageId) => { const i = getAgeIndex(ageId); return i === -1 ? null : AGE_ORDER[i + 1] ?? null; };

/** A calendar year in English: negative years are BCE (the UI's localized one is src/i18n/core.js). */
export const formatYear = (year) => (year < 0 ? `${-year} BCE` : `${year} CE`);

/**
 * The age whose art file stands in for `ageId` (plan KTD14), or null for the procedural model.
 * `available` says which ages have a file: a Set or array of age ids, a predicate, or an object
 * { ageId: kind } (kind 'foot', 'mounted', 'machine' or 'air'; true for buildings).
 * - Buildings and close-view art (no `kind`): the exact age, else the nearest earlier age with a
 *   file, else the nearest later one.
 * - Units (`kind` given): the exact age, else the nearest earlier age with a file only when that
 *   file is the same kind (a Modern tank never resolves to a Gunpowder horse); never a later age.
 */
export const artAgeFor = (available, ageId, { kind = null } = {}) => {
  const i = getAgeIndex(ageId);
  if (i === -1) return null;
  const fileOf = typeof available === 'function' ? available
    : available instanceof Set ? (a) => available.has(a)
      : Array.isArray(available) ? (a) => available.includes(a)
        : (a) => available?.[a];
  if (fileOf(ageId)) return ageId;
  for (let k = i - 1; k >= 0; k--) {
    const file = fileOf(AGE_ORDER[k]);
    if (file) return kind == null || file === kind ? AGE_ORDER[k] : null;
  }
  if (kind != null) return null;
  for (let k = i + 1; k < AGE_ORDER.length; k++) if (fileOf(AGE_ORDER[k])) return AGE_ORDER[k];
  return null;
};

// A nation's age is its research age only (ageOf in src/engine/nationState.js, eight-ages plan
// KTD1): the old calendar floor and one-age cap (getEffectiveAgeId) are gone.

// Falling behind costs nothing extra (KTD5): the old ages-behind research penalty is gone; a
// laggard catches up through the diffusion discount instead (src/engine/techDiffusion.js CATCHUP_MAX).

// ============ GAME SPEED ============

// The speed table (eight-ages plan KTD9). There are no years per turn and no rule reads the year:
// a speed is a cost multiplier per age on research, production and growth, keyed by the PAYING
// nation's own age, and a turn limit that ends the game. Normal keeps the values the old calendar
// gave Bronze to Modern (the reference years per turn over the speed's: Bronze 40/25). Fast and
// Marathon were refit to Normal's shape (report rank 4, scripts/research-pace.mjs, seeds 11 to 15):
// Marathon's Modern was 2, left from the calendar, so the Modern age lasted about 10 turns. `turnLimit` is the speed's length of a full game (src/engine/ending.js).
export const GAME_SPEEDS = {
  fast: { id: 'fast', name: 'Fast', costMult: { stone: 0.8, bronze: 0.8, classical: 0.8, kingdoms: 1, gunpowder: 1.1, modern: 0.8, information: 1, future: 1 }, turnLimit: 440, blurb: 'About 440 turns.' },
  normal: { id: 'normal', name: 'Normal', costMult: { stone: 1.6, bronze: 1.6, classical: 20 / 12, kingdoms: 10 / 6, gunpowder: 2, modern: 2, information: 2, future: 2 }, turnLimit: 923, blurb: 'About 920 turns.' },
  marathon: { id: 'marathon', name: 'Marathon', costMult: { stone: 2, bronze: 3, classical: 2.6, kingdoms: 4, gunpowder: 4.5, modern: 3, information: 3, future: 3 }, turnLimit: 1514, blurb: 'About 1,500 turns.' }
};

const inTests = typeof process !== 'undefined' && !!process.env?.VITEST;
/** The cost multiplier of a speed on research, production and growth for a payer in `ageId`. An
 * unknown age is a bug: it throws under the tests and reads the first age otherwise. */
export const speedCostMult = (speedId, ageId = FIRST_AGE_ID) => {
  const table = (GAME_SPEEDS[speedId] ?? GAME_SPEEDS.normal).costMult;
  if (table[ageId] == null) {
    if (inTests) throw new Error(`speedCostMult: unknown age ${ageId}`);
    return table[FIRST_AGE_ID];
  }
  return table[ageId];
};
/** The turn that ends a game at this speed (KTD3). */
export const speedTurnLimit = (speedId) => (GAME_SPEEDS[speedId] ?? GAME_SPEEDS.normal).turnLimit;
/** Training has its own speed percentage, as in Civilization (Civ 4 and 5 Marathon: buildings,
 * research and growth at 300%, units at 200%): armies march the same distance a turn at every
 * speed, so on a slower game a unit that cost the full multiplier would arrive long after the war
 * it was ordered for. Up to Normal training follows the cost multiplier; past it, only
 * TRAIN_SPEED_SHARE of the extra (Marathon Bronze: buildings 4.0, units and settlers 2.8, which is
 * 2.5 and 1.75 times Normal, close to Civ's 3 and 2). Units, settlers and army orders use it
 * (cities.js productionCost). Provisional share, playtest audits I024. */
export const TRAIN_SPEED_SHARE = 0.5;
export const speedTrainMult = (speedId, ageId = FIRST_AGE_ID) => {
  const mult = speedCostMult(speedId, ageId);
  const normal = speedCostMult('normal', ageId);
  return mult <= normal ? mult : normal + (mult - normal) * TRAIN_SPEED_SHARE;
};
/** Building on a slow game (I029, lane W6): Marathon's first hundred turns were dead, a granary or
 * a market took 20 to 40 turns in a young city while research kept the calendar. Buildings, wonders
 * and improvements now take BUILD_SPEED_SHARE of the extra over Normal, like training does
 * (TRAIN_SPEED_SHARE): Marathon Bronze 1.6 + 0.5 x 2.4 = 2.8 instead of 4.0. Normal and Fast are
 * unchanged (the multiplier is never raised). The argument is the speed's cost multiplier in that age. */
export const BUILD_SPEED_SHARE = 0.5;
export const buildSpeedMult = (mult, ageId = FIRST_AGE_ID) => {
  const normal = speedCostMult('normal', ageId);
  return mult <= normal ? mult : normal + (mult - normal) * BUILD_SPEED_SHARE;
};
/** A span given in reference turns (the table the balance was tuned at) as turns at this speed and
 * age, at least 1: cooldowns, truces and other waits then last the same span of history at every
 * speed (playtest audits, trap T11: never a hardcoded number of turns). Normal is 1.6 to 2 turns
 * per reference turn, Marathon 2 to 4. */
export const speedTurns = (refTurns, speedId, ageId = FIRST_AGE_ID) => Math.max(1, Math.round(refTurns * speedCostMult(speedId, ageId) - 1e-9));
