// scripts/geo/build-world-regions.mjs
// Generates src/data/geo/worldRegions.json: a nation record + real adjacency for every one of the
// 240 countries that ISN'T one of the 15 hand-tuned nations already broken into the 28
// hand-authored game regions (src/data/regions.js). This is what makes the rest of the world
// actually playable — invadable, targetable by diplomacy — not just a colored backdrop.
//
// Run with: node scripts/geo/build-world-regions.mjs
// Reads only already-committed data (no network fetch). Adjacency is derived the same principled
// way Phase 11 first computed it: two macro-regions border each other iff any of their real
// admin-1 provinces share a TopoJSON arc — collapsed here from the province-level graph
// (subregions-adjacency.json) down to whichever macro-region (one of the 28 hand-authored game
// regions, or one of these 225 new whole-country ones) each province actually belongs to.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const geoDir = path.join(__dirname, '../../src/data/geo');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const countriesMeta = readJson(path.join(geoDir, 'countries-meta.json'));
const subregionsMeta = readJson(path.join(geoDir, 'subregions-meta.json'));
const subregionsAdjacency = readJson(path.join(geoDir, 'subregions-adjacency.json'));
const { featureToRegion } = readJson(path.join(geoDir, 'gameRegions.json'));

// Kept in sync with src/data/worldNations.js's HAND_TUNED_COUNTRY_IDS by hand (both lists are
// small and change together only when a new nation is hand-tuned into the campaign, which also
// means re-authoring its game regions — not something that happens without noticing).
// 'ps' (Palestine) is deliberately included even though it's not a HAND_TUNED_COUNTRY_ID in
// worldNations.js — its territory is already the hand-authored 'gaza'/'west_bank' game regions
// (see build-game-regions.mjs), so it must not also get a generated whole-country region of its
// own, which would silently duplicate that territory under a third, unreachable id.
const HAND_TUNED_COUNTRY_IDS = new Set(['il', 'eg', 'jo', 'sy', 'lb', 'iq', 'sa', 'ir', 'tr', 'ye', 'om', 'ae', 'qa', 'bh', 'kw', 'ps']);

// The macro-region a given real-world province belongs to: one of the 28 hand-authored game
// regions if it's part of one, otherwise its own country's (new, whole-country) world region.
const engineRegionOf = (subregionId) => featureToRegion[subregionId] || subregionsMeta[subregionId]?.countryId;

// Collapse the province-level border graph into a macro-region border graph.
const macroAdjacency = {};
const addEdge = (a, b) => {
  if (!a || !b || a === b) return;
  if (!macroAdjacency[a]) macroAdjacency[a] = new Set();
  macroAdjacency[a].add(b);
};
Object.entries(subregionsAdjacency).forEach(([subId, neighborSubIds]) => {
  const mine = engineRegionOf(subId);
  neighborSubIds.forEach((nSubId) => addEdge(mine, engineRegionOf(nSubId)));
});

// A rough 0-10 development index from GDP-per-capita, used to seed infrastructure/strategicValue
// for nations with no hand-tuned values — richer nations get modestly higher scores, but this is
// flavor, not balance (these nations have no stake in the hand-tuned conflict; see worldNations.js).
const developmentIndex = (population, gdpMillions) => {
  const gdpPerCapita = (gdpMillions * 1e6) / Math.max(population, 1);
  return Math.min(10, Math.max(1, Math.round(Math.log10(Math.max(gdpPerCapita, 100)) * 2.2)));
};

const worldRegions = {};
Object.entries(countriesMeta).forEach(([countryId, meta]) => {
  if (HAND_TUNED_COUNTRY_IDS.has(countryId)) return; // already one of the 28 hand-authored regions

  const dev = developmentIndex(meta.population, meta.gdpMillions);
  const neighbors = Array.from(macroAdjacency[countryId] || []);

  worldRegions[countryId] = {
    id: countryId,
    name: meta.name,
    type: 'foreign',
    startOwner: countryId,
    startControl: 100,
    population: meta.population,
    infrastructure: dev,
    strategicValue: dev,
    terrain: 'mixed',
    resources: {
      money: Math.round(meta.gdpMillions / 100),
      manpower: Math.round(meta.population / 1000)
    },
    fortification: 1,
    isCapital: true, // this single region IS this nation's whole territory — its own anchor
    neighbors,
    description: `${meta.name} — not part of the hand-tuned conflict this campaign is built around.`
  };
});

writeFileSync(path.join(geoDir, 'worldRegions.json'), JSON.stringify(worldRegions));
console.log(`Wrote worldRegions.json: ${Object.keys(worldRegions).length} nations, ${Object.values(worldRegions).reduce((s, r) => s + r.neighbors.length, 0)} directed border edges.`);
