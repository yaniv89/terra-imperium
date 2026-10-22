// src/components/map/tileStack.js
// Civilization's rule for several units on one tile: ONE unit model is drawn per tile. A military
// unit is drawn over a civilian (a settler, a worker); among soldiers the selected one, else the
// strongest. The tile's flag shows how many units are there, and tapping it selects the top unit,
// then cycles to the next. Pure.

export const CIVILIAN_CLASSES = new Set(['settler', 'worker']);
export const isCivilian = (u) => !!u && CIVILIAN_CLASSES.has(u.classId);

/** The units of a tile in drawing order: soldiers by strength (strongest first, then id), then civilians. */
export const orderedStack = (units) => units.slice().sort((a, b) => (isCivilian(a) - isCivilian(b)) || ((b.strength || 0) - (a.strength || 0)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** The unit whose model the tile shows: the selected one when it is on the tile, else the first of the order. */
export const topUnit = (ordered, selectedId = null) => ordered.find((u) => u.id === selectedId) || ordered[0] || null;

/** The next (dir 1) or previous (dir -1) unit of a tile's order after `currentId`; the first when it is not there. */
export const cycleUnit = (ordered, currentId, dir = 1) => {
  if (!ordered.length) return null;
  const i = ordered.findIndex((u) => u.id === currentId);
  if (i < 0) return ordered[0];
  return ordered[(i + (dir < 0 ? -1 : 1) + ordered.length) % ordered.length];
};

/** The tile's units of one owner and domain, drawn from the game state: those on `tile`, not embarked, alive. */
export const unitsOnTile = (state, tile, ownerId, tileOf, domain = 'land') => Object.values(state.units || {})
  .filter((u) => u && u.ownerId === ownerId && (!u.embarkedOn || u.embarkedOn === u.id) && (u.strength > 0 || u.classId === 'settler') && (u.domain === 'naval' ? 'naval' : 'land') === domain && tileOf(u) === tile);

/**
 * The unit a tap on a tile's flag selects: the top unit the first time, then the next one of the
 * order on each further tap of the same tile (`tileSelected`: that tile's sheet is already open).
 */
export const unitAfterTap = (ordered, tileSelected, currentId = null) => {
  if (!ordered.length) return null;
  return (tileSelected ? cycleUnit(ordered, currentId, 1) : topUnit(ordered, currentId))?.id ?? null;
};
