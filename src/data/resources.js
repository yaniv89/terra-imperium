// src/data/resources.js
// The resource model spanning all five ages (plan §4). Two resources are always in play — Gold
// (universal currency) and HR (recruitable manpower) — the rest unlock with their age and, unlike
// a typical tech-tree resource, never go obsolete: Copper stays relevant for coinage and later
// electrical uses, Iron carries from Classical through Gunpowder, Oil is the Modern-age chokepoint.
//
// Deposits (which regions actually produce which resource) are geography, not this file's job —
// they're generated per region in the geo build pipeline (plan §4, Phase B). This module only
// defines what a resource IS and when it's unlocked.

import { AGE_ORDER, getAgeIndex } from './ages';

export const RESOURCES = {
  gold: {
    id: 'gold',
    name: 'Gold',
    unlockAge: null, // always available
    description: 'Universal currency: construction, rush-buy, upkeep, diplomacy, mercenaries.'
  },
  hr: {
    id: 'hr',
    name: 'HR',
    unlockAge: null, // always available
    description: 'Recruitable manpower. Regenerates from population; wars drain it.'
  },
  copper: {
    id: 'copper',
    name: 'Copper',
    unlockAge: 'bronze',
    description: 'Bronze-tier units and early buildings. Stays relevant into later ages (coinage, electrical).'
  },
  iron: {
    id: 'iron',
    name: 'Iron',
    unlockAge: 'classical',
    description: 'Classical-through-Gunpowder military and heavy industry.'
  },
  oil: {
    id: 'oil',
    name: 'Oil',
    unlockAge: 'modern',
    description: 'Mechanized, air and naval units, factories — the mid-late-game chokepoint.'
  },
  // Space Age resources (plan §10.4) — unlocked mid-to-late Modern Age by the space-race mission
  // ladder, not by the calendar alone. isResourceUnlocked() only checks the age floor; the space
  // race's own mission-completion gate (Phase D2) is a stricter, additional condition on top.
  rareMetals: {
    id: 'rareMetals',
    name: 'Rare Metals',
    unlockAge: 'modern',
    description: 'From asteroid mining. Advanced electronics, satellites, late-game units.'
  },
  helium3: {
    id: 'helium3',
    name: 'Helium-3',
    unlockAge: 'modern',
    description: 'From the outer planets. Fusion power and endgame units.'
  }
};

export const RESOURCE_IDS = Object.keys(RESOURCES);

// Resources with no age gate at all — always present in every nation's economy from turn one.
export const ALWAYS_AVAILABLE_RESOURCE_IDS = RESOURCE_IDS.filter(id => RESOURCES[id].unlockAge === null);

export const isResourceUnlocked = (resourceId, calendarAgeId) => {
  const resource = RESOURCES[resourceId];
  if (!resource) return false;
  if (resource.unlockAge === null) return true;
  const unlockIdx = getAgeIndex(resource.unlockAge);
  const currentIdx = getAgeIndex(calendarAgeId);
  if (unlockIdx === -1 || currentIdx === -1) return false;
  return currentIdx >= unlockIdx;
};

// Every resource unlocked by (and including) the given age, in age-unlock order then always-on
// resources — a starter pool for createInitialState() to zero-initialize.
export const getUnlockedResourceIds = (calendarAgeId) => RESOURCE_IDS.filter(id => isResourceUnlocked(id, calendarAgeId));

// A fresh, all-zero resource pool covering every resource that exists at the given age — the
// shape createInitialState() should spread nation-specific starting amounts over.
export const createEmptyResourcePool = (calendarAgeId) => {
  const pool = {};
  getUnlockedResourceIds(calendarAgeId).forEach(id => { pool[id] = 0; });
  return pool;
};

// Sanity helper: which age each resource unlocks in, for UI ("unlocks in the Bronze Age" labels).
export const getResourceUnlockAgeName = (resourceId) => {
  const resource = RESOURCES[resourceId];
  if (!resource || resource.unlockAge === null) return null;
  return resource.unlockAge;
};

// Guard used by tests/tooling: every age-gated resource's unlockAge must be a real age id.
export const allUnlockAgesAreValid = () =>
  RESOURCE_IDS.every(id => {
    const age = RESOURCES[id].unlockAge;
    return age === null || AGE_ORDER.includes(age);
  });
