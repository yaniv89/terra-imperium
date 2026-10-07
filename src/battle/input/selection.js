// src/battle/input/selection.js
// What a click or a tap on the battlefield means (pure, so it is tested without a renderer).
// TacticalBattleScreen.jsx picks what is under the pointer and asks `decidePointer` what to do.
//
// Desktop (mouse), the RTS convention:
//   left click   a unit or a building selects it (shift adds or removes a unit); empty ground,
//                an enemy or a resource deselects everything; with a targeted action armed
//                (attack-move, a building to place, a power, a rally point) it carries it out
//   right click  the order: move, attack the enemy under the cursor, workers gather a node or build
//                and repair your building, other units walk to your building; with only a building
//                selected it sets that building's rally point; it cancels a building being placed
//                or an armed power
// Phone (touch):
//   tap          a unit selects it; the same unit again lets it go; empty ground with a selection
//                is the order; your own building always selects that building, except when only
//                workers are selected and it is unfinished or damaged (then they build or repair)
// Units over a building: the first click or tap picks the units, a second one at the same spot
// picks the building (and a third the units again).

export const SAME_SPOT_PX = 16;
export const CYCLE_MS = 2500;
// The extra ground (tiles) around a building that still counts as a hit on it, at least this many
// screen pixels: buildings are big, easy targets even zoomed out on a phone.
export const BUILDING_PICK_TILES = 0.7;
export const BUILDING_PICK_PX = 18;

export const Q_UNITS = 256;

/** A building still needs workers: unfinished or damaged. */
export const needsWork = (b) => !!b && (!b.built || b.hp < b.maxHp);

/**
 * The player's own building under a ground point `g` (tiles), with a generous margin: the nearest
 * one whose footprint grown by `margin` holds the point. The keep counts as the town hall (its
 * proxy) when `keepHit` says the keep is under the point.
 */
export const pickOwnBuilding = (g, view, playerSide, { margin = BUILDING_PICK_TILES, keepHit = false } = {}) => {
  if (!g || !view?.eco) return null;
  let best = null; let bestD = Infinity;
  view.eco.buildings.forEach((b) => {
    if (!b.alive || b.proxy || b.side !== playerSide) return;
    const dx = Math.abs(b.x / Q_UNITS - g.x); const dz = Math.abs(b.y / Q_UNITS - g.z);
    const half = b.size / 2 + margin;
    if (dx > half || dz > half) return;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = b; }
  });
  if (best) return best;
  if (keepHit) return view.eco.buildings.find((b) => b.alive && b.proxy && b.side === playerSide) || null;
  return null;
};

/** A second click at the same spot on the unit just selected: cycle to the building under it. */
export const isCycleClick = (last, p, now, ownSquad, selectedIds) => !!last
  && ownSquad !== null
  && Math.hypot(p.x - last.x, p.y - last.y) <= SAME_SPOT_PX
  && now - last.t <= CYCLE_MS
  && last.squad === ownSquad
  && selectedIds.includes(ownSquad);

const TARGETED = new Set(['place', 'power', 'rally']);

/**
 * input: 'left' | 'right' (mouse) | 'tap' (touch)
 * ownSquad: the player's squad under the pointer (index) or null
 * building: the player's own building under the pointer (an eco view row) or null
 * selection: [{ idx, classId }] the selected squads; selectedBuilding: the selected building or null
 * armed: the armed action ('attackMove' or { type }), cycle: isCycleClick(...)
 * Returns { do: 'select', ids } | { do: 'selectBuilding', idx } | { do: 'deselect' } | { do: 'order' }
 *       | { do: 'armed' } | { do: 'rally' } | { do: 'cancelArmed' } | { do: 'none' }
 */
export const decidePointer = ({ input, shift = false, ownSquad = null, building = null, selection = [], selectedBuilding = null, armed = null, cycle = false }) => {
  const ids = selection.map((s) => s.idx);
  const onlyWorkers = selection.length > 0 && selection.every((s) => s.classId === 'worker');
  const armedType = armed && typeof armed === 'object' ? armed.type : armed;

  if (input === 'right') {
    if (armedType === 'place' || armedType === 'power') return { do: 'cancelArmed' };
    if (armedType === 'rally') return { do: 'armed' };
    if (selection.length) return { do: 'order' };
    if (selectedBuilding && selectedBuilding.trains) return { do: 'rally' };
    return { do: 'none' };
  }

  if (input === 'left') {
    if (armedType) return { do: 'armed' };
    if (ownSquad !== null) {
      if (cycle && building) return { do: 'selectBuilding', idx: building.idx };
      if (shift) return { do: 'select', ids: ids.includes(ownSquad) ? ids.filter((i) => i !== ownSquad) : [...ids, ownSquad] };
      return { do: 'select', ids: [ownSquad] };
    }
    if (building) return { do: 'selectBuilding', idx: building.idx };
    return shift ? { do: 'none' } : { do: 'deselect' };
  }

  // touch
  if (TARGETED.has(armedType)) return { do: 'armed' };
  if (ownSquad !== null && !armedType) {
    if (cycle && building) return { do: 'selectBuilding', idx: building.idx };
    if (ids.includes(ownSquad)) return { do: 'select', ids: ids.filter((i) => i !== ownSquad) };
    return { do: 'select', ids: [ownSquad] };
  }
  if (building) {
    if (onlyWorkers && needsWork(building)) return { do: 'order' };
    // The keep (the town hall's stand-in) with troops selected: man it or mend it.
    if (building.proxy && selection.length) return { do: 'order' };
    if (!armedType) return { do: 'selectBuilding', idx: building.idx };
  }
  if (selection.length) return { do: 'order' };
  return { do: 'deselect' };
};

/** The selection after an action: { ids, building }. Squads and a building are never selected
 *  together. `{ do: 'deselect' }` is also what the selection card's x and Esc do. */
export const selectionAfter = (cur, act) => {
  switch (act.do) {
    case 'select': return { ids: act.ids, building: act.ids.length ? null : cur.building };
    case 'selectBuilding': return { ids: [], building: act.idx };
    case 'deselect': return { ids: [], building: null };
    default: return cur;
  }
};
