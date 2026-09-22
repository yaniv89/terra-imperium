// src/data/navalReach.js
// Age-gated naval reach (plan §7.5): sea-lanes.json carries every coastal-to-coastal COUNTRY
// distance for all time (recomputing that at real province-to-province granularity — hundreds of
// coastal provinces instead of ~150 coastal countries — was out of scope for the provinces
// migration; see Task 51) — this module answers "which of those lanes can THIS age actually
// sail", the same pattern techTree.js's yearAvailable already gates content by year rather than
// baking availability into the data file itself.
//
// Two different granularities meet here: `isCoastal` answers "is this EXACT province touchable by
// sea" (real, per-province — build-world-regions.mjs computed it from actual coastline geometry),
// while sea-lane DISTANCE is still computed per-country, then translated back to one representative
// coastal province per country (the first one build-world-regions.mjs happened to emit for it) so
// a naval unit's move options are always real region ids. `isReachableBySea` checks the whole
// target COUNTRY is in range, not just that one representative province, so amphibious assault can
// still target any of the target's coastal provinces once its country is within reach.
import { REGIONS_DATA } from './regions';
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

const countryOf = (regionId) => REGIONS_DATA[regionId]?.startOwner;

// One representative coastal province per country, for translating sea-lanes.json's country-level
// endpoints back into real region ids. Built once at module load, not per call.
const REPRESENTATIVE_COASTAL_PROVINCE = {};
Object.values(REGIONS_DATA).forEach((r) => {
  if (r.isCoastal && !REPRESENTATIVE_COASTAL_PROVINCE[r.startOwner]) {
    REPRESENTATIVE_COASTAL_PROVINCE[r.startOwner] = r.id;
  }
});

export const isCoastal = (regionId) => !!REGIONS_DATA[regionId]?.isCoastal;

// Every coastal-to-coastal distance from this region's country, regardless of age — sorted
// nearest first, with `.to` translated to that destination country's representative province.
export const getAllSeaLanes = (regionId) => {
  const lanes = SEA_LANES[countryOf(regionId)] || [];
  return lanes
    .map((lane) => ({ km: lane.km, to: REPRESENTATIVE_COASTAL_PROVINCE[lane.to] }))
    .filter((lane) => lane.to);
};

// Only the lanes a nation at `ageId` can actually cross.
export const getSeaLanesWithinReach = (regionId, ageId) => {
  const reach = NAVAL_REACH_KM[ageId];
  if (reach === undefined) return [];
  return getAllSeaLanes(regionId).filter((lane) => lane.km <= reach);
};

// True once `toRegionId`'s whole COUNTRY is within reach — not just its one representative
// province — so an amphibious assault can target any of that country's coastal provinces once any
// point of it is reachable.
export const isReachableBySea = (fromRegionId, toRegionId, ageId) => {
  const toCountry = countryOf(toRegionId);
  return getSeaLanesWithinReach(fromRegionId, ageId).some((lane) => countryOf(lane.to) === toCountry);
};
