// src/data/government.js
// Government types by age (plan §9): Tribal -> Monarchy/Republic -> Feudal/Empire ->
// Absolutist/Constitutional -> Democracy/Autocracy/Federation. Each unlocks more policy slots
// than the last and carries one passive bonus, on the same two hooks policies use (goldMult,
// consumed by calcIncome, and stabilityBonus, consumed by nextUnrest) — real, working effects
// rather than flavor text, but deliberately just two hooks rather than a bespoke bonus per type.
//
// Age-gated the same way buildings are: adoptable at the nation's calendar age or one age ahead
// (canAdoptGovernment), so a government reform is a real strategic choice on the same rush terms
// as everything else, not its own special case.

import { getAgeIndex } from './ages';

export const GOVERNMENT_TYPES = {
  tribal: { id: 'tribal', name: 'Tribal Council', ageId: 'bronze', slots: 1, effect: {} },
  monarchy: { id: 'monarchy', name: 'Monarchy', ageId: 'classical', slots: 2, effect: { stabilityBonus: 5 } },
  republic: { id: 'republic', name: 'Republic', ageId: 'classical', slots: 2, effect: { goldMult: 0.08 } },
  feudal: { id: 'feudal', name: 'Feudal Realm', ageId: 'kingdoms', slots: 3, effect: { stabilityBonus: 8 } },
  empire: { id: 'empire', name: 'Empire', ageId: 'kingdoms', slots: 3, effect: { goldMult: 0.12 } },
  absolutist: { id: 'absolutist', name: 'Absolutist Monarchy', ageId: 'gunpowder', slots: 4, effect: { stabilityBonus: 10 } },
  constitutional: { id: 'constitutional', name: 'Constitutional Monarchy', ageId: 'gunpowder', slots: 4, effect: { goldMult: 0.15 } },
  democracy: { id: 'democracy', name: 'Democracy', ageId: 'modern', slots: 5, effect: { goldMult: 0.2 } },
  autocracy: { id: 'autocracy', name: 'Autocracy', ageId: 'modern', slots: 5, effect: { stabilityBonus: 12 } },
  federation: { id: 'federation', name: 'Federation', ageId: 'modern', slots: 6, effect: { stabilityBonus: 6 } }
};

export const getGovernment = (id) => GOVERNMENT_TYPES[id] || null;

export const getAvailableGovernments = (ageId) => Object.values(GOVERNMENT_TYPES).filter((g) => g.ageId === ageId);

export const canAdoptGovernment = (governmentId, calendarAgeId) => {
  const gov = GOVERNMENT_TYPES[governmentId];
  if (!gov) return false;
  return getAgeIndex(gov.ageId) <= getAgeIndex(calendarAgeId) + 1;
};
