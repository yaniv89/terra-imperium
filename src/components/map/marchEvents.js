// src/components/map/marchEvents.js
// Start choosing where an army marches from anywhere (the region card), without threading
// callbacks through the tree. MarchContext.jsx listens.
export const START_MARCH = 'ti:start-march';
// `naval`: the fleets in that port sail instead of the army marching.
export const startMarch = (fromRegionId, { naval = false } = {}) => window.dispatchEvent(new CustomEvent(START_MARCH, { detail: { from: fromRegionId, naval } }));
