// src/data/geo/loadGameRegions.js
// The globe is the ONLY game map, and — since the world-region expansion (src/data/regions.js,
// scripts/geo/build-world-regions.mjs) — EVERY country on Earth is a real, playable game region,
// not just the 28 hand-authored ones. This turns the real-world province geometry from
// loadWorldFeatures.js into game regions: a province either belongs to one of the 28 hand-
// authored regions (looked up by its own id — see build-game-regions.mjs) or, for every other
// country, its own country code IS the game region id (see build-world-regions.mjs) — every
// province of e.g. Argentina gets gameRegionId 'ar', matching the single whole-country region
// that generator created for it.
import { loadCountryFeatures, loadSubregionFeatures } from './loadWorldFeatures';
import gameRegionsData from './gameRegions.json';

const { featureToRegion, restOfWorldCountryIds } = gameRegionsData;

// Rough real-world bounding box of the Golan Heights (~32.6-33.27N, 35.65-35.95E). Wound to match
// the same orientation as every other (Natural-Earth-derived) ring here — a hand-authored ring
// with the opposite winding order was found (by bisecting a broken render down to this single
// feature) to corrupt the whole globe's rendering under this project's software WebGL renderer.
const GOLAN_FEATURE = {
  type: 'Feature',
  id: 'golan',
  properties: { gameRegionId: 'golan', name: 'Golan Heights' },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [35.65, 32.62], [35.65, 33.27], [35.95, 33.27], [35.95, 32.62], [35.65, 32.62]
    ]]
  }
};

let cached = null;

export const loadGameRegionFeatures = async () => {
  if (cached) return cached;

  const subregions = await loadSubregionFeatures();

  const gameRegionFeatures = [GOLAN_FEATURE];

  subregions.forEach((f) => {
    const gameRegionId = featureToRegion[f.id] || f.properties.countryId;
    gameRegionFeatures.push({ ...f, properties: { ...f.properties, gameRegionId } });
  });

  // Fallback only — a whole-country polygon, tagged with its own country id as the game region
  // id, for any country that somehow has no admin-1 subregions in the dataset (verified empty in
  // practice when this pipeline was built, so nothing is ever silently missing from the globe).
  // The ~275KB country topology is only fetched at all if this list is actually non-empty.
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
