// src/engine/ageLandmarks.js
// The age landmark fork (the AoE and Civ report's rank 13; data in src/data/ageLandmarks.js). Each age
// a nation enters after the Stone Age offers two landmarks; it keeps one for the rest of the game.
//   Record    nation.landmarks = { [ageId]: landmarkId }, one per age, never changed.
//   Player    every age reached without a pick waits as a choice (pendingLandmarkAge, the oldest
//             first; a "needs you" chip opens the Research tab); CHOOSE_AGE_LANDMARK records it.
//             Nothing waits on it: the turn goes on while it is open.
//   AI        picks on entering the age (research.js onAgeAdvance) by a seeded roll of its id and
//             the age (aiLandmark), the same pick on every device.
//   Effect    the pick's `effects` are lines on the nation's modifier sheet (modifiers/sources.js).
// Pure.
import { AGE_LANDMARKS, landmarkOf } from '../data/ageLandmarks';
import { AGE_ORDER, getAgeIndex } from '../data/ages';
import { ageOf } from './nationState';

// FNV-1a, as aftermath.js hashRoll (kept here so research.js pulls in no world modules).
const hashRoll = (key) => { let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

/** The oldest age `nationId` has reached with landmarks and no pick yet, or null. */
export const pendingLandmarkAge = (state, nationId = state.playerNationId) => {
  const nation = state.nations?.[nationId];
  if (!nation) return null;
  return AGE_ORDER.slice(1, getAgeIndex(ageOf(state, nationId)) + 1).find((a) => AGE_LANDMARKS[a] && !nation.landmarks?.[a]) ?? null;
};

/** The nation with landmark `id` raised for age `ageId`; the same nation when it is not a landmark
 * of that age or the age already has one. */
export const withLandmark = (nation, ageId, id) => (landmarkOf(ageId, id) && !nation.landmarks?.[ageId]
  ? { ...nation, landmarks: { ...nation.landmarks, [ageId]: id } } : nation);

/** An AI nation's pick for `ageId`: a seeded roll of its id and the age. */
export const aiLandmark = (nationId, ageId) => {
  const list = AGE_LANDMARKS[ageId];
  return list ? list[Math.floor(hashRoll(`landmark|${nationId}|${ageId}`) * list.length)].id : null;
};
