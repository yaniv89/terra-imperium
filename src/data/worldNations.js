// src/data/worldNations.js
// A nation record for every one of the 240 countries in the geo data — symmetric, so any one of
// them can be the player's starting nation (src/context/GameContext.jsx's createInitialState).
// Every nation starts neutral toward every other; there is no scripted starting conflict.
import { RelationStatus } from './types';
import countriesMeta from './geo/countries-meta.json';

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
  // Real archetype assignment (Conqueror/Merchant/Isolationist/Opportunist/Defender/Zealot, plan
  // §8.5) is Phase D work, built once the AI actually reads it — 'cautious' is a safe, inert
  // default (low war-roll multiplier) until then.
  doctrine: 'cautious',
  population: meta.population,
  gdpMillions: meta.gdpMillions
});

export const WORLD_NATIONS = Object.fromEntries(
  Object.entries(countriesMeta).map(([countryId, meta]) => [countryId, buildNation(countryId, meta)])
);
