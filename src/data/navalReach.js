// src/data/navalReach.js
// Age-gated naval reach (plan §7.5): sea-lanes.json carries every coastal-to-coastal distance for
// all time — this module answers "which of those lanes can THIS age actually sail", the same
// pattern techTree.js's yearAvailable already gates content by year rather than baking
// availability into the data file itself. Naval combat/invasion mechanics themselves are Phase C
// work; this module is the geography they'll read from.
import COASTAL_FLAGS from './geo/coastal.json';
import SEA_LANES from './geo/sea-lanes.json';

// Reproduces real history rather than approximating it: island nations are genuinely safe until
// the Age of Gunpowder's transoceanic reach arrives.
export const NAVAL_REACH_KM = {
  bronze: 200,
  classical: 500,
  kingdoms: 1000,
  gunpowder: 5000,
  modern: Infinity
};

export const isCoastal = (regionId) => !!COASTAL_FLAGS[regionId];

// Every coastal-to-coastal distance from this region, regardless of age — sorted nearest first.
export const getAllSeaLanes = (regionId) => SEA_LANES[regionId] || [];

// Only the lanes a nation at `ageId` can actually cross.
export const getSeaLanesWithinReach = (regionId, ageId) => {
  const reach = NAVAL_REACH_KM[ageId];
  if (reach === undefined) return [];
  return getAllSeaLanes(regionId).filter((lane) => lane.km <= reach);
};

export const isReachableBySea = (fromRegionId, toRegionId, ageId) =>
  getSeaLanesWithinReach(fromRegionId, ageId).some((lane) => lane.to === toRegionId);
