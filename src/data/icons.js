// src/data/icons.js
// The delivered 2D icons (art spec section 8) as one index: iconUrl(group, id) is the URL of
// src/assets/icons/<group>/<id>.svg (or .webp for a raster-only redesign), or null when the art
// has not been delivered, in which case the caller draws its old glyph (GameIcon's fallback).
// Assets come from scripts/icons/import-ui-icons.mjs. The colour file doubles as the mask: its
// alpha is the delivered mask's, so CSS mask-image on it gives the tintable silhouette.
import { BUILDING_CATEGORIES, EXTRACTION_BUILDINGS } from './buildings';
import { AGE_ORDER, artAgeFor } from './ages';

const files = import.meta.glob('../assets/icons/*/*.{svg,webp}', { eager: true, query: '?url', import: 'default' });

const URLS = {};
for (const [file, url] of Object.entries(files)) {
  const m = file.match(/icons\/([a-z]+)\/([a-z0-9_-]+)\.(svg|webp)$/);
  if (!m) continue;
  (URLS[m[1]] ||= {})[m[2]] = url;
}

export const ICON_GROUPS = ['resources', 'improvements', 'buildings', 'wonders', 'units', 'ships', 'cities', 'ages', 'markers', 'battle', 'ui', 'independents'];
// independents: an independent city's personality shields (raiders, mercantile, fortress, tribal) and
// its banner's frame (banner-frame), on the map's badge and banner (gl/spriteArt.js) and CityBanners.jsx.
export const INDEPENDENT_ICON_IDS = ['raiders', 'mercantile', 'fortress', 'tribal', 'banner-frame'];
// City-state type badges (UI18, decision 42): round medallions in the type's colour, never a heater
// shield, so a city-state's type is not read as its personality. Plus the patron mark ("they favour
// you"). Drawn in scripts/icons/ui18-citystate-icons.mjs (plans/art-pilot/ui18-citystates/LOG.md).
export const CITY_STATE_ICON_IDS = {
  trade: 'citystate-trade', military: 'citystate-military', science: 'citystate-science',
  culture: 'citystate-culture', raiders: 'citystate-raiders'
};
export const CITY_STATE_PATRON_ICON_ID = 'citystate-patron';
/** A city-state type's badge URL, or null (the caller draws its placeholder). */
export const cityStateIconUrl = (type) => iconUrl('independents', CITY_STATE_ICON_IDS[type]);
export const cityStatePatronIconUrl = () => iconUrl('independents', CITY_STATE_PATRON_ICON_ID);
// battle: the battle economy's building icons (build-house ...), rendered from the battle's own models by
// scripts/art/build-icons.mjs; data/economy.js BUILDINGS[*].icon names them. Plus the battle screen's
// hand-drawn glyphs below. ui: campaign-side cards and markers. Both sets are drawn in
// scripts/icons/oct13-ui-icons.mjs (art update of 13 October; plans/art-pilot/ui-icons-oct13/LOG.md).

// Battle stocks (UI14): the sim's resource id (food, wood, stone, gold: Q1, U01), or a HUD counter,
// to its icon in `battle`.
export const BATTLE_STOCK_ICON_IDS = {
  food: 'stock-food', wood: 'stock-wood', stone: 'stock-stone', gold: 'stock-gold',
  supply: 'stock-supply', population: 'stock-population'
};
export const battleStockIconUrl = (res) => iconUrl('battle', BATTLE_STOCK_ICON_IDS[res]);

// The rest of the battle screen's glyphs: base identity (UI16; base-marker and base-status tint, their
// coloured parts are currentColor), select all and find army (UI08), close and stop working (UI11),
// the placement label's states and the tiling field edge, 96x24 (UI06).
export const BATTLE_GLYPH_IDS = [
  'base-marker', 'base-status', 'select-all', 'find-army', 'close', 'stop-working',
  'placement-legal', 'placement-blocked', 'placement-overlap', 'placement-fog', 'field-edge'
];
// Campaign side: the capture card's four choices and its header plate, 512x96 (UI15; a choice that is
// not on offer takes the .game-icon-disabled class, GameIcon's `disabled`), the no man's land badge of
// the pre-battle card (UI17) and the map's Hold marker (UI07).
export const CAPTURE_CHOICE_ICON_IDS = { conquer: 'capture-conquer', raze: 'capture-raze', tributary: 'capture-tributary', free: 'capture-free' };
export const UI_ICON_IDS = [...Object.values(CAPTURE_CHOICE_ICON_IDS), 'capture-header', 'no-mans-land', 'hold-map'];
export const uiIconUrl = (id) => iconUrl('ui', id);

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
export const cityIconUrl = (size, ageId) => iconUrl('cities', `city-${CITY_SIZES.includes(size) ? size : 'small'}-${artAgeFor((a) => URLS.cities?.[`city-small-${a}`], ageId) || 'bronze'}`);

export const ageIconUrl = (ageId) => iconUrl('ages', ageId);
export const markerIconUrl = (kind) => iconUrl('markers', kind);
export const resourceIconUrl = (resourceId) => iconUrl('resources', resourceId);
export const improvementIconUrl = (improvementId) => iconUrl('improvements', improvementId);
export const wonderIconUrl = (projectId) => iconUrl('wonders', projectId);

/** Sanity: every tier list matches its category's tier count (tested). */
export const buildingIconTiersMatch = () => Object.entries(BUILDING_CATEGORIES)
  .every(([id, cat]) => (BUILDING_ICON_IDS[id] || []).length === cat.tiers.length)
  && Object.keys(EXTRACTION_BUILDINGS).every(id => EXTRACTION_ICON_IDS[id]);
