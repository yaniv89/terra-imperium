// src/engine/ageRefs.js
// There is no world age (eight-ages plan KTD2): every rule reads a nation's own age (ageOf in
// nationState.js). The two rules that need an age no single nation owns read one of these, and
// both come only from research and known contacts:
//
//   researchLeaderAge(state)          the highest age among the living majors that hold a city
//                                     (independents and cityless nations left out); a wait owned by
//                                     no nation (people emergence) and the contact reach (KTD5) use it
//   strongestKnownMajor(state, id)    the major `id` knows (techDiffusion.js contactsOf: a border, a
//                                     capital within CONTACT_KM, a trade partner) with the largest
//                                     economy (tradeValue.js economySizes), ties to the lower id; null
//                                     when it knows none. Independents read its age (KTD8).
//
// Both are cached on the state objects they read, like the diffusion index.
import { AGE_ORDER, FIRST_AGE_ID, getAgeIndex } from '../data/ages';
import { isIndependentNation } from '../data/independents';
import { ageOf, getResearched } from './nationState';
import { labelYear } from './displayYear';
import { economySizes } from './tradeValue';
import { contactsOf } from './techDiffusion';

const isMajor = (nation) => !!nation && !nation.isEliminated && !isIndependentNation(nation);

const leaderCache = new WeakMap(); // state.nations -> { regions, techAgeId, ageId }
/** The highest age among living majors with at least one city (the first age when there is none). */
export const researchLeaderAge = (state) => {
  const nations = state.nations || {};
  const hit = leaderCache.get(nations);
  if (hit && hit.regions === state.regions && hit.techAgeId === state.techAgeId) return hit.ageId;
  const sizes = economySizes(state);
  let best = 0;
  Object.keys(nations).forEach((id) => {
    if (!isMajor(nations[id]) || !sizes.get(id)) return;
    best = Math.max(best, getAgeIndex(ageOf(state, id)));
  });
  const ageId = AGE_ORDER[best] || FIRST_AGE_ID;
  leaderCache.set(nations, { regions: state.regions, techAgeId: state.techAgeId, ageId });
  return ageId;
};

/** The year label of the most advanced major with a city (displayYear.js labelYear over its own
 * research): a wait owned by no nation (late peoples arriving) reads it, never the calendar. */
export const researchLeaderYear = (state) => {
  const sizes = economySizes(state);
  let best = null;
  Object.keys(state.nations || {}).forEach((id) => {
    if (!isMajor(state.nations[id]) || !sizes.get(id)) return;
    const y = labelYear(ageOf(state, id), getResearched(state, id));
    if (best == null || y > best) best = y;
  });
  return best ?? labelYear(FIRST_AGE_ID, []);
};

/**
 * The age a wait runs at (KTD7, speedTurns): the waiting nation's own age; a wait shared by two
 * nations (a truce, a demand cooldown, a pair's trade disruption) uses the older age of the two;
 * a wait no nation owns uses the research leader's age.
 */
export const waitAgeOf = (state, ...nationIds) => {
  const ids = nationIds.filter((id) => id != null);
  if (!ids.length) return researchLeaderAge(state);
  return AGE_ORDER[Math.min(...ids.map((id) => getAgeIndex(sideAgeOf(state, id))))] || FIRST_AGE_ID;
};

/** The index of researchLeaderAge in AGE_ORDER. */
export const researchLeaderIndex = (state) => getAgeIndex(researchLeaderAge(state));

/** An independent's age (KTD8): its strongest known major's age, the first age when it knows none. */
export const independentAgeOf = (state, nationId) => {
  const major = strongestKnownMajor(state, nationId);
  return major ? ageOf(state, major) : FIRST_AGE_ID;
};

/** The age a side fights and pays at: an independent's from independentAgeOf, a major's its own. */
export const sideAgeOf = (state, nationId) => (isIndependentNation(state.nations?.[nationId]) ? independentAgeOf(state, nationId) : ageOf(state, nationId));

/** The known major with the largest economy, ties to the lower id; null when `nationId` knows none. */
export const strongestKnownMajor = (state, nationId) => {
  const sizes = economySizes(state);
  let bestId = null; let bestSize = -1;
  contactsOf(state, nationId).forEach((_, id) => {
    if (!isMajor(state.nations?.[id])) return;
    const size = sizes.get(id) || 0;
    if (size > bestSize || (size === bestSize && id < bestId)) { bestId = id; bestSize = size; }
  });
  return bestId;
};
