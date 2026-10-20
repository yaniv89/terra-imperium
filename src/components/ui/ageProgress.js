// src/components/ui/ageProgress.js
// The player's own age and how far it is from the next (eight-ages plan KTD1): the next age comes
// with TECH_AGE_ADVANCEMENT_THRESHOLD of the current age's techs. No calendar, no world age.
import { AGE_ORDER } from '../../data/ages';
import { getTechsForAge, TECH_AGE_ADVANCEMENT_THRESHOLD } from '../../data/techTree';
import { ageOf, getResearched } from '../../engine/nationState';

/** { ageId, nextAgeId (null in the last age), techsLeft (null in the last age), known, total } for a nation. */
export const ageProgress = (state, nationId = state.playerNationId) => {
  const ageId = ageOf(state, nationId);
  const nextAgeId = AGE_ORDER[AGE_ORDER.indexOf(ageId) + 1] || null;
  const known = new Set(getResearched(state, nationId));
  const techs = getTechsForAge(ageId);
  const have = techs.filter((t) => known.has(t.id)).length;
  return { ageId, nextAgeId, techsLeft: nextAgeId ? Math.max(1, TECH_AGE_ADVANCEMENT_THRESHOLD - have) : null, known: have, total: techs.length };
};

/** How a nation's age compares with the player's: 'ahead', 'equal' or 'behind'. */
export const ageVersusPlayer = (state, nationId) => {
  const a = AGE_ORDER.indexOf(ageOf(state, nationId));
  const p = AGE_ORDER.indexOf(ageOf(state, state.playerNationId));
  return a > p ? 'ahead' : a < p ? 'behind' : 'equal';
};
