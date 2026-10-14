// src/components/map/marchGlide.js
// Armies glide over the tiles they walked instead of jumping to where they stand (playtest audit
// I070, art plan AN01). Drawing only: the engine's positions stay the truth, the glide starts from
// the tile a stack stood on in the last state the map drew and ends where it stands now, along the
// steps of the route it had (else straight, for a short hop), and never changes a rule or a cost.
// The fog: a foreign stack glides only when it was on the map before and is on it now (a stack
// that walks out of the dark simply appears, as before).
import { getTiles } from '../../data/geo/tiles';
import { distanceKm } from '../../data/geo/geodesic';
import { unitTile } from '../../engine/armies';

/** ms a tile step takes, and the bounds of one glide. */
export const GLIDE_STEP_MS = 260;
export const GLIDE_MIN_MS = 450;
export const GLIDE_MAX_MS = 1500;
/** A jump longer than this without a route (a landing, a loaded game) is not glided. */
export const GLIDE_STRAIGHT_KM = 400;

const latLngOf = (tile) => { const { lat, lon } = getTiles().latLonOf(tile); return { lat, lng: lon }; };

/** The tiles a unit walked from `from` to `to`: the steps of its old route, else a short hop. */
export const walkedTiles = (route, from, to) => {
  if (from == null || to == null || from === to) return null;
  const steps = [from, ...(route || [])];
  const i = steps.indexOf(to);
  if (i > 0) return steps.slice(0, i + 1);
  const t = getTiles();
  if (!t.centres?.[from] || !t.centres?.[to]) return null;
  return distanceKm(t.centres[from], t.centres[to]) <= GLIDE_STRAIGHT_KM ? [from, to] : null;
};

/** Which marker keys (markerItems' `army:id`, `fleet:id`) glide, and along which points. */
export const planGlides = ({ prevState, nextState, prevMarkers, nextMarkers }) => {
  const out = new Map();
  if (!prevState || !nextState || !prevMarkers || !nextMarkers || prevState === nextState) return out;
  // another game, a load or a step back: nothing glides
  if (prevState.playerNationId !== nextState.playerNationId) return out;
  const dt = (nextState.turnNumber || 0) - (prevState.turnNumber || 0);
  if (dt < 0 || dt > 1) return out;
  const seen = new Set();
  [...(prevMarkers.armies || []), ...(prevMarkers.fleets || [])].forEach((m) => seen.add(`${m.ownerId}|${m.tile}`));
  const add = (list, kind) => (list || []).forEach((m) => {
    const lead = m.lead != null ? nextState.units?.[m.lead] : null;
    const before = m.lead != null ? prevState.units?.[m.lead] : null;
    if (!lead || !before) return;
    const from = unitTile(prevState, before);
    if (from == null || from === m.tile || !seen.has(`${m.ownerId}|${from}`)) return;
    const tiles = walkedTiles(before.route, from, m.tile);
    if (!tiles) return;
    const dur = Math.max(GLIDE_MIN_MS, Math.min(GLIDE_MAX_MS, (tiles.length - 1) * GLIDE_STEP_MS));
    out.set(`${kind}:${m.id}`, { points: tiles.map(latLngOf), dur });
  });
  add(nextMarkers.armies, 'army');
  add(nextMarkers.fleets, 'fleet');
  return out;
};

const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2);
const wrapLng = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;

/**
 * Where a glide is `ms` after it began: { lat, lng, toward, done }, `toward` the point it walks to
 * (the heading). Longitudes are taken the short way round (the world wraps).
 */
export const glideAt = (glide, ms) => {
  const pts = glide.points;
  const u = Math.max(0, Math.min(1, ms / glide.dur));
  const last = pts[pts.length - 1];
  if (u >= 1 || pts.length < 2) return { lat: last.lat, lng: last.lng, toward: null, done: true };
  const f = ease(u) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const a = pts[i]; const b = pts[i + 1];
  let dl = b.lng - a.lng;
  if (dl > 180) dl -= 360; else if (dl < -180) dl += 360;
  const w = f - i;
  return { lat: a.lat + (b.lat - a.lat) * w, lng: wrapLng(a.lng + dl * w), toward: b, done: false };
};
