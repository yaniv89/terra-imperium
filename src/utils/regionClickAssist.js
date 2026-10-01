// Exact polygon hits take precedence over proximity assistance. Centroids are only
// useful as an optional fallback when no polygon was hit.
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

// A geometric polygon hit is authoritative. The old smaller-centroid override still stole
// valid clicks from larger/elongated provinces at low zoom. Proximity cannot establish that
// the user intended a different region. Assistance is only meaningful when nothing was hit.
export const resolveClickedRegionId = (
  rawId, regionCoordinates, project, clickX, clickY, maxDistance = CLICK_ASSIST_MAX_PIXEL_DISTANCE
) => {
  if (rawId) return rawId;
  if (!regionCoordinates || !project || !Number.isFinite(clickX) || !Number.isFinite(clickY)) return null;
  return findClickAssistRegionId(regionCoordinates, project, clickX, clickY, maxDistance);
};
