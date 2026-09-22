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

// apBonus (Administrative Capacity, added alongside the Governance tech line's own contribution —
// see helpers.js's getMaxActionPoints) is the third hook on this same effect object: a government
// that can hold more policies is, definitionally, more administratively capable, so it scales with
// slots rather than needing its own separate tier table. Without this, a 50-region empire under any
// government still acted on exactly the flat 3 AP/turn a 1-region start does — nothing about
// maturing your state ever bought you more to actually DO in a turn.
export const GOVERNMENT_TYPES = {
  tribal: { id: 'tribal', name: 'Tribal Council', ageId: 'bronze', slots: 1, effect: {} },
  monarchy: { id: 'monarchy', name: 'Monarchy', ageId: 'classical', slots: 2, effect: { stabilityBonus: 5, apBonus: 1 } },
  republic: { id: 'republic', name: 'Republic', ageId: 'classical', slots: 2, effect: { goldMult: 0.08, apBonus: 1 } },
  feudal: { id: 'feudal', name: 'Feudal Realm', ageId: 'kingdoms', slots: 3, effect: { stabilityBonus: 8, apBonus: 2 } },
  empire: { id: 'empire', name: 'Empire', ageId: 'kingdoms', slots: 3, effect: { goldMult: 0.12, apBonus: 2 } },
  absolutist: { id: 'absolutist', name: 'Absolutist Monarchy', ageId: 'gunpowder', slots: 4, effect: { stabilityBonus: 10, apBonus: 3 } },
  constitutional: { id: 'constitutional', name: 'Constitutional Monarchy', ageId: 'gunpowder', slots: 4, effect: { goldMult: 0.15, apBonus: 3 } },
  democracy: { id: 'democracy', name: 'Democracy', ageId: 'modern', slots: 5, effect: { goldMult: 0.2, apBonus: 4 } },
  autocracy: { id: 'autocracy', name: 'Autocracy', ageId: 'modern', slots: 5, effect: { stabilityBonus: 12, apBonus: 4 } },
  federation: { id: 'federation', name: 'Federation', ageId: 'modern', slots: 6, effect: { stabilityBonus: 6, apBonus: 4 } }
};

export const getGovernment = (id) => GOVERNMENT_TYPES[id] || null;

export const getAvailableGovernments = (ageId) => Object.values(GOVERNMENT_TYPES).filter((g) => g.ageId === ageId);

export const canAdoptGovernment = (governmentId, calendarAgeId) => {
  const gov = GOVERNMENT_TYPES[governmentId];
  if (!gov) return false;
  return getAgeIndex(gov.ageId) <= getAgeIndex(calendarAgeId) + 1;
};
