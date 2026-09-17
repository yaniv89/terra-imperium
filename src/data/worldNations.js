// src/data/worldNations.js
// A nation record for every one of the 240 countries in the geo data — symmetric, so any one of
// them can be the player's starting nation (src/context/GameContext.jsx's createInitialState).
// Every nation starts neutral toward every other; there is no scripted starting conflict.
import { RelationStatus } from './types';
import { DOCTRINE_IDS } from './nations';
import countriesMeta from './geo/countries-meta.json';

// Deterministic (no RNG, stable across rebuilds and every game) so a given country always gets
// the same archetype — a real assignment across all nine DOCTRINES (plan §8.5's six named
// archetypes plus the three pre-existing ones), replacing the flat 'cautious' placeholder every
// nation previously had.
const stableHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
};
const doctrineForCountry = (countryId) => DOCTRINE_IDS[stableHash(countryId) % DOCTRINE_IDS.length];

// A small, fixed hue rotation (golden-angle) keeps all 240 generated colors visually distinct from
// each other without any two nations landing on the exact same hue — no random seed, so the
// palette is stable across rebuilds.
const colorForCountry = (index) => {
  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue}, 55%, 45%)`;
};

// Population/GDP -> a rough military-strength proxy, log-scaled so India/China don't dwarf every
// other nation by three orders of magnitude the way raw population would.
const militaryFromPopulation = (population) => Math.round(2000 * Math.log10(Math.max(population, 1000)));

let colorIndex = 0;
const buildNation = (countryId, meta) => ({
  id: countryId,
  name: meta.name,
  color: colorForCountry(colorIndex++),
  startHostility: 5,
  startMilitary: militaryFromPopulation(meta.population),
  aggression: 0.1,
  startRelation: RelationStatus.NEUTRAL,
  doctrine: doctrineForCountry(countryId),
  population: meta.population,
  gdpMillions: meta.gdpMillions
});

export const WORLD_NATIONS = Object.fromEntries(
  Object.entries(countriesMeta).map(([countryId, meta]) => [countryId, buildNation(countryId, meta)])
);
