// src/engine/displayYear.js
// The year on screen is a label, never a rule (eight-ages plan KTD3). It comes from the player's
// own progress through its age: the age's nominal range (src/data/ages.js startYear to endYear)
// interpolated by the share of the way to the next age.
//
//   need  = TECH_AGE_ADVANCEMENT_THRESHOLD (the techs of the age that open the next), all ten in the last age
//   own   = the age's techs researched + the largest share done of one of its unresearched techs
//   left  = the previous age's techs researched past the threshold (leftovers finished after moving
//           on) + the largest share done of one of its unresearched techs
//   share = 1 - (1 - own / need) x (1 - left / AGE_TECH_COUNT)
//   year  = start + (end - start) x share
//
// So the four leftovers of the last age are four steps of ten and the age's own techs fill the
// rest. One tech's share (the furthest along) per age, so a switch never moves the label back and a
// boost on another tech moves it at most one step.
// The share is 1 exactly when the age's threshold tech is researched, which is the turn the next
// age begins at its start year: no jump at the age change. Every turn that puts science into a
// tech of this age or the last moves it a little (follow-up 18: it froze through a long tech, then
// jumped centuries at the age change). Research is never lost and the age only rises, so the label
// never goes down: shares are of a steady price (no cost modifiers or diffusion, research.js getResearchCost `steady`). resolveTurn writes it to state.year once a turn for saves, logs and reports; no
// rule reads state.year (the purity test in ruleYearPurity.test.js).
import { AGES, AGE_ORDER, LAST_AGE_ID, getAgeIndex } from '../data/ages';
import { getTechsForAge, TECH_AGE_ADVANCEMENT_THRESHOLD } from '../data/techTree';
import { ageOf, getResearched } from './nationState';
import { getResearchCost, openingCostMult } from './research';

export const AGE_TECH_COUNT = 10;
/** Techs of an age that fill its year range: the threshold to the next age, all ten in the last. */
export const techsToFillAge = (ageId) => (ageId === LAST_AGE_ID ? AGE_TECH_COUNT : TECH_AGE_ADVANCEMENT_THRESHOLD);

/** The label year for a nation at age `ageId` that has researched `researched` (an array or Set).
 * `partialOf(tech)` (optional) is the share done of an unresearched tech, 0 to 1. */
export const labelYear = (ageId, researched, partialOf = null) => {
  const age = AGES[ageId];
  if (!age) return null;
  const known = researched instanceof Set ? researched : new Set(researched);
  const progressIn = (id) => getTechsForAge(id).reduce((n, t) => (known.has(t.id) ? n + 1 : n), 0)
    + (partialOf ? Math.max(0, ...getTechsForAge(id).filter((t) => !known.has(t.id)).map((t) => Math.min(0.99, partialOf(t) || 0))) : 0);
  const need = techsToFillAge(ageId);
  const own = Math.min(need, progressIn(ageId));
  const prevId = AGE_ORDER[getAgeIndex(ageId) - 1];
  const left = prevId ? Math.max(0, progressIn(prevId) - TECH_AGE_ADVANCEMENT_THRESHOLD) : 0;
  const share = 1 - (1 - own / need) * (1 - left / AGE_TECH_COUNT);
  return Math.round(age.startYear + (age.endYear - age.startYear) * share);
};

/** The player's year label. */
export const displayYear = (state) => {
  const id = state.playerNationId;
  const progress = state.research?.progress || {};
  const known = getResearched(state, id);
  // Shares are of the full price: the opening techs' cut price (research.js) would otherwise make
  // every share jump the turn an opening tech is done.
  const full = openingCostMult(known);
  const partialOf = (t) => (progress[t.id] > 0 ? (progress[t.id] * full) / getResearchCost(state, id, t.id, undefined, true) : 0);
  return labelYear(ageOf(state, id), known, partialOf);
};
