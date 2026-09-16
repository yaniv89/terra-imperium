// src/data/worldNations.js
// Phase 13 (world game model), first slice: a nation record for every one of the 240 countries
// in the Phase 11 geo data, not just the 15 in the hand-tuned Israel campaign.
//
// This is deliberately data-only and additive — nothing in src/context/, src/engine/, or
// src/utils/aiLogic.js imports this yet. createInitialState() still builds its nations table
// from NATIONS_DATA alone, so the shipped, balanced 1870-2150 campaign is completely unaffected.
// Wiring a real world-scale game (createInitialState using this instead, AI turn processing that
// scales to 240 nations, events/victory conditions that don't hardcode nation ids) is further
// Phase 13 work built on top of this.
//
// The 15 existing nations keep their exact hand-tuned NATIONS_DATA entries, byte-for-byte (see
// worldNations.test.js) — years of balance work don't get silently overwritten by a formula.
// Every other country gets a nation record derived from its real population and GDP (Phase 11's
// geo pipeline — see scripts/geo/build.mjs), but deliberately passive: none of them have a stake
// in the Israel/Middle East conflict this simulation was built around, so they start neutral,
// low-aggression, and doctrine-cautious rather than fabricating geopolitical hostility out of
// nowhere. Actually wiring them into meaningful global mechanics (trade networks, distant wars,
// alliances) is future work, not this slice.
import { RelationStatus } from './types';
import { NATIONS_DATA, HOSTILE_BLOCS } from './nations';
import countriesMeta from './geo/countries-meta.json';

// player='il' is the game's own territory, not a foreign nation.
const HAND_TUNED_COUNTRY_IDS = {
  il: 'player',
  eg: 'egypt',
  jo: 'jordan',
  sy: 'syria',
  lb: 'lebanon',
  iq: 'iraq',
  sa: 'saudi',
  ir: 'iran',
  tr: 'turkey',
  ye: 'yemen',
  om: 'oman',
  ae: 'uae',
  qa: 'qatar',
  bh: 'bahrain',
  kw: 'kuwait'
};

// A small, fixed hue rotation (golden-angle) keeps 225 generated colors visually distinct from
// each other without any two nations landing on the exact same hue — no random seed, so the
// palette is stable across rebuilds.
const colorForCountry = (index) => {
  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue}, 55%, 45%)`;
};

// Population/GDP -> a rough military-strength proxy, log-scaled so India/China don't dwarf every
// other nation by three orders of magnitude the way raw population would. Calibrated to land in
// the same order of magnitude as the hand-tuned nations (e.g. Egypt: pop ~100M -> startMilitary
// 15,000 hand-tuned; this formula gives ~16,000 for the same population) without trying to match
// any of them exactly — these are new nations, not a retroactive rebalance of the tuned ones.
const militaryFromPopulation = (population) => Math.round(2000 * Math.log10(Math.max(population, 1000)));

let colorIndex = 0;
const buildGeneratedNation = (countryId, meta) => ({
  id: countryId,
  name: meta.name,
  color: colorForCountry(colorIndex++),
  startHostility: 5, // no stake in the conflict this simulation is built around — see file header
  startMilitary: militaryFromPopulation(meta.population),
  aggression: 0.1,
  startRelation: RelationStatus.NEUTRAL,
  regions: [],
  aiPriority: ['economy', 'diplomacy'],
  doctrine: 'cautious',
  // Carried through for later Phase 13 work (economic mechanics, tiering) — not consumed by any
  // current engine code, same as the inert `regions`/`aiPriority` fields above.
  population: meta.population,
  gdpMillions: meta.gdpMillions
});

export const WORLD_NATIONS = {
  // Stateless actors (Hamas) hold no sovereign territory in the country tier at all, so they can
  // never be reached by iterating countriesMeta below — carried over directly instead, same as
  // every other hand-tuned nation, so nothing in NATIONS_DATA is silently dropped by this merge.
  hamas: NATIONS_DATA.hamas,
  ...Object.fromEntries(
    Object.entries(countriesMeta).map(([countryId, meta]) => {
      const handTunedId = HAND_TUNED_COUNTRY_IDS[countryId];
      if (handTunedId) return [handTunedId, NATIONS_DATA[handTunedId]];
      return [countryId, buildGeneratedNation(countryId, meta)];
    })
  )
};

// Re-exported so anything consuming WORLD_NATIONS can still reach the original conflict's bloc
// groupings without importing two nation tables.
export { HOSTILE_BLOCS };
