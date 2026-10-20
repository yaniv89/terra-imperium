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
import { ageOf } from './nationState';
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

/** The index of researchLeaderAge in AGE_ORDER. */
export const researchLeaderIndex = (state) => getAgeIndex(researchLeaderAge(state));

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
