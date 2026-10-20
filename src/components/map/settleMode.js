// src/components/map/settleMode.js
// Settling is a MODE of the map, not a lens that happens to be on (playtest audit I084, I086,
// I087, I088; addendum X20). It starts when the player turns to one of their settlers (a tap on
// it, the "Settlers wait" chip, "Show good sites", the research boost's Map button) and it:
//   - forces the settle view (green: a city may be founded, red hatched: blocked) round THAT
//     settler, whatever lens was on, and gives the lens back when it ends;
//   - centres the map on the settler;
//   - stays on while the player taps sites, blocked ones too, and when the site sheet is closed;
//   - offers "Next good site": the engine's own ranked list (settlers.js bestSites: legal,
//     explored, reachable on foot), one tap each, the map centred on it in the free part of the
//     screen;
//   - ends when a site is chosen (the settler has a destination or founded), the player cancels,
//     picks another lens or starts a march, or the settler is gone.
// This file is the pure part (tested without a DOM); MapContainer.jsx holds the state, SettleBar.jsx
// is the bar, gl/sceneModel.js draws the tints and the numbered site marks.
import { getTiles } from '../../data/geo/tiles';
import { bestSites, isSettler, settlersOf, siteOutlook, MAX_SETTLE_RINGS, SETTLER_MOVES } from '../../engine/settlers';
import { ringDistance } from '../../engine/world/cities';
import { citySpacingRings } from '../../data/geo/citySpacing';
import { ageOf } from '../../engine/nationState';
import { t as tNow } from '../../i18n';
import { nameNow } from '../../i18n/names';

/** How many ranked sites the mode lists and marks on the map. */
export const SETTLE_SITE_LIMIT = 8;
/** How many of the engine's ranked tiles the list is drawn from. */
export const SETTLE_SITE_POOL = 400;

const playerAge = (state) => ageOf(state, state.playerNationId);

/** The player's settler the mode is about, or null when it is gone or not a settler any more. */
export const settleUnit = (state, mode) => {
  const u = mode ? state.units?.[mode.unitId] : null;
  return u && isSettler(u) && u.ownerId === state.playerNationId && u.tile != null ? u : null;
};

/** The player's settler without a destination standing on `tile` (the first by id), or null. */
export const idleSettlerOn = (state, tile) => {
  if (tile == null) return null;
  return settlersOf(state.units || {}, state.playerNationId).filter((u) => u.tile === tile && u.target == null).sort((a, b) => (a.id < b.id ? -1 : 1))[0] || null;
};

/** The player's first settler that waits for a destination (not one told to wait), or null. */
export const firstIdleSettler = (state) => settlersOf(state.units || {}, state.playerNationId).filter((u) => u.target == null && u.tile != null && !u.hold).sort((a, b) => (a.id < b.id ? -1 : 1))[0] || null;

/** The mode for a settler: { unitId }. */
export const settleModeFor = (unit) => (unit ? { unitId: unit.id } : null);

/** Whether the mode is over by itself: its settler is gone, or has a destination. */
export const settleModeOver = (state, mode) => {
  if (!mode) return false;
  const u = settleUnit(state, mode);
  return !u || u.target != null;
};

/**
 * The ranked sites for the mode's settler, best first: [{ tile, score, quality, steps, turns,
 * name, warnings }]. Only land the player has explored and the settler can walk to (bestSites);
 * `warnings` from settlers.siteOutlook ('food', 'production') so a poor site is never called good:
 * the sites without a warning come first.
 */
export const settleSites = (state, mode, limit = SETTLE_SITE_LIMIT) => {
  const u = settleUnit(state, mode);
  if (!u) return [];
  const tiles = getTiles();
  const me = state.playerNationId;
  // The engine ranks tiles, and the best ones are often neighbours: one place, several tiles. The
  // list keeps the best tile of each place (a site closer to a kept one than two cities may stand
  // is the same place), so every "Next good site" is somewhere else to go.
  const apart = citySpacingRings(tiles);
  const kept = [];
  for (const s of bestSites(state, me, u.tile, playerAge(state), { rings: MAX_SETTLE_RINGS, limit: SETTLE_SITE_POOL })) {
    if (kept.some((q) => ringDistance(tiles, q.tile, s.tile, apart - 1) < apart)) continue;
    kept.push(s);
    if (kept.length >= limit * 2) break;
  }
  const list = kept
    .map((s) => ({ ...s, turns: Math.max(1, Math.ceil(s.steps / SETTLER_MOVES)), name: tiles.names[s.tile] || null, warnings: siteOutlook(state, s.tile, me)?.warnings || [] }));
  // stable: the engine's order within the sound sites, then within the poor ones
  return [...list.filter((s) => !s.warnings.length), ...list.filter((s) => s.warnings.length)].slice(0, limit);
};

/** The site after `currentTile` in `sites` (the first when it is not one of them); null for none. */
export const nextSite = (sites, currentTile = null) => {
  if (!sites?.length) return null;
  const i = sites.findIndex((s) => s.tile === currentTile);
  return sites[(i + 1) % sites.length];
};

/** The bar's words: { title, hint, count, index } for the mode, the selected tile and the sites. */
export const settleBarModel = (state, mode, sites, selectedTile = null) => {
  const u = settleUnit(state, mode);
  if (!u) return null;
  const from = state.regions?.[u.homeRegionId || u.regionId]?.name || null;
  const index = sites.findIndex((s) => s.tile === selectedTile);
  return {
    title: from ? tNow('settle.titleOf', { city: nameNow('city', null, from) }) : tNow('settle.title'),
    hint: sites.length ? tNow('settle.hint') : tNow('settle.hintNone'),
    count: sites.length,
    index,
    nextLabel: !sites.length ? null : index < 0 ? tNow('settle.best') : tNow('settle.next', { i: ((index + 1) % sites.length) + 1, n: sites.length })
  };
};
