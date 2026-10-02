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
