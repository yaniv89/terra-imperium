// src/components/map/marchGlide.js
// Armies glide over the tiles they walked instead of jumping to where they stand (playtest audit
// I070, art plan AN01). Drawing only: the engine's positions stay the truth, the glide starts from
// the tile a stack stood on in the last state the map drew and ends where it stands now, along the
// steps of the route it had (else the fewest steps over its own ground, land for an army and water
// for a fleet, never a straight line across a bay), and never changes a rule or a cost.
// The fog: a foreign stack glides only when it was on the map before and is on it now (a stack
// that walks out of the dark simply appears, as before).
import { getTiles } from '../../data/geo/tiles';
import { ringsForKm } from '../../data/geo/gridScale';
import { unitTile } from '../../engine/armies';

/** ms a tile step takes, and the bounds of one glide. */
export const GLIDE_STEP_MS = 260;
export const GLIDE_MIN_MS = 450;
export const GLIDE_MAX_MS = 1500;
/** A jump without a route (a landing, a loaded game) glides only over its own ground within this
 * reach (a cavalry move and a tech bonus); farther it is not glided. */
export const GLIDE_SEARCH_KM = 800;

const latLngOf = (tile) => { const { lat, lon } = getTiles().latLonOf(tile); return { lat, lng: lon }; };

/** The tiles a unit walked from `from` to `to`: the steps of its old route, else the fewest steps
 * over its own ground (`land`: an army; else a fleet on water, its ends may be ports) within
 * GLIDE_SEARCH_KM. A move ordered now has no old route (it was set and walked at once): a straight
 * line there cut across bays, and a scout walked on the sea (playtest 22 Oct). */
export const walkedTiles = (route, from, to, land = true) => {
  if (from == null || to == null || from === to) return null;
  const steps = [from, ...(route || [])];
  const i = steps.indexOf(to);
  if (i > 0) return steps.slice(0, i + 1);
  const t = getTiles();
  const prev = new Map([[from, -1]]);
  let level = [from];
  for (let d = ringsForKm(GLIDE_SEARCH_KM); d > 0 && level.length && !prev.has(to); d--) {
    const next = [];
    level.forEach((x) => t.neighbors[x].forEach((n) => {
      if (prev.has(n) || (n !== to && (t.land[n] === 1) !== land)) return;
      prev.set(n, x); next.push(n);
    }));
    level = next;
  }
  if (!prev.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0]));
  return path;
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
    const tiles = walkedTiles(before.route, from, m.tile, kind === 'army');
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

/** ms to wait after a new turn lands before deciding that no turn report is coming (the report
 *  opens in an effect one render after the state; this covers that). */
export const REPORT_SETTLE_MS = 90;

/**
 * Play `run` once the turn report is out of the way: at once (after REPORT_SETTLE_MS, long enough
 * for the report to open if it is going to) when no report is open, else when it closes. `env`
 * is { isShown(), listen(fn(shown)) -> stop, later(fn, ms) -> cancel }. Returns a cancel.
 */
export const afterTurnReport = (env, run) => {
  let done = false;
  let stopListen = null;
  let cancelTimer = null;
  const finish = (play) => {
    if (done) return;
    done = true;
    stopListen?.(); cancelTimer?.();
    if (play) run();
  };
  stopListen = env.listen((shown) => { if (!shown) finish(true); });
  cancelTimer = env.later(() => { if (!env.isShown()) finish(true); }, REPORT_SETTLE_MS);
  return () => finish(false);
};
