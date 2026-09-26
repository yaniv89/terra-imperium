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

// Bug fix (plan feedback: "still can't pick Tel Aviv"): GlobeView.jsx used to run the assist above
// unconditionally against EVERY region, with no regard for how good the raw hit already was. Tel
// Aviv is a tiny enclave inside HaMerkaz (a much bigger district) — HaMerkaz's own label point can
// legitimately be the closest thing on screen to some pixels that still land, correctly, on Tel
// Aviv's own polygon (an elongated small region's own label isn't necessarily the closest point to
// every part of it), so the plain "closest centroid wins" search would happily override an
// ALREADY-CORRECT raw hit with the bigger neighbor. Comparing raw-hit distance alone doesn't fully
// fix this (the bigger neighbor's label can still be nominally closer even to a valid click), so
// this instead only ever considers a candidate SMALLER (by `extent`, both regions' own on-screen
// size proxy — see build-region-coordinates.mjs) than the region actually hit: the assist can still
// rescue a genuine miss (raw hit is the big region, a smaller one's label is nearby), it just can
// never redirect AWAY from a region that's already the smallest thing under the cursor.
export const resolveClickedRegionId = (
  rawId, regionCoordinates, project, clickX, clickY, maxDistance = CLICK_ASSIST_MAX_PIXEL_DISTANCE
) => {
  const rawExtent = regionCoordinates[rawId]?.extent;
  if (rawExtent == null) return rawId; // no size data for whatever was hit — nothing safe to compare against
  const smallerCandidates = Object.fromEntries(
    Object.entries(regionCoordinates).filter(([id, r]) => id !== rawId && r.extent != null && r.extent < rawExtent)
  );
  return findClickAssistRegionId(smallerCandidates, project, clickX, clickY, maxDistance) || rawId;
};
