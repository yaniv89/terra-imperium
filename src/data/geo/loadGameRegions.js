// src/data/geo/loadGameRegions.js
// The globe is now the ONLY game map (Phase 14 correction — the old hand-drawn flat SVG map has
// been removed entirely). This turns the real-world country/province geometry from
// loadWorldFeatures.js into the 28 hand-authored game regions (src/data/regions.js), using the
// static featureId -> gameRegionId map built by scripts/geo/build-game-regions.mjs.
//
// Every OTHER country on Earth is rendered too, subdivided into its own real admin-1
// provinces/states/governorates (not a single flat per-country blob) — every country in this
// dataset has at least one admin-1 subregion, confirmed when this pipeline was built, so there's
// no whole-country fallback needed in practice (restOfWorldCountryIds below stays empty; it's a
// safety net only). The Golan Heights is the one exception: it has no province of its own in the
// source data (its territory is fused into the surrounding countries' outlines), so it's a small
// hand-authored polygon here instead of real admin-1 geometry.
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
  const restOfWorldFeatures = [];

  // Every subregion either belongs to one of the 28 game regions (looked up directly by its own
  // id — see build-game-regions.mjs) or is a real province of some other country, rendered as its
  // own feature so the whole planet reads as an actual subdivided map, not flat per-country blobs.
  subregions.forEach((f) => {
    const gameRegionId = featureToRegion[f.id];
    if (gameRegionId) {
      gameRegionFeatures.push({ ...f, properties: { ...f.properties, gameRegionId } });
    } else {
      restOfWorldFeatures.push(f);
    }
  });

  // Fallback only (see file header) — a whole-country polygon for any country that somehow has no
  // admin-1 subregions in the dataset, so nothing is ever silently missing from the globe. The
  // ~275KB country topology is only fetched at all if this list is actually non-empty.
  if (restOfWorldCountryIds.length > 0) {
    const countries = await loadCountryFeatures();
    countries.forEach((f) => {
      if (restOfWorldCountryIds.includes(f.id)) restOfWorldFeatures.push(f);
    });
  }

  cached = { gameRegionFeatures, restOfWorldFeatures };
  return cached;
};
