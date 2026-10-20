// src/engine/displayYear.js
// The year on screen is a label, never a rule (eight-ages plan KTD3). It comes from the player's
// own progress through its age: the age's nominal range (src/data/ages.js startYear to endYear)
// interpolated by the share of that age's 10 techs the player has researched:
//
//   year = start + (end - start) x min(1, researched in the age / 10)
//
// Research is never lost and the age only rises, so the label never goes down. resolveTurn writes
// it to state.year once a turn for saves, logs and reports; no rule reads state.year (the purity
// test in ruleYearPurity.test.js).
import { AGES } from '../data/ages';
import { getTechsForAge } from '../data/techTree';
import { ageOf, getResearched } from './nationState';

export const AGE_TECH_COUNT = 10;

/** The label year for a nation at age `ageId` that has researched `researched` (an array or Set). */
export const labelYear = (ageId, researched) => {
  const age = AGES[ageId];
  if (!age) return null;
  const known = researched instanceof Set ? researched : new Set(researched);
  const done = getTechsForAge(ageId).filter((t) => known.has(t.id)).length;
  return Math.round(age.startYear + (age.endYear - age.startYear) * Math.min(1, done / AGE_TECH_COUNT));
};

/** The player's year label. */
export const displayYear = (state) => labelYear(ageOf(state, state.playerNationId), getResearched(state, state.playerNationId));
