// src/components/map/marchEvents.js
// Start choosing where an army marches from anywhere (the region card), without threading
// callbacks through the tree. MarchContext.jsx listens.
export const START_MARCH = 'ti:start-march';
// `naval`: the fleets in that port sail instead of the army marching.
// `unitIds`: only these units (the army sheet marches the stack on one tile, not the whole base).
export const startMarch = (fromRegionId, { naval = false, unitIds = null } = {}) => window.dispatchEvent(new CustomEvent(START_MARCH, { detail: { from: fromRegionId, naval, unitIds } }));
// Open the army sheet for the stack on `tile`, or the tile sheet for `tile` (the next prompt).
export const SELECT_ARMY = 'ti:select-army';
export const SELECT_TILE = 'ti:select-tile';
export const selectArmy = (tile) => window.dispatchEvent(new CustomEvent(SELECT_ARMY, { detail: tile }));
export const selectTile = (tile) => window.dispatchEvent(new CustomEvent(SELECT_TILE, { detail: tile }));
// Open the nation sheet for `nationId` (the region card's owner name, NationSheet.jsx).
export const SELECT_NATION = 'ti:select-nation';
export const selectNation = (nationId) => window.dispatchEvent(new CustomEvent(SELECT_NATION, { detail: nationId }));
// Select a city (open its card) from anywhere: the city list, a "needs you" chip, the turn report.
export const SELECT_REGION = 'ti:select-region';
export const selectRegion = (regionId) => window.dispatchEvent(new CustomEvent(SELECT_REGION, { detail: regionId }));
// Centre the map on a city while something about it is open (the event sheet); null releases it.
export const FOCUS_REGION = 'ti:focus-region';
export const focusRegion = (regionId) => window.dispatchEvent(new CustomEvent(FOCUS_REGION, { detail: regionId }));
// Open a city's management sheet on one of its tabs ('build' for End Turn's "Choose production"),
// selecting the city and centring the map on it.
export const MANAGE_CITY = 'ti:manage-city';
export const manageCity = (regionId, tab = 'overview') => window.dispatchEvent(new CustomEvent(MANAGE_CITY, { detail: { regionId, tab } }));
