// scripts/geo/build-game-regions.mjs
// One-off generator for src/data/geo/gameRegions.json: a static map from a real-world feature id
// (admin-1 province id like "il-jm", or admin-0 country id like "jo") to one of the 28
// hand-authored game regions in src/data/regions.js. This is what lets the globe (Phase 14
// correction: the globe is now the ONLY game map) render and click those 28 regions using real
// country/province geometry instead of the old flat hand-drawn SVG.
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

// Crude but sufficient centroid for splitting a country's own provinces into two geographic
// halves — averaging exterior-ring vertices, not a true area centroid, but provinces are small
// enough relative to the split that this never misclassifies one to the wrong half in practice.
const centroidOf = (f) => {
  const rings = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.flat() : f.geometry.coordinates;
  const pts = rings[0];
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { lon, lat };
};

const byCountry = (countryId) => subregionFeatures.filter((f) => subregionsMeta[f.id]?.countryId === countryId);

// Splits a country's provinces into two roughly-equal-count halves by a geographic axis, sorted
// so the "low" half (western/southern) goes first.
const splitByAxis = (provinces, axis) => {
  const sorted = [...provinces].sort((a, b) => centroidOf(a)[axis] - centroidOf(b)[axis]);
  const mid = Math.ceil(sorted.length / 2);
  return [sorted.slice(0, mid), sorted.slice(mid)];
};

const map = {};
const assign = (features, gameRegionId) => {
  features.forEach((f) => { map[f.id] = gameRegionId; });
};
const assignIds = (ids, gameRegionId) => {
  ids.forEach((id) => { map[id] = gameRegionId; });
};

// --- Israel: its 6 official districts map almost 1:1 onto 5 of our game regions; Golan Heights
// has no district of its own (fused into Israel's/Syria's outline) so it's handled separately as
// a small hand-authored polygon in loadGameRegions.js instead of real admin-1 data.
assignIds(['il-jm'], 'jerusalem');
assignIds(['il-ta', 'il-m'], 'tel_aviv');
assignIds(['il-ha'], 'haifa');
assignIds(['il-z'], 'galilee');
assignIds(['il-d'], 'negev');

// --- Lebanon: 6 districts, south/north split matching the game's two Lebanon regions.
assignIds(['lb-na', 'lb-ja'], 'lebanon_south');
assignIds(['lb-as', 'lb-bi', 'lb-jl', 'lb-ba'], 'lebanon_north');

// --- Egypt: only the Sinai peninsula is its own game region; everything else is "Cairo".
const egypt = byCountry('eg');
const sinai = egypt.filter((f) => f.id === 'eg-sin' || f.id === 'eg-js');
assign(sinai, 'egypt_sinai');
assign(egypt.filter((f) => !sinai.includes(f)), 'egypt_cairo');

// --- Iraq: Basra + its immediate southern neighbors form "Basra"; the rest is "Baghdad".
const iraq = byCountry('iq');
const basraCluster = iraq.filter((f) => ['iq-ba', 'iq-ma', 'iq-dq', 'iq-mu'].includes(f.id));
assign(basraCluster, 'iraq_basra');
assign(iraq.filter((f) => !basraCluster.includes(f)), 'iraq_baghdad');

// --- Saudi Arabia / Iran / Turkey: no natural 2-way split in the source data, so divide each
// country's own provinces geographically in half (Saudi: north/south by latitude; Iran and
// Turkey: west/east by longitude), matching the game regions' own naming.
const [saudiSouth, saudiNorth] = splitByAxis(byCountry('sa'), 'lat');
assign(saudiNorth, 'saudi_north');
assign(saudiSouth, 'saudi_south');

const [iranWest, iranEast] = splitByAxis(byCountry('ir'), 'lon');
assign(iranWest, 'iran_west');
assign(iranEast, 'iran_east');

const [turkeyWest, turkeyEast] = splitByAxis(byCountry('tr'), 'lon');
assign(turkeyWest, 'turkey_west');
assign(turkeyEast, 'turkey_east');

// --- Palestine: the source data already has real Gaza Strip / West Bank admin-1 entries (no
// disjoint-polygon-splitting heuristic needed, unlike an earlier version of this pipeline).
assignIds(['ps-gzz'], 'gaza');
assignIds(['ps-wbk'], 'west_bank');

// --- The remaining 8 game regions are each a whole country, but — like every other country on
// Earth (see loadGameRegions.js) — still rendered as its real provinces/governorates, not one
// flat blob; they just all share the same single game region id and color.
assign(byCountry('jo'), 'jordan_amman');
assign(byCountry('sy'), 'syria_damascus');
assign(byCountry('ye'), 'yemen');
assign(byCountry('om'), 'oman');
assign(byCountry('ae'), 'uae');
assign(byCountry('qa'), 'qatar');
assign(byCountry('bh'), 'bahrain');
assign(byCountry('kw'), 'kuwait');

// Fallback only: every country in this dataset has at least one admin-1 subregion (verified when
// this pipeline was built), so this should always be empty — kept as a safety net rather than an
// assumption, in case future data updates ever introduce a country with none.
const consumedCountryIds = new Set(['il', 'eg', 'iq', 'sa', 'ir', 'tr', 'lb', 'jo', 'sy', 'ye', 'om', 'ae', 'qa', 'bh', 'kw', 'ps']);
const countriesWithSubregions = new Set(subregionFeatures.map((f) => subregionsMeta[f.id]?.countryId));
const restOfWorldCountryIds = countryFeatures
  .map((f) => f.id)
  .filter((id) => !consumedCountryIds.has(id) && !countriesWithSubregions.has(id));

const output = { featureToRegion: map, restOfWorldCountryIds };
writeFileSync(path.join(geoDir, 'gameRegions.json'), JSON.stringify(output));
console.log(`Wrote gameRegions.json: ${Object.keys(map).length} mapped features, ${restOfWorldCountryIds.length} rest-of-world countries.`);
