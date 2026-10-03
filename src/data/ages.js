// src/data/ages.js
// The age registry (plans/eras-origins-and-future.md, Phase 0): the ages spanning Terra Imperium's
// timeline, the game-speed years-per-turn table, and the calendar <-> age helpers everything else
// (resources, buildings, units, tech) gates against. Code outside this file never names the first
// or last age or compares age ids by hand: it uses FIRST_AGE_ID / LAST_AGE_ID, isAgeAtLeast and
// isAgeBefore, so adding an age is a data change plus the per-age tables that
// src/data/ageRegistry.test.js lists.

export const START_YEAR = -2000; // 2000 BCE
export const END_YEAR = 2300;

// Ordered oldest -> newest. Index in this array IS the age's rank, used for age-ahead/behind math.
export const AGE_ORDER = ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'];

// Year ranges deliberately non-Euro-centric — "Age of Kingdoms" fits Mali, Khmer, Song and the
// Abbasids equally, not just European feudalism.
export const AGES = {
  bronze: {
    id: 'bronze',
    name: 'Bronze Age',
    startYear: -2000,
    endYear: -800,
    unlocksResources: ['copper'],
    // The unit roster's stats and production cost multiplier for this age (src/data/unitClasses.js,
    // src/engine/world/cities.js): explicit per age, not derived from the age's position.
    unitAttack: 10,
    unitDefense: 8,
    unitCostMult: 1
  },
  classical: {
    id: 'classical',
    name: 'Classical Age',
    startYear: -800,
    endYear: 500,
    unlocksResources: ['iron'],
    unitAttack: 18,
    unitDefense: 14,
    unitCostMult: 1.6
  },
  kingdoms: {
    id: 'kingdoms',
    name: 'Age of Kingdoms',
    startYear: 500,
    endYear: 1500,
    unlocksResources: [],
    unitAttack: 26,
    unitDefense: 20,
    unitCostMult: 2.2
  },
  gunpowder: {
    id: 'gunpowder',
    name: 'Age of Gunpowder',
    startYear: 1500,
    endYear: 1900,
    unlocksResources: [],
    unitAttack: 34,
    unitDefense: 26,
    unitCostMult: 2.8000000000000003 // 1 + 0.6 x 3 as the old formula computed it, kept bit-identical
  },
  modern: {
    id: 'modern',
    name: 'Modern Age',
    startYear: 1900,
    endYear: 2300,
    unlocksResources: ['oil'],
    unitAttack: 42,
    unitDefense: 32,
    unitCostMult: 3.4
  }
};

export const FIRST_AGE_ID = AGE_ORDER[0];
export const LAST_AGE_ID = AGE_ORDER[AGE_ORDER.length - 1];

export const getAgeIndex = (ageId) => AGE_ORDER.indexOf(ageId);
/** True when `ageId` is `minAgeId` or later. An unknown age is never at least anything. */
export const isAgeAtLeast = (ageId, minAgeId) => { const i = getAgeIndex(ageId); return i !== -1 && i >= getAgeIndex(minAgeId); };
/** True when `ageId` comes strictly before `ageIdLimit`. An unknown age is never before anything. */
export const isAgeBefore = (ageId, ageIdLimit) => { const i = getAgeIndex(ageId); return i !== -1 && i < getAgeIndex(ageIdLimit); };
/** Every age from `fromAgeId` to the last, in order. */
export const agesFrom = (fromAgeId) => AGE_ORDER.slice(Math.max(0, getAgeIndex(fromAgeId)));
/** The next age after `ageId`, or null at the last one. */
export const nextAgeId = (ageId) => AGE_ORDER[getAgeIndex(ageId) + 1] ?? null;

/** A calendar year as the player reads it: negative years are BCE. */
export const formatYear = (year) => (year < 0 ? `${-year} BCE` : `${year} CE`);

// The age the calendar alone puts you in, independent of any nation's own tech progress. Every
// nation is at least this age — it's a floor, not something you have to research into.
export const getCalendarAgeId = (year) => {
  const clamped = Math.max(START_YEAR, Math.min(year, END_YEAR));
  const found = AGE_ORDER.find(id => clamped >= AGES[id].startYear && clamped < AGES[id].endYear);
  return found || LAST_AGE_ID; // END_YEAR itself is the exclusive upper bound of the last age
};

