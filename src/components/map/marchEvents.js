// src/components/map/marchEvents.js
// Start choosing where an army marches from anywhere (the region card), without threading
// callbacks through the tree. MarchContext.jsx listens.
export const START_MARCH = 'ti:start-march';
export const startMarch = (fromRegionId) => window.dispatchEvent(new CustomEvent(START_MARCH, { detail: fromRegionId }));
