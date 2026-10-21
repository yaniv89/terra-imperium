// src/data/legacy.js
// Points per legacy part (differentiation plan KTD7), by age: built from AGE_ORDER by index
// (KTD1), so a new age scores as data. A later age's goals are harder, so they are worth more.
import { AGE_ORDER, FIRST_AGE_ID } from './ages';

// The parts of the legacy score; each part's reason key is `legacy.<part>`.
export const LEGACY_PARTS = ['eraGoal', 'eraLegacy', 'ambition'];

export const LEGACY_POINTS = Object.fromEntries(AGE_ORDER.map((id, i) => [id, { eraGoal: 10 + 5 * i, eraLegacy: 20 + 10 * i, ambition: 30 + 10 * i }]));

/** The points of each part in `ageId` (the first age's for an unknown id). */
export const legacyPoints = (ageId) => LEGACY_POINTS[ageId] || LEGACY_POINTS[FIRST_AGE_ID];
