// src/data/signatureUnits.js
// Signature units (user decision 2026-10-06; plans/ART-MODELS-PLAN.md 4.5, 4.6): each people has
// ONE signature unit in ONE age, which replaces that people's base unit of the same role in that
// age. Its model is src/assets/units/signature/<peopleId>.glb (optional <peopleId>.json beside it
// with the same bake options as the base units, src/assets/units/README.md); without the file, or
// for every other people, age and role, the base unit stands. Rules (stats, costs) are a later
// design phase ("SU"): until then a signature unit fights with its base unit's rules, so this
// table only says which model to draw.
//   { [peopleId]: { ageId, classId, name } }   classId: infantry | ranged | cavalry | siege | support
// Empty until the roster is confirmed (plan section 13).
export const SIGNATURE_UNITS = Object.freeze({});

/** The people's signature unit when it is this age and role, else null. */
export const signatureUnitFor = (peopleId, ageId, classId, table = SIGNATURE_UNITS) => {
  const e = peopleId ? table[peopleId] : null;
  return e && e.ageId === ageId && e.classId === classId ? e : null;
};

/** The soldier layer key a signature unit draws under (beside the base `classId`). */
export const signatureKey = (classId, peopleId) => `${classId}~${peopleId}`;
/** The base class of a soldier layer key ('infantry~egypt' -> 'infantry'). */
export const baseClassOf = (key) => String(key).split('~')[0];
