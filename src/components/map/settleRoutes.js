// src/components/map/settleRoutes.js
// The road of settlers that are on their way (playtest audit I095: "its route is not drawn").
// One line per player settler with a destination, in the shape the map's march lines take
// (utils/marchLines.js: the tiles in order and where each turn's walk ends), kind 'settlers':
// the road the unit keeps (`unit.path`, planned at End Turn) when it still leads to the target,
// else the one the engine would plan now (settlers.settlerPath). A settler that cannot get there
// has no line (the turn's log says so). Pure.
import { settlersOf, settlerPath, SETTLER_MOVES } from '../../engine/settlers';
import { turnMarks } from '../../utils/marchLines';
import { getTiles } from '../../data/geo/tiles';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';

/** The tiles a settler still has to walk (its own tile excluded), or null. */
export const settlerRoad = (state, unit) => {
  if (unit.target == null || unit.tile == null || unit.target === unit.tile) return null;
  const kept = unit.path;
  if (kept?.length && kept[kept.length - 1] === unit.target) return kept;
  return settlerPath(state, unit.tile, unit.target, unit.ownerId);
};

/** Turns until a settler stands on its target (SETTLER_MOVES tiles a turn), or null. */
export const settlerEta = (state, unit) => {
  const road = settlerRoad(state, unit);
  return road ? Math.max(1, Math.ceil(road.length / SETTLER_MOVES)) : null;
};

/**
 * What a settler is doing, for the lists that used to show it like a soldier (rank, strength,
 * morale, supply: playtest audit I057): { state: 'travelling' | 'waiting' | 'idle', text, turns }.
 */
export const settlerStatus = (state, unit) => {
  if (unit.target != null && unit.target !== unit.tile) {
    const turns = settlerEta(state, unit);
    const named = getTiles().names[unit.target];
    const to = named ? nameNow('place', null, named) : t('mx.set.chosenSite');
    return { state: 'travelling', turns, text: turns == null ? t('mx.set.noWay', { to }) : t('mx.set.heading', { to, turns: t('march.turns', { count: turns }) }) };
  }
  if (unit.target != null) return { state: 'travelling', turns: 0, text: t('mx.set.onSite') };
  if (unit.hold) return { state: 'waiting', turns: null, text: t('mx.set.holding') };
  return { state: 'idle', turns: null, text: t('mx.set.idle') };
};

/** [{ key, kind: 'settlers', points, marks, unitId }] for the player's settlers under way. */
export const settlerLines = (state) => settlersOf(state.units || {}, state.playerNationId)
  .sort((a, b) => (a.id < b.id ? -1 : 1))
  .map((u) => {
    const road = settlerRoad(state, u);
    if (!road?.length) return null;
    const stepTurns = road.map((_, i) => Math.floor(i / SETTLER_MOVES) + 1);
    return { key: `settlers:${u.id}`, kind: 'settlers', unitId: u.id, points: [u.tile, ...road], marks: turnMarks(stepTurns) };
  })
  .filter(Boolean);
