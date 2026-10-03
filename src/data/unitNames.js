// src/data/unitNames.js
// One name for a unit everywhere the UI prints one (plans/playtest-1.md P5.2): the roster's
// name for the age (Spearmen, Chariots, Trireme), never the class ("Infantry") except as a
// tooltip. A ship is named by its naval line and age (navalLines.js).
import { UNIT_ROSTER, UNIT_CLASSES } from './unitClasses';
import { navalName } from './navalLines';
import { FIRST_AGE_ID } from './ages';

export const unitDisplayName = (ageId, classId, navalLine = null) => {
  if (classId === 'naval') return navalName(navalLine || 'warship', ageId || FIRST_AGE_ID);
  if (classId === 'settler') return 'Settlers';
  return UNIT_ROSTER[ageId]?.[classId]?.name || UNIT_ROSTER.bronze?.[classId]?.name || UNIT_CLASSES[classId]?.name || classId;
};

/** The class as a tooltip: "Spearmen, infantry". */
export const unitClassLabel = (classId) => UNIT_CLASSES[classId]?.name || classId;
