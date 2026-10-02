// src/utils/markerPosition.js
// Where a map marker is drawn: at its tile (armies stand on tiles since workstream 5), else at its
// city's coordinates. Shared by the flat map, the globe and the close view.
import { getTiles } from '../data/geo/tiles';
import { REGION_COORDINATES } from '../data/regionCoordinates';

export const markerLatLng = (m) => {
  if (m.tile != null && m.tile >= 0) { const { lat, lon } = getTiles().latLonOf(m.tile); return { lat, lng: lon }; }
  const c = REGION_COORDINATES[m.regionId];
  return c ? { lat: c.lat, lng: c.lng } : null;
};
