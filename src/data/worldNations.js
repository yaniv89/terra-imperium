// src/data/worldNations.js
// A nation record for every one of the 240 countries in the geo data — symmetric, so any one of
// them can be the player's starting nation (src/context/GameContext.jsx's createInitialState).
// Every nation starts neutral toward every other; there is no scripted starting conflict.
import { log10Exact } from '../utils/exactMath';
import { RelationStatus } from './types';
import { DOCTRINE_BY_CULTURE_GROUP } from './nations';
import { getCultureGroup } from './names';
import countriesMeta from './geo/countries-meta.json';
import { PEOPLES } from './peoples';
import { titleFor } from './nationTitles';
import { EQUAL_START_MILITARY } from './worldSizes';

// Deterministic (no RNG, stable across rebuilds and every game) so a given country always gets
// the same archetype. Plan §M16: "doctrine assigned by culture group + starting size" — replaces
// the earlier flat hash-across-all-9 assignment (which itself replaced an even earlier flat
// 'cautious' placeholder) with a per-culture-group flavor pool, further split by a coarse size
// bucket so same-group nations of very different scale don't always land on the same archetype.
const stableHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
};
const sizeBucket = (startMilitary) => (startMilitary > 5000 ? 'large' : startMilitary > 1500 ? 'medium' : 'small');
const doctrineForCountry = (countryId, startMilitary) => {
  const pool = DOCTRINE_BY_CULTURE_GROUP[getCultureGroup(countryId)] || DOCTRINE_BY_CULTURE_GROUP.generic;
  return pool[stableHash(countryId + sizeBucket(startMilitary)) % pool.length];
};

// A small, fixed hue rotation (golden-angle) keeps all 240 generated colors visually distinct from
// each other without any two nations landing on the exact same hue — no random seed, so the
// palette is stable across rebuilds.
const colorForCountry = (index) => {
  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue}, 55%, 45%)`;
};

// Population/GDP -> a rough military-strength proxy, log-scaled so India/China don't dwarf every
// other nation by three orders of magnitude the way raw population would.
const militaryFromPopulation = (population) => Math.round(2000 * log10Exact(Math.max(population, 1000)));

let colorIndex = 0;
const buildNation = (countryId, meta) => {
  const startMilitary = militaryFromPopulation(meta.population);
  return {
    id: countryId,
    name: meta.name,
    color: colorForCountry(colorIndex++),
    startHostility: 5,
    startMilitary,
    startRelation: RelationStatus.NEUTRAL,
    doctrine: doctrineForCountry(countryId, startMilitary),
    population: meta.population,
    gdpMillions: meta.gdpMillions
  };
};

export const WORLD_NATIONS = Object.fromEntries(
  Object.entries(countriesMeta).map(([countryId, meta]) => [countryId, buildNation(countryId, meta)])
);

// The same record for a people of the pool (src/data/peoples.js, phase W0): every people starts
// equal (roadmap decision 10), so the military proxy is one constant; the doctrine comes from its
// land's culture group, hashed by the people's own id so neighbours of one land differ. `name` is
// the titled name of a tribal start; the engine keeps it current (nationTitles.js).
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
    doctrine: doctrineForCountry(peopleId, EQUAL_START_MILITARY),
    population: 0,
    gdpMillions: 0
  };
};
