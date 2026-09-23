// src/utils/regionClickAssist.js
// A "fat-finger" correction for selecting small regions on the globe (GlobeView.jsx). react-globe.gl's
// own click raycasting is precise, but a region whose real polygon is only a few screen pixels wide
// (a small country, a small province) is genuinely hard to hit exactly — miss by a few pixels and the
// ray lands on whichever larger neighbor actually occupies that spot instead, which is exactly what
// got reported: tapping a small region kept selecting "all the regions around" it.
//
// This checks every region's centroid (REGION_COORDINATES) for whichever one projects closest to the
// click on screen, within a small pixel tolerance, and prefers that region over the raw click's own
// polygon hit — but only when a candidate is genuinely close, so an ordinary click deep inside a
// normal-sized region is completely unaffected (no other region's centroid will be anywhere near it).
//
// Takes a `project(lat, lng) => { x, y, visible } | null` callback rather than talking to three.js/
// react-globe.gl directly, so this is unit testable without a real WebGL camera.
export const CLICK_ASSIST_MAX_PIXEL_DISTANCE = 24;

export const findClickAssistRegionId = (
  regionCoordinates, project, clickX, clickY, maxDistance = CLICK_ASSIST_MAX_PIXEL_DISTANCE
) => {
  let bestId = null;
  let bestDist = maxDistance;
  Object.entries(regionCoordinates).forEach(([id, { lat, lng }]) => {
    const point = project(lat, lng);
    if (!point || !point.visible) return;
    const dist = Math.hypot(point.x - clickX, point.y - clickY);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = id;
    }
  });
  return bestId;
};
