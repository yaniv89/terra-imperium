// src/data/geo/loadGameRegions.js
// The globe is the only game map, and every country on Earth is a real, playable game region
// (src/data/regions.js, scripts/geo/build-world-regions.mjs). This turns the real-world province
// geometry from loadWorldFeatures.js into game regions: every province's own country code IS its
// game region id — a province of Argentina gets gameRegionId 'ar', matching the whole-country
// region build-world-regions.mjs generated for it.
import { loadCountryFeatures, loadSubregionFeatures } from './loadWorldFeatures';
import gameRegionsData from './gameRegions.json';

const { restOfWorldCountryIds } = gameRegionsData;

let cached = null;

export const loadGameRegionFeatures = async () => {
  if (cached) return cached;

  const subregions = await loadSubregionFeatures();

  const gameRegionFeatures = subregions.map((f) => ({
    ...f,
    properties: { ...f.properties, gameRegionId: f.properties.countryId }
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
