// src/battle/input/orderFeedback.js
// What a tap that gives an order hits, and what the player is told about it (playtest audit CB17:
// I189, I190, I192 with addendum X13). Pure, so it is tested without a renderer.
//
// I189 / I190: an order tap is about the enemy or the ground under the finger, never about the
// player's own squads standing there (they cannot be the target of an order), and a city's long
// walls and its houses count only where they actually stand: a wall segment's hit circle used to
// cover the open ground beside it, so "move back over there" near a wall became "attack the wall".
// I192 (closed against the user's ruling Q6): every squad walks at its own speed, so an attack or
// a march with fast and slow squads together says that the fast ones will get there first.

export const Q_UNITS = 256;
// Extra ground around a building's own tiles that still counts as a tap on it (tiles), at least
// FOOTPRINT_PICK_PX on screen.
export const FOOTPRINT_PICK_TILES = 0.35;
export const FOOTPRINT_PICK_PX = 10;
// Buildings without tiles of their own (a keep or a tower of a field fort): a circle.
export const RADIUS_PICK_TILES = 0.6;

/**
 * The battlefield structure under ground point `g` (tiles), or null. `structures` are the view's
 * (alive), `setupStructures` the setup's (footprint, underHall), `mapW` the map's width in tiles.
 * `margin` (tiles) widens a footprint's tiles.
 */
export const pickStructureAt = (g, structures, setupStructures, mapW, margin = FOOTPRINT_PICK_TILES) => {
  if (!g) return null;
  let best = null; let bestD = Infinity;
  (structures || []).forEach((s, index) => {
    const fixed = setupStructures?.[index];
    if (!s?.alive || fixed?.underHall) return; // a house under the town hall is the hall's
    const fp = fixed?.footprint;
    let d;
    if (fp?.length) {
      // The distance from the tap to the nearest of its tiles (0 inside one).
      d = Infinity;
      for (let k = 0; k < fp.length; k++) {
        const tx = fp[k] % mapW; const ty = (fp[k] - tx) / mapW;
        const dx = Math.max(tx - g.x, 0, g.x - (tx + 1)); const dz = Math.max(ty - g.z, 0, g.z - (ty + 1));
        d = Math.min(d, dx * dx + dz * dz);
      }
      if (d > margin * margin) return;
    } else {
      const r = s.radius / Q_UNITS + RADIUS_PICK_TILES;
      d = (s.x / Q_UNITS - g.x) ** 2 + (s.y / Q_UNITS - g.z) ** 2;
      if (d > r * r) return;
    }
    if (d < bestD) { bestD = d; best = { kind: 'structure', index }; }
  });
  return best;
};

/** Squad classes that outpace a marching column (their own speed, Q6). */
const FAST = new Set(['cavalry', 'air']);
const SLOW_NAMES = { infantry: 'infantry', ranged: 'archers', siege: 'siege engines', support: 'wagons' };

/**
 * The note an order to a mixed group earns (X13), or null: `classes` are the selected squads'
 * class ids. Only for an attack or a march, where the fast ones arriving alone matters.
 */
export const arrivalNote = (classes, orderType) => {
  if (!['attack', 'attackMove', 'move'].includes(orderType)) return null;
  const set = new Set(classes);
  const fast = [...set].filter((c) => FAST.has(c));
  const slow = [...set].filter((c) => SLOW_NAMES[c]);
  if (!fast.length || !slow.length) return null;
  const who = fast.includes('cavalry') ? 'Cavalry' : 'Aircraft';
  return orderType === 'move'
    ? `${who} will arrive first: each unit marches at its own speed.`
    : `${who} will arrive first and fight alone until the ${SLOW_NAMES[slow.includes('infantry') ? 'infantry' : slow[0]]} catch up.`;
};

/** Why an order tap gave no order (the tap did not reach the battlefield). */
export const NO_GROUND_TEXT = 'No order: tap the battlefield itself.';
