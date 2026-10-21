// src/data/peopleNation.js
// The starting nation record of a people of the pool (src/data/peoples.js, phase W0). Every
// nation starts neutral toward every other; there is no scripted starting conflict.
import { RelationStatus } from './types';
import { DOCTRINE_BY_CULTURE_GROUP } from './nations';
import { getCultureGroup } from './names';
import { PEOPLES } from './peoples';
import { titleFor } from './nationTitles';
import { EQUAL_START_MILITARY } from './worldSizes';

// Deterministic (no RNG, stable across rebuilds and every game): doctrine by culture group, hashed
// by the people's own id so neighbours of one land differ.
const stableHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
};
const sizeBucket = (startMilitary) => (startMilitary > 5000 ? 'large' : startMilitary > 1500 ? 'medium' : 'small');
const doctrineFor = (peopleId, startMilitary) => {
  const pool = DOCTRINE_BY_CULTURE_GROUP[getCultureGroup(peopleId)] || DOCTRINE_BY_CULTURE_GROUP.generic;
  return pool[stableHash(peopleId + sizeBucket(startMilitary)) % pool.length];
};

// Every people starts equal (roadmap decision 10), so the military proxy is one constant. `name`
// is the titled name of a tribal start; the engine keeps it current (nationTitles.js).
export const peopleNationRecord = (peopleId) => {
  const p = PEOPLES[peopleId];
  if (!p) return null;
  return {
    id: peopleId,
    people: peopleId,
    name: titleFor(p, 'tribal', 1),
    color: p.color,
    startHostility: 5,
    startMilitary: EQUAL_START_MILITARY,
    startRelation: RelationStatus.NEUTRAL,
    doctrine: doctrineFor(peopleId, EQUAL_START_MILITARY),
    population: 0,
    gdpMillions: 0
  };
};
