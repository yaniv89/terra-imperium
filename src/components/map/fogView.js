// src/components/map/fogView.js
// The world as the player knows it (plans/MASTER-PLAN.md 5.2, rendering by fog state), for the
// map renderers: a state-shaped VIEW whose `world.tileOwner`, `world.tileState` and `regions` hold
//   - visible tiles: everything as it is now;
//   - explored but not visible: the last-seen picture (engine/fog.js `fog.seen`): the city that
//     held the tile then, the improvement and road seen there, the city as it was (a "ghost"
//     record: `ghost: true`, drawn greyed and static);
//   - unexplored: nothing.
// Plus the shapes the map paints over it: one dark mask over everything not explored and one grey
// wash over what is explored but not in sight. Everything is cached by the identity of what it
// comes from, and a view whose content did not change keeps the previous object, so moving an
// army that reveals nothing new rebuilds no territory paths.
import { getTiles } from '../../data/geo/tiles';
import { buildTerritories } from '../../data/geo/tileGeometry';
import { visibleTiles } from '../../engine/sight';
import { fogOn, bitsHas } from '../../engine/fog';

const viewCache = new WeakMap(); // state -> view
let last = null; // the previous view, to keep identities when nothing changed

const sameKeys = (a, b) => {
  if (a === b) return true;
  const ka = Object.keys(a); if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
};

/**
 * { state, on, explored, visible, isExplored(t), isVisible(t) } for `state`'s player. With fog
 * off the view is the state itself and every tile counts as explored and visible.
 */
export const fogView = (state) => {
  if (!fogOn(state) || !state.nations?.[state.playerNationId]) {
    return { state, on: false, explored: null, visible: null, isExplored: () => true, isVisible: () => true };
  }
  const hit = viewCache.get(state);
  if (hit) return hit;
  const p = state.playerNationId;
  const explored = state.fog.explored[p] || null;
  const visible = visibleTiles(state, p);
  const seen = state.fog.seen;
  const tileOwnerNow = state.world?.tileOwner || {};
  const tileStateNow = state.world?.tileState || {};
  const isExplored = (t) => bitsHas(explored, t);
  const isVisible = (t) => visible.has(t);

  // Ownership: visible tiles as now, explored ones as last seen.
  const tileOwner = {};
  Object.keys(tileOwnerNow).forEach((k) => { if (visible.has(+k)) tileOwner[k] = tileOwnerNow[k]; });
  const cityInts = seen?.city?.ints;
  if (explored && cityInts) {
    const bytes = explored.bytes;
    for (let b = 0; b < bytes.length; b++) {
      const v = bytes[b];
      if (!v) continue;
      for (let k = 0; k < 8; k++) {
        if (!((v >> k) & 1)) continue;
        const t = b * 8 + k;
        if (visible.has(t)) continue;
        const idx = cityInts[t];
        if (idx > 0) tileOwner[t] = seen.cityIds[idx - 1];
      }
    }
  }
  // Improvements and roads: visible as now, explored as last seen; battle marks only in sight.
  const tileState = {};
  Object.keys(tileStateNow).forEach((k) => { const t = +k; if (visible.has(t)) tileState[k] = tileStateNow[k]; else if (tileStateNow[k]?.wonder && isExplored(t)) tileState[k] = { wonder: tileStateNow[k].wonder }; });
  Object.keys(seen?.improvements || {}).forEach((k) => {
    const t = +k;
    if (visible.has(t) || !isExplored(t)) return;
    const s = seen.improvements[k];
    tileState[k] = { ...(tileState[k] || {}), ...(s.i ? { improvement: s.i } : {}), ...(s.r ? { road: true } : {}) };
  });
  // Cities: one in sight (its centre or any of its land) as it is; one remembered as it was.
  const regions = {};
  const live = state.regions;
  const inSight = new Set();
  Object.keys(tileOwner).forEach((k) => { if (visible.has(+k)) inSight.add(tileOwner[k]); });
  Object.values(live).forEach((c) => { if (c.tile != null && (visible.has(c.tile) || inSight.has(c.id))) regions[c.id] = c; });
  Object.values(seen?.cities || {}).forEach((snap) => {
    if (regions[snap.id] || !isExplored(snap.tile)) return;
    regions[snap.id] = { ...snap, ghost: true, tiles: [], control: 100, unrest: 0 };
  });
  // Territories of remembered cities without a remembered record (never named) are dropped.
  Object.keys(tileOwner).forEach((k) => { if (!regions[tileOwner[k]]) delete tileOwner[k]; });

  const prev = last && last.source.playerNationId === p ? last : null;
  const keepOwner = prev && sameKeys(prev.state.world.tileOwner, tileOwner) ? prev.state.world.tileOwner : tileOwner;
  const keepState = prev && sameKeys(prev.state.world.tileState, tileState) ? prev.state.world.tileState : tileState;
  const keepRegions = prev && sameKeys(prev.state.regions, regions) ? prev.state.regions : regions;
  const world = prev && keepOwner === prev.state.world.tileOwner && keepState === prev.state.world.tileState && prev.source.world === state.world ? prev.state.world : { ...(state.world || {}), tileOwner: keepOwner, tileState: keepState };
  const view = { state: { ...state, world, regions: keepRegions }, on: true, explored, visible, isExplored, isVisible };
  viewCache.set(state, view);
  last = { ...view, source: state };
  return view;
};

// ---------------------------------------------------------------- the fog shapes

const shapeCache = new WeakMap(); // explored TileBits or visible Set -> features
const cached = (key, build) => { let v = shapeCache.get(key); if (!v) { v = build(); shapeCache.set(key, v); } return v; };

/** The explored land and sea as GeoJSON features (the holes the dark mask leaves open). */
export const exploredFeatures = (explored) => (explored ? cached(explored, () => buildTerritories(getTiles(), (i) => (bitsHas(explored, i) ? 'x' : null))) : []);

/** The tiles in sight now as features (the holes the grey wash leaves open). */
export const visibleFeatures = (visible) => (visible ? cached(visible, () => buildTerritories(getTiles(), (i) => (visible.has(i) ? 'v' : null))) : []);
