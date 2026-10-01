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

// Resolve the geographic intersection against province rings. Rendered triangulation can
// overlap a narrow neighbor; holes and the antimeridian must retain their real meaning.
export const findRegionAtCoordinates = (features, lat, lng) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const ringContains = ring => {
    const origin=ring[0][0];
    const wrap = x => origin+((x-origin+540)%360)-180;
    const point=wrap(lng);
    let hit=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i],b=ring[j],ax=wrap(a[0]),bx=wrap(b[0]);

      if((a[1]>lat)!==(b[1]>lat) && point<(bx-ax)*(lat-a[1])/(b[1]-a[1])+ax)hit=!hit;
    }
    return hit;
  };
  for(const f of features || []){
    const groups=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];
    if(groups.some(rings=>ringContains(rings[0])&&!rings.slice(1).some(ringContains)))return f.properties?.gameRegionId || f.id;
  }
  return null;
};
