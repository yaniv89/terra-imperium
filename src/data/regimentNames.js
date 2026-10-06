// src/data/regimentNames.js
// How a people's unit is named (master plan section 4 "Names everywhere"): the people's adjective
// plus the unit's name for the age ("Akkadian Spearmen"), and a regiment number per nation and
// unit kind ("3rd Akkadian Spearmen"). The number is given once, when the unit first appears
// (src/engine/peopleNames.js), and kept for life; generals keep their own names. A legacy nation's
// unit keeps the plain name. Pure.
import { peopleOf } from './peoples';

export const ordinal = (n) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
};

/** The kind a regiment is numbered within: the class, a ship's naval line. */
export const regimentKind = (unit) => (unit.classId === 'naval' ? `naval:${unit.navalLine || 'warship'}` : unit.classId);

/** "3rd Akkadian Spearmen", or `baseName` when the owner is not a people of the pool. */
export const regimentName = (nation, unit, baseName) => {
  const people = peopleOf(nation?.people);
  if (!people || !baseName) return baseName;
  const named = `${people.adjective} ${baseName}`;
  return unit?.regiment ? `${ordinal(unit.regiment)} ${named}` : named;
};
