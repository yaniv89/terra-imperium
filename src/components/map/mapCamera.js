// src/components/map/mapCamera.js
// Where the map camera may go (plans/ui/map-camera/): the lat/lng of a place (a tile, a city), the
// first real place of a list with the player's own fallbacks (the selected army, then the capital),
// the place of a battle the player just fought, and the camera remembered while the flat map is
// unmounted. Never a default spot: a target that cannot be found is null and the camera stays put.
// No React, no three.js: MapContainer.jsx and gl/GLMapView.jsx read it, tests cover it.
import { getTiles } from '../../data/geo/tiles';
import { REGION_COORDINATES } from '../../data/regionCoordinates';
import { isExplored } from '../../engine/fog';
import { unitTile } from '../../engine/armies';
import { isSettler } from '../../engine/settlers';
import { idleArmyTiles } from '../../engine/standingOrders';

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

/** False for a place whose tile the player has not explored (a place with no tile is not judged). */
const placeKnown = (state, place) => {
  const tile = place?.tile ?? state?.regions?.[place?.regionId]?.tile;
  return tile == null || !state || isExplored(state, tile);
};

/**
 * The lat/lng of city `id` only when the player has explored its tile, else null. An action's
 * effect (a pact, a gift: NationCard triggers it toward the other people's capital) pans the map
 * through this: a capital the player has never seen is fog, and the camera used to land there and
 * leave the whole screen dark (playtest issue 8).
 */
export const knownLatLngOfCity = (state, id, opts = {}) => (placeKnown(state, { regionId: id }) ? latLngOfCity(state, id, opts) : null);

/**
 * Where the camera goes for a list of places, first found wins, then the player's selected army's
 * tile (`selectedArmyTile`), then the player's capital. { lat, lng, from } or null (stay put).
 * `from` says which one: 'place' (with `index`, and the place's `tile` for the map to outline), 'army' or 'capital'.
 * A place on a tile the player has not explored is skipped (the camera would land in black fog,
 * mobile audit H-19); with fog off every tile counts as explored.
 */
export const cameraTarget = (state, places = [], { selectedArmyTile = null, ...opts } = {}) => {
  const list = Array.isArray(places) ? places : [places];
  for (let i = 0; i < list.length; i++) {
    const ll = latLngOfPlace(state, list[i], opts);
    if (ll && placeKnown(state, list[i])) return { ...ll, from: 'place', index: i, tile: list[i].tile ?? state?.regions?.[list[i].regionId]?.tile ?? null };
  }
  const army = selectedArmyTile != null ? latLngOfTile(selectedArmyTile, opts.tiles) : null;
  if (army) return { ...army, from: 'army' };
  const capId = state?.nations?.[state?.playerNationId]?.capitalRegionId;
  const cap = latLngOfCity(state, capId, opts);
  if (cap) return { ...cap, from: 'capital' };
  // A Stone Age band before its first village (settlers.js makeBand): its home.
  const band = Object.values(state?.units || {}).find((u) => u.band && u.ownerId === state.playerNationId);
  const home = band ? latLngOfTile(band.tile, opts.tiles) : null;
  return home ? { ...home, from: 'army' } : null;
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

// ---------------------------------------------------------------- camera intents, applied once
// A fly-to is an INTENT (the minimap, a chip, "Show on map"): it is applied once. The map's
// callbacks are rebuilt whenever a sheet changes the free part of the screen or the screen is
// resized, and an effect that depended on them used to fly to the last target again (playtest
// audit I072: the camera jumped to an old place when a sheet opened or closed). The gate below
// remembers what was applied; `fresh` says whether the sheet that came with the intent may still
// re-centre it into the room that is left (INTENT_SETTLE_MS, a sheet's opening animation).
export const INTENT_SETTLE_MS = 700;

/** A gate for intents: `take(target)` is true once per target (by identity; null is never one),
 * `fresh(now)` while the last taken intent is younger than `settleMs`, `clear()` forgets it. */
export const createIntentGate = (settleMs = INTENT_SETTLE_MS) => {
  let last = null; let at = -Infinity;
  return {
    take: (target, now = 0) => { if (target == null || target === last) return false; last = target; at = now; return true; },
    fresh: (now = 0) => last != null && now - at <= settleMs,
    last: () => last,
    clear: () => { last = null; at = -Infinity; }
  };
};

/**
 * The player's army stacks the "next army" button cycles (Civ VI's unit cycling, map-8): the ones
 * waiting for orders first (standingOrders idleArmyTiles), then the ones marching, one tile per
 * stack in unit id order. After End Turn this is where the moving armies went (playtest run
 * 40651416284 steps 70-72: the player panned to find a marching army).
 */
export const armyCycle = (state, nationId = state.playerNationId) => {
  const idle = idleArmyTiles(state, nationId);
  const out = [...idle];
  const seen = new Set(idle);
  Object.values(state.units || {})
    .filter((u) => u.ownerId === nationId && u.strength > 0 && u.domain !== 'naval' && !isSettler(u) && u.route?.length) // (one crossing water on its own boats too)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .forEach((u) => { const t = unitTile(state, u); if (t != null && !seen.has(t)) { seen.add(t); out.push(t); } });
  return out;
};

/** The tile after `lastTile` in `tiles`, wrapping; the first when `lastTile` is gone. */
export const nextTileAfter = (tiles, lastTile) => (tiles.length ? tiles[(tiles.indexOf(lastTile) + 1) % tiles.length] : null);
