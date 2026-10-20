// src/data/rulers.js
// The one ruler a major keeps for the whole game (plans/RULER-PLAN.md section 3, differentiation
// plan U5): six attributes stored flat on nation.ruler. Every major starts with the same numbers;
// the three pool attributes start at the old average roll, the three new ones at 0.
export const RULER_START = Object.freeze({ adm: 3, dip: 3, mil: 3, cmd: 0, lrn: 0, maj: 0 });

// Caps follow the nation's own research age (differentiation plan KTD1): 4 in the first age up to
// 8 in the last, spread by index over however many ages AGE_ORDER holds.
export const ATTRIBUTE_CAP_FIRST = 4;
export const ATTRIBUTE_CAP_LAST = 8;
export const attributeCapAt = (ageIndex, ageCount) => (ageCount <= 1 ? ATTRIBUTE_CAP_LAST
  : ATTRIBUTE_CAP_FIRST + Math.round(((ATTRIBUTE_CAP_LAST - ATTRIBUTE_CAP_FIRST) * Math.max(0, ageIndex)) / (ageCount - 1)));
