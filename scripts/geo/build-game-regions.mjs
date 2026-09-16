// scripts/geo/build-game-regions.mjs
// Generates src/data/geo/gameRegions.json: which real-world admin-0 countries have zero admin-1
// province data at all (a small "rest of world" fallback list — every other country renders its
// real provinces, each tagged with its own country id as its game region id; every nation on
// Earth is a real, playable game region, symmetric with every other — see build-world-regions.mjs
// and loadGameRegions.js).
//
// Run with: node scripts/geo/build-game-regions.mjs
// Reads the already-committed countries/subregions topology (no network fetch needed) and writes
// a plain JSON map — small enough to just check in, so nothing needs to re-run this at build time.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { feature } from 'topojson-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const geoDir = path.join(__dirname, '../../src/data/geo');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const countriesTopo = readJson(path.join(geoDir, 'countries.topo.json'));
const subregionsTopo = readJson(path.join(geoDir, 'subregions.topo.json'));
const subregionsMeta = readJson(path.join(geoDir, 'subregions-meta.json'));

const countryKey = Object.keys(countriesTopo.objects)[0];
const subregionKey = Object.keys(subregionsTopo.objects)[0];
const countryFeatures = feature(countriesTopo, countriesTopo.objects[countryKey]).features;
const subregionFeatures = feature(subregionsTopo, subregionsTopo.objects[subregionKey]).features;

// Every country covered by at least one real admin-1 province — anything left over after this has
// no province-level data and falls back to rendering as one whole-country polygon.
const countriesWithSubregions = new Set(subregionFeatures.map((f) => subregionsMeta[f.id]?.countryId));
const restOfWorldCountryIds = countryFeatures
  .map((f) => f.id)
  .filter((id) => !countriesWithSubregions.has(id));

const output = { restOfWorldCountryIds };
writeFileSync(path.join(geoDir, 'gameRegions.json'), JSON.stringify(output));
console.log(`Wrote gameRegions.json: ${restOfWorldCountryIds.length} rest-of-world countries (no admin-1 data).`);
