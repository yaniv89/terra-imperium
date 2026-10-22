// src/i18n/unitTags.js
// The rules a unit carries beyond its class (the AoE and Civ report's rank 16), as one short line for
// the build list and the army sheet: its people's signature tag (signatureUnits.js) and the age's own
// matchups (unitClasses.js COUNTER_OVERRIDES). null when it has none.
import { t as tNow } from './index';
import { unitClassName } from './gameText';
import { UNIT_CLASSES, COUNTER_OVERRIDES } from '../data/unitClasses';
import { signatureUnitFor, signatureTagOf, SIGNATURE_TAGS, SIGNATURE_EDGE } from '../data/signatureUnits';

const vs = (classId) => unitClassName(classId, UNIT_CLASSES[classId]?.name);

export const unitTagText = (peopleId, ageId, classId) => {
  const parts = [];
  const tag = signatureTagOf(signatureUnitFor(peopleId, ageId, classId));
  if (tag) parts.push(tNow('unit.tag.signature', { pct: Math.round((SIGNATURE_EDGE - 1) * 100), vs: vs(SIGNATURE_TAGS[tag]) }));
  Object.entries(COUNTER_OVERRIDES[ageId] || {}).forEach(([pair, mult]) => {
    const [a, d] = pair.split('>');
    if (a === classId) parts.push(tNow('unit.tag.counter', { mult, vs: vs(d) }));
  });
  return parts.length ? parts.join(' · ') : null;
};