// A nation's effective age = max(calendar floor, its own tech-earned age) — see plan §2. Rushing
// ahead of the calendar is capped at one full age (research gating is what actually enforces the
// cap when spending tech points; this clamp is the defensive backstop so a stale/corrupt techAge
// can never grant more than one age of unearned access).
export const getEffectiveAgeIndex = (calendarAgeId, techAgeId) => {
  const calendarIdx = getAgeIndex(calendarAgeId);
  const techIdx = getAgeIndex(techAgeId);
  if (calendarIdx === -1) return 0;
  if (techIdx === -1) return calendarIdx;
  return Math.max(calendarIdx, Math.min(techIdx, calendarIdx + 1));
};

export const getEffectiveAgeId = (calendarAgeId, techAgeId) => AGE_ORDER[getEffectiveAgeIndex(calendarAgeId, techAgeId)];

// How many ages behind the calendar a nation's own tech-earned age has fallen. 0 means at or
// ahead of calendar. Feeds the "backward" penalty described in plan §2 (higher tech costs) via
// getAgesBehindResearchCostMultiplier below — a nation that never researches falls further behind
// every turn the calendar advances without it, and previously paid nothing for that at all.
//
// Plan §M14 removes this file's own former combat-side penalty (getAgesBehindCombatMultiplier,
// -15%/age behind, floored at 40%) — it only ever penalized ONE side and double-counted against
// src/data/unitClasses.js's roster stats once those got wired into combat. A real two-sided
// comparison (getRosterCombatMultiplier there) replaces it: two nations at the SAME age always net
// to a neutral 1.0, whichever age that is, and an age GAP swings the multiplier in both directions
// at once rather than only ever punishing whoever fell behind.
export const getAgesBehind = (calendarAgeId, techAgeId) => {
  const calendarIdx = getAgeIndex(calendarAgeId);
  const techIdx = getAgeIndex(techAgeId);
  if (calendarIdx === -1 || techIdx === -1) return 0;
  return Math.max(0, calendarIdx - techIdx);
};

// Research cost multiplier for a nation trying to catch up from behind — the further behind, the
// more it costs to research the SAME tech, so falling behind compounds instead of being a free
// pause button. +30% per age behind, uncapped (unlike the combat floor, there's no reason to cap
// how expensive catching up from a long neglect should get).
const AGES_BEHIND_RESEARCH_COST_PER_AGE = 0.3;
export const getAgesBehindResearchCostMultiplier = (agesBehind) => 1 + agesBehind * AGES_BEHIND_RESEARCH_COST_PER_AGE;

// ============ GAME SPEED ============

// The speed table (plans/playtest-1.md P3): the years each turn advances, by age and speed. The
// pace of play follows the calendar, not the turn: research, production and growth cost
// REFERENCE_YEARS[age] / years[age] times their base, so a Bronze tech, a granary or a size of
// growth takes the same span of history at every speed (the balance was tuned at the reference
// table, the old Normal). `turns` is the length of a full game, 2000 BCE to 2300 CE.
export const REFERENCE_YEARS = { bronze: 40, classical: 20, kingdoms: 10, gunpowder: 4, modern: 2 };
export const GAME_SPEEDS = {
  fast: { id: 'fast', name: 'Fast', years: { bronze: 50, classical: 25, kingdoms: 12, gunpowder: 5, modern: 2 }, turns: 440, blurb: 'About 440 turns. 50 years a turn in the Bronze Age.' },
  normal: { id: 'normal', name: 'Normal', years: { bronze: 25, classical: 12, kingdoms: 6, gunpowder: 2, modern: 1 }, turns: 920, blurb: 'About 920 turns. 25 years a turn in the Bronze Age.' },
  marathon: { id: 'marathon', name: 'Marathon', years: { bronze: 10, classical: 5, kingdoms: 3, gunpowder: 1, modern: 1 }, turns: 1510, blurb: 'About 1,500 turns. 10 years a turn in the Bronze Age.' }
};

export const getYearsPerTurn = (ageId, speedId) => {
  const speed = GAME_SPEEDS[speedId] ?? GAME_SPEEDS.normal;
  return speed.years[ageId] ?? speed.years[LAST_AGE_ID];
};
/** The cost multiplier of a speed on research, production and growth in an age: the reference
 * years per turn over this speed's, so the pace per year of history is the same at every speed. */
export const speedCostMult = (speedId, ageId = FIRST_AGE_ID) => {
  const age = REFERENCE_YEARS[ageId] != null ? ageId : LAST_AGE_ID;
  return REFERENCE_YEARS[age] / getYearsPerTurn(age, speedId);
};
/** The turns a full game takes at a speed, from the table itself. */
export const gameLengthTurns = (speedId) => AGE_ORDER.reduce((sum, id) => sum + Math.ceil((AGES[id].endYear - AGES[id].startYear) / getYearsPerTurn(id, speedId)), 0);
