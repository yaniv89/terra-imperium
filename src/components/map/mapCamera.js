// src/components/map/mapCamera.js
// Where the map camera may go (plans/ui/map-camera/): the lat/lng of a place (a tile, a city), the
// first real place of a list with the player's own fallbacks (the selected army, then the capital),
// the place of a battle the player just fought, and the camera remembered while the flat map is
// unmounted. Never a default spot: a target that cannot be found is null and the camera stays put.
// No React, no three.js: MapContainer.jsx and gl/GLMapView.jsx read it, tests cover it.
import { getTiles } from '../../data/geo/tiles';
import { REGION_COORDINATES } from '../../data/regionCoordinates';

/** `lng` brought into [-180, 180). */
export const normalLng = (lng) => (lng >= -180 && lng < 180 ? lng : ((((lng + 180) % 360) + 360) % 360) - 180);

/** A real point on Earth as { lat, lng } (lng wrapped into [-180, 180)), else null. */
export const cleanLatLng = (ll) => {
  if (!ll) return null;
  const lat = Number(ll.lat); const lng = Number(ll.lng ?? ll.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90) return null;
  return { lat, lng: normalLng(lng) };
};

/** The centre of tile `tile`, or null for no tile, a tile outside the world or a bad id. */
export const latLngOfTile = (tile, tiles = getTiles()) => {
  const t = typeof tile === 'string' && tile.trim() !== '' ? Number(tile) : tile;
  if (!Number.isInteger(t) || t < 0 || !tiles || t >= tiles.count) return null;
  return cleanLatLng(tiles.latLonOf(t));
};

/**
 * The lat/lng of city `id`: its registry coordinates, else its tile in the state. A razed or
 * unknown city (an old region id, a city that no longer exists) is null.
 */
export const latLngOfCity = (state, id, { coords = REGION_COORDINATES, tiles } = {}) => {
  if (id == null || id === '') return null;
  const c = cleanLatLng(coords?.[id]);
  if (c) return c;
  const tile = state?.regions?.[id]?.tile;
  return tile == null ? null : latLngOfTile(tile, tiles);
};

/** The lat/lng of a place { tile } or { regionId } (the tile first), else null. */
export const latLngOfPlace = (state, place, opts = {}) => {
  if (!place) return null;
  return (place.tile != null ? latLngOfTile(place.tile, opts.tiles) : null) || latLngOfCity(state, place.regionId, opts);
};

/**
 * Where the camera goes for a list of places, first found wins, then the player's selected army's
 * tile (`selectedArmyTile`), then the player's capital. { lat, lng, from } or null (stay put).
 * `from` says which one: 'place' (with `index`), 'army' or 'capital'.
 */
export const cameraTarget = (state, places = [], { selectedArmyTile = null, ...opts } = {}) => {
  const list = Array.isArray(places) ? places : [places];
  for (let i = 0; i < list.length; i++) {
    const ll = latLngOfPlace(state, list[i], opts);
    if (ll) return { ...ll, from: 'place', index: i };
  }
  const army = selectedArmyTile != null ? latLngOfTile(selectedArmyTile, opts.tiles) : null;
  if (army) return { ...army, from: 'army' };
  const capId = state?.nations?.[state?.playerNationId]?.capitalRegionId;
  const cap = latLngOfCity(state, capId, opts);
  return cap ? { ...cap, from: 'capital' } : null;
};

/** The places of a battle report, best first: the battlefield's tile, the city fought for, where the attack came from. */
export const battlePlaces = (report) => (report ? [{ tile: report.tile }, { regionId: report.targetRegionId }, { regionId: report.fromRegionId }] : []);

/**
 * The newest battle report that is new since `seenTopId` (state.battleReports is newest first) and
 * was fought this turn or the turn just played, else null. An unknown `seenTopId` (a loaded save)
 * only counts reports of those turns too, so an old save's battles never move the camera.
 */
export const freshBattleReport = (reports, seenTopId, turnNumber) => {
  if (!Array.isArray(reports) || !reports.length || reports[0]?.id === seenTopId) return null;
  const seenAt = seenTopId == null ? -1 : reports.findIndex((r) => r.id === seenTopId);
  const fresh = seenAt === -1 ? reports : reports.slice(0, seenAt);
  return fresh.find((r) => !(Number.isFinite(turnNumber) && Number.isFinite(r.turn)) || r.turn >= turnNumber - 1) || null;
};

// ---------------------------------------------------------------- the remembered camera
// The flat map unmounts when its box has no size (a hidden tab, a layout change) or the globe is
// shown; it comes back where it was, for the same game, instead of jumping to the capital.
// { key, lat, lng, scaleK }: the centre and the zoom as pixels per radian (projection scale x k),
// which does not depend on the screen size.
let remembered = null;

/** The game a remembered camera belongs to: the player's people and the world's seed. */
export const cameraKey = (state) => (state ? `${state.playerNationId || ''}|${state.scenario?.seed ?? ''}|${state.scenario?.mode ?? ''}` : '');

export const rememberCamera = (key, { lat, lng, scaleK }) => {
  const ll = cleanLatLng({ lat, lng });
  if (!ll || !key || !(Number.isFinite(scaleK) && scaleK > 0)) return;
  remembered = { key, ...ll, scaleK };
};

/** The camera remembered for game `key`, or null. */
export const recallCamera = (key) => (remembered && key && remembered.key === key ? { ...remembered } : null);

export const forgetCamera = () => { remembered = null; };
