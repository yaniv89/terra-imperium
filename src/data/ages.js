// src/data/ages.js
// The five ages spanning Terra Imperium's full timeline (2000 BCE - 2300 CE), the game-speed
// years-per-turn table, and the calendar <-> age helpers everything else (resources, buildings,
// units, tech) gates against — the same role src/data/techTree.js's yearAvailable plays today,
// generalized to a whole calendar instead of one campaign's fixed 1870-2150 span.

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
    unlocksResources: ['copper']
  },
  classical: {
    id: 'classical',
    name: 'Classical Age',
    startYear: -800,
    endYear: 500,
    unlocksResources: ['iron']
  },
  kingdoms: {
    id: 'kingdoms',
    name: 'Age of Kingdoms',
    startYear: 500,
    endYear: 1500,
    unlocksResources: []
  },
  gunpowder: {
    id: 'gunpowder',
    name: 'Age of Gunpowder',
    startYear: 1500,
    endYear: 1900,
    unlocksResources: []
  },
  modern: {
    id: 'modern',
    name: 'Modern Age',
    startYear: 1900,
    endYear: 2300,
    unlocksResources: ['oil']
  }
};

export const getAgeIndex = (ageId) => AGE_ORDER.indexOf(ageId);

// The age the calendar alone puts you in, independent of any nation's own tech progress. Every
// nation is at least this age — it's a floor, not something you have to research into.
export const getCalendarAgeId = (year) => {
  const clamped = Math.max(START_YEAR, Math.min(year, END_YEAR));
  const found = AGE_ORDER.find(id => clamped >= AGES[id].startYear && clamped < AGES[id].endYear);
  return found || 'modern'; // END_YEAR itself is the exclusive upper bound of 'modern' above
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
// ahead of calendar. Feeds the "backward" penalty described in plan §2 (higher tech costs, combat
// malus vs. advanced units) via getAgesBehindCombatMultiplier/getAgesBehindResearchCostMultiplier
// below — a nation that never researches falls further behind every turn the calendar advances
// without it, and previously paid nothing for that at all.
export const getAgesBehind = (calendarAgeId, techAgeId) => {
  const calendarIdx = getAgeIndex(calendarAgeId);
  const techIdx = getAgeIndex(techAgeId);
  if (calendarIdx === -1 || techIdx === -1) return 0;
  return Math.max(0, calendarIdx - techIdx);
};

// Combat output multiplier for a nation fighting while behind the calendar — obsolete doctrine
// and equipment, represented as a flat malus on every hit that side lands, regardless of which
// literal unit classes it fields (src/engine/battle.js's attackerPenaltyMultiplier). -15% per age
// behind, floored at 40% so falling behind is a real threat without making combat pointless.
const AGES_BEHIND_COMBAT_PENALTY_PER_AGE = 0.15;
const AGES_BEHIND_COMBAT_MULTIPLIER_FLOOR = 0.4;
export const getAgesBehindCombatMultiplier = (agesBehind) =>
  Math.max(AGES_BEHIND_COMBAT_MULTIPLIER_FLOOR, 1 - agesBehind * AGES_BEHIND_COMBAT_PENALTY_PER_AGE);

// Research cost multiplier for a nation trying to catch up from behind — the further behind, the
// more it costs to research the SAME tech, so falling behind compounds instead of being a free
// pause button. +30% per age behind, uncapped (unlike the combat floor, there's no reason to cap
// how expensive catching up from a long neglect should get).
const AGES_BEHIND_RESEARCH_COST_PER_AGE = 0.3;
export const getAgesBehindResearchCostMultiplier = (agesBehind) => 1 + agesBehind * AGES_BEHIND_RESEARCH_COST_PER_AGE;

// ============ GAME SPEED ============

export const GAME_SPEEDS = {
  fast: { id: 'fast', name: 'Fast', multiplier: 2 },
  normal: { id: 'normal', name: 'Normal', multiplier: 1 },
  marathon: { id: 'marathon', name: 'Marathon', multiplier: 0.5 }
};

// Base (Normal-speed) years advanced per turn, shrinking as history speeds up. Speed is a flat
// multiplier on top of this — see plan §3.
const BASE_YEARS_PER_TURN = {
  bronze: 40,
  classical: 20,
  kingdoms: 10,
  gunpowder: 4,
  modern: 2
};

export const getYearsPerTurn = (ageId, speedId) => {
  const base = BASE_YEARS_PER_TURN[ageId] ?? BASE_YEARS_PER_TURN.modern;
  const speed = GAME_SPEEDS[speedId] ?? GAME_SPEEDS.normal;
  return base * speed.multiplier;
};
