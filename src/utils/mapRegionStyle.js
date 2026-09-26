// src/utils/mapRegionStyle.js
// Shared region fill/stroke logic for every map renderer (the 3D globe and the flat 2D map both
// need to look identical — same control-band colors, same war outline, same selection highlight —
// so this is the one place that logic lives, extracted out of GlobeView.jsx rather than duplicated
// into Map2DView.jsx.
import { getNationColor, UNKNOWN_NATION_COLOR } from '../data/nationColors';

// Every nation on Earth gets its own distinct, stable color (src/data/nationColors.js) — the color
// boundary between two provinces IS the national border. Your own territory is the one exception:
// it uses this 5-band control scale instead of your nation's own assigned color, since how firmly
// you hold your own land is the one thing worth a glance-able color here.
export const fillColorForRegion = (regionState, isPlayerOwned) => {
  if (isPlayerOwned) {
    const control = Math.min(100, Math.max(0, regionState.control || 0));
    if (control >= 80) return '#4ade80';
    if (control >= 60) return '#84cc16';
    if (control >= 40) return '#facc15';
    if (control >= 20) return '#fb923c';
    return '#f87171';
  }
  return getNationColor(regionState.owner);
};

// Every nation currently at war with the player, precomputed once per wars/playerNationId change
// rather than re-scanned per region — with thousands of regions, an O(#wars) scan per region would
// otherwise be repeated needlessly. Takes `wars`/`playerNationId` directly (not the whole `state`)
// so a caller's useMemo/useCallback dependency array can list exactly those two fields — passing
// the whole state object here would make React re-derive this (and everything that depends on it)
// on every dispatched action, not just ones that actually touch wars, defeating the memoization
// this exists for in the first place (see GlobeView.jsx's own comment on this).
export const getAtWarNationIds = (wars, playerNationId) => {
  const ids = new Set();
  (wars || []).forEach((war) => {
    if (!war.active) return;
    if (war.aggressor === playerNationId) ids.add(war.enemy);
    else if (war.enemy === playerNationId) ids.add(war.aggressor);
  });
  return ids;
};

export const getRegionFillColor = (regions, playerNationId, gameRegionId) => {
  const regionState = regions[gameRegionId];
  if (!regionState) return UNKNOWN_NATION_COLOR;
  const isPlayerOwned = regionState.owner === playerNationId;
  return fillColorForRegion(regionState, isPlayerOwned);
};

// A region owned by a nation you're at war with gets a red outline instead of black — the war
// signal lives on the stroke, not the fill, so a hostile nation's own color identity stays visible
// the whole time you're fighting it. Selecting a region always wins (a bright blue highlight),
// matching GlobeView's own priority order.
export const getRegionStrokeColor = (regions, playerNationId, gameRegionId, selectedRegionId, atWarNationIds) => {
  if (gameRegionId === selectedRegionId) return '#2563eb';
  const regionState = regions[gameRegionId];
  if (regionState?.underInvasion) return '#ef4444';
  if (regionState && regionState.owner !== playerNationId && atWarNationIds.has(regionState.owner)) return '#ef4444';
  return '#000000';
};
