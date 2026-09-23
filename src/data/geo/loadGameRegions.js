// src/data/geo/loadGameRegions.js
// The globe is the only game map, and every real admin-1 province on Earth is its own playable
// game region (src/data/regions.js, scripts/geo/build-world-regions.mjs) — a province's own id
// (e.g. 'jo-am' for Amman) IS its game region id, matching the province-level record
// build-world-regions.mjs generated for it. A whole country is just the set of regions sharing a
// startOwner, not a region in its own right.
import { loadCountryFeatures, loadSubregionFeatures } from './loadWorldFeatures';
import gameRegionsData from './gameRegions.json';

const { restOfWorldCountryIds } = gameRegionsData;

let cached = null;

export const loadGameRegionFeatures = async () => {
  if (cached) return cached;

  const subregions = await loadSubregionFeatures();

  const gameRegionFeatures = subregions.map((f) => ({
    ...f,
    properties: { ...f.properties, gameRegionId: f.id }
  }));

  // Fallback only — a whole-country polygon, tagged with its own country id as the game region
  // id, for any country that has no admin-1 subregions in the dataset. The ~275KB country
  // topology is only fetched at all if this list is actually non-empty.
  if (restOfWorldCountryIds.length > 0) {
    const countries = await loadCountryFeatures();
    countries.forEach((f) => {
      if (restOfWorldCountryIds.includes(f.id)) {
        gameRegionFeatures.push({ ...f, properties: { ...f.properties, gameRegionId: f.id } });
      }
    });
  }

  cached = { gameRegionFeatures };
  return cached;
};
