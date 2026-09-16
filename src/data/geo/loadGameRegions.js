// src/data/geo/loadGameRegions.js
// The globe is now the ONLY game map (Phase 14 correction — the old hand-drawn flat SVG map has
// been removed entirely). This turns the real-world country/province geometry from
// loadWorldFeatures.js into the 28 hand-authored game regions (src/data/regions.js), using the
// static featureId -> gameRegionId map built by scripts/geo/build-game-regions.mjs, plus two
// pieces of real geometry that map can't express:
//   - Gaza and the West Bank are one merged "Palestine" country feature in the source data, but
//     they're two disjoint polygon parts (a small coastal one and a larger inland one) — this
//     splits that MultiPolygon by part instead of needing a separate geometry source.
//   - The Golan Heights has no province of its own in the source data (its territory is fused
//     into the surrounding country outlines), so it's a small hand-authored polygon here rather
//     than real admin-1 geometry — reasonable for a small, mostly-uninhabited plateau.
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

  const [countries, subregions] = await Promise.all([loadCountryFeatures(), loadSubregionFeatures()]);

  const gameRegionFeatures = [];

  subregions.forEach((f) => {
    const gameRegionId = featureToRegion[f.id];
    if (gameRegionId) gameRegionFeatures.push({ ...f, properties: { ...f.properties, gameRegionId } });
  });

  // Every rest-of-world country stays its own feature (not merged) so each can carry its own
  // WORLD_NATIONS color for a real political-map look, not a single flat backdrop hue.
  const restOfWorldFeatures = [];
  countries.forEach((f) => {
    const gameRegionId = featureToRegion[f.id];
    if (gameRegionId) {
      gameRegionFeatures.push({ ...f, properties: { ...f.properties, gameRegionId } });
      return;
    }
    if (f.id === 'ps') {
      // Two disjoint MultiPolygon parts: the smaller/coastal one is Gaza, the larger inland one
      // is the West Bank (verified against real coordinates when this mapping was built).
      const parts = f.geometry.coordinates;
      const [gazaPart, westBankPart] = parts[0][0].length <= parts[1][0].length ? parts : [parts[1], parts[0]];
      gameRegionFeatures.push({
        type: 'Feature', id: 'ps-gaza', properties: { ...f.properties, gameRegionId: 'gaza' },
        geometry: { type: 'Polygon', coordinates: gazaPart }
      });
      gameRegionFeatures.push({
        type: 'Feature', id: 'ps-westbank', properties: { ...f.properties, gameRegionId: 'west_bank' },
        geometry: { type: 'Polygon', coordinates: westBankPart }
      });
      return;
    }
    if (restOfWorldCountryIds.includes(f.id)) restOfWorldFeatures.push(f);
  });

  gameRegionFeatures.push(GOLAN_FEATURE);

  cached = { gameRegionFeatures, restOfWorldFeatures };
  return cached;
};
