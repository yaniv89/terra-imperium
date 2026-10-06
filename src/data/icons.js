// src/data/icons.js
// The delivered 2D icons (art spec section 8) as one index: iconUrl(group, id) is the URL of
// src/assets/icons/<group>/<id>.svg (or .webp for a raster-only redesign), or null when the art
// has not been delivered, in which case the caller draws its old glyph (GameIcon's fallback).
// Assets come from scripts/icons/import-ui-icons.mjs. The colour file doubles as the mask: its
// alpha is the delivered mask's, so CSS mask-image on it gives the tintable silhouette.
import { BUILDING_CATEGORIES, EXTRACTION_BUILDINGS } from './buildings';
import { AGE_ORDER } from './ages';

const files = import.meta.glob('../assets/icons/*/*.{svg,webp}', { eager: true, query: '?url', import: 'default' });

const URLS = {};
for (const [file, url] of Object.entries(files)) {
  const m = file.match(/icons\/([a-z]+)\/([a-z0-9_-]+)\.(svg|webp)$/);
  if (!m) continue;
  (URLS[m[1]] ||= {})[m[2]] = url;
}

export const ICON_GROUPS = ['resources', 'improvements', 'buildings', 'wonders', 'units', 'ships', 'cities', 'ages', 'markers'];

/** URL of a delivered icon, or null (the caller then falls back to its old glyph). */
export const iconUrl = (group, id) => (id && URLS[group]?.[id]) || null;

/** Every delivered id of a group (tests and the icon audit). */
export const iconIds = (group) => Object.keys(URLS[group] || {});

// Building tiers: the art id of each tier of src/data/buildings.js, by category in tier order
// (the same ids as the close view's landmark models). Defense tiers have no icon by design: they
// are the town's wall ring, not a landmark, and keep the category glyph. Cathedral has no art yet.
export const BUILDING_ICON_IDS = {
  food: ['granary', 'irrigation', 'farm_estate', 'crop_rotation_farm', 'mechanized_farm'],
  economy: ['market', 'bazaar', 'bank', 'stock_exchange'],
  military: ['barracks', 'drill_yard', 'military_academy', 'war_college'],
  defense: [null, null, null, null],
  science: ['library', 'scriptorium', 'university', 'research_lab'],
  industry: ['workshop', 'manufactory', 'factory'],
  culture: ['shrine', 'temple', 'cathedral', 'civic_center'],
  naval: ['harbor', 'shipyard', 'naval_base', 'carrier_dock'],
  logistics: ['road_post', 'highway', 'rail_depot']
};
export const EXTRACTION_ICON_IDS = { copper: 'copper_mine', iron: 'iron_foundry', oil: 'oil_well' };

/** Icon URL of a building tier (category + tier index), or null. */
export const buildingIconUrl = (categoryId, tierIndex) => iconUrl('buildings', BUILDING_ICON_IDS[categoryId]?.[tierIndex]);

/** Icon URL of a category's tier for an age: the highest tier at or below that age. */
export const buildingIconUrlForAge = (categoryId, ageId) => {
  const tiers = BUILDING_CATEGORIES[categoryId]?.tiers || [];
  const ai = AGE_ORDER.indexOf(ageId);
  let best = -1;
  tiers.forEach((t, i) => { if (AGE_ORDER.indexOf(t.age) <= ai) best = i; });
  return best >= 0 ? buildingIconUrl(categoryId, best) : null;
};

/** Icon URL of an extraction building (by resource id: copper, iron, oil). */
export const extractionIconUrl = (resourceId) => iconUrl('buildings', EXTRACTION_ICON_IDS[resourceId]);

// Unit classes: every class has its art except 'naval', which is drawn by its line (ships).
export const unitIconUrl = (classId) => iconUrl('units', classId);
export const shipIconUrl = (lineId) => iconUrl('ships', lineId || 'warship');

// City badges: size is the town tier (small / medium / big from the province's building count,
// src/components/map/closeView/townTiers.js, the same tiers as the 3D towns), age the owner's.
export const CITY_SIZES = ['small', 'medium', 'big'];
export const cityIconUrl = (size, ageId) => iconUrl('cities', `city-${CITY_SIZES.includes(size) ? size : 'small'}-${AGE_ORDER.includes(ageId) ? ageId : 'bronze'}`);

export const ageIconUrl = (ageId) => iconUrl('ages', ageId);
export const markerIconUrl = (kind) => iconUrl('markers', kind);
export const resourceIconUrl = (resourceId) => iconUrl('resources', resourceId);
export const improvementIconUrl = (improvementId) => iconUrl('improvements', improvementId);
export const wonderIconUrl = (projectId) => iconUrl('wonders', projectId);

/** Sanity: every tier list matches its category's tier count (tested). */
export const buildingIconTiersMatch = () => Object.entries(BUILDING_CATEGORIES)
  .every(([id, cat]) => (BUILDING_ICON_IDS[id] || []).length === cat.tiers.length)
  && Object.keys(EXTRACTION_BUILDINGS).every(id => EXTRACTION_ICON_IDS[id]);
