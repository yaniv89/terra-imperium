// scripts/geo/build-country-capitals.mjs
// Generates src/data/geo/countryCapitals.json: real per-country capital-city name + coordinates,
// sourced automatically from two npm packages (both devDependencies, build-time only — nothing
// ships in the app bundle) rather than hand-researched, per this project's standing rule of
// automating data problems instead of asking a human to source ~240 facts by hand:
//   - `world-countries` gives the real capital-city NAME per ISO-3166-1 alpha-2 code.
//   - `cities.json` (GeoNames-derived) gives that named city's real lat/lng, looked up by name
//     within the same country — needed because build-world-regions.mjs matches capitals to admin-1
//     provinces by POINT-IN-POLYGON against real coordinates, not by string-matching the capital's
//     name against province names (most countries' capital city isn't its own admin-1 province at
//     all — e.g. Rome sits inside the Lazio region, Warsaw inside Mazowieckie — so name matching
//     alone left 147/240 countries unresolved when first tried).
// Keyed by the same lowercase ISO-3166-1 alpha-2 codes already used as `startOwner` everywhere else.
//
// Run with: node scripts/geo/build-country-capitals.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import worldCountries from 'world-countries';
import cities from 'cities.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const geoDir = path.join(__dirname, '../../src/data/geo');
const countriesMeta = JSON.parse(readFileSync(path.join(geoDir, 'countries-meta.json'), 'utf8'));

const byCca2 = {};
worldCountries.forEach((c) => { byCca2[c.cca2.toLowerCase()] = c; });

const citiesByCountry = {};
cities.forEach((c) => { (citiesByCountry[c.country] ||= []).push(c); });

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const findCityCoords = (cca2, capitalName) => {
  const candidates = citiesByCountry[cca2] || [];
  const target = normalize(capitalName);
  // Exact normalized match first, then "starts with" (GeoNames sometimes drops a suffix like
  // "City" or spells a compound name without the space/hyphen the source capital name uses).
  const exact = candidates.find((c) => normalize(c.name) === target);
  if (exact) return exact;
  const loose = candidates.find((c) => normalize(c.name).startsWith(target) || target.startsWith(normalize(c.name)));
  return loose || null;
};

const capitals = {};
const noCoords = [];
Object.keys(countriesMeta).forEach((countryId) => {
  const entry = byCca2[countryId];
  const capitalName = entry?.capital?.[0];
  if (!capitalName) return; // no capital data at all for this code — build-world-regions.mjs falls back
  const cca2 = entry.cca2; // uppercase, matches cities.json's `country` field
  const coords = findCityCoords(cca2, capitalName);
  if (coords) {
    capitals[countryId] = { name: capitalName, lat: parseFloat(coords.lat), lng: parseFloat(coords.lng) };
  } else {
    capitals[countryId] = { name: capitalName };
    noCoords.push(`${countryId} (${capitalName})`);
  }
});

writeFileSync(path.join(geoDir, 'countryCapitals.json'), JSON.stringify(capitals, null, 2));
console.log(`Wrote countryCapitals.json: ${Object.keys(capitals).length} of ${Object.keys(countriesMeta).length} countries have a capital name; ${Object.keys(capitals).length - noCoords.length} of those also resolved real coordinates.`);
if (noCoords.length > 0) {
  console.log(`No coordinate match in cities.json for: ${noCoords.join(', ')} — build-world-regions.mjs falls back to name-matching or the smallest-area heuristic for these.`);
}
