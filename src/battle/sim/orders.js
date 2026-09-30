// src/battle/sim/orders.js
// Orders are the ONLY way anything outside the sim influences it (Tactical Battles plan §12): the
// player's taps and the tactical AI both produce these plain objects, applied on tick boundaries
// in a fixed order, so a battle replays exactly from (setup, order log).
//
// Order shapes (x/y in Q8 units):
//   { side, type: 'move' | 'attackMove', squads: [idx], x, y, formation?: 'line' | 'column' }
//   { side, type: 'formationLine', squads: [idx], x, y, x2, y2 }   // drag a line, squads spread on it
//   { side, type: 'attack', squads: [idx], target: { kind: 'squad' | 'structure', index } }
//   { side, type: 'stop' | 'hold' | 'retreat', squads: [idx] }
//   { side, type: 'callReserve', squads: [idx] }
//   { side, type: 'retreatAll' }
import { angleBetween, polarX, polarY } from './fixed';
import { fieldCap, fieldCount } from './world';
import { Q, SIDE_ATTACKER, secondsToTicks } from './constants';

export const RESERVE_COST = 60;
export const RESERVE_ENTRY_TICKS = secondsToTicks(8);
const SLOT_SPACING = Math.round(2.5 * Q);

const commandable = (w, side, idx) => {
  const q = w.squads[idx];
  return q && q.side === side && q.alive && q.onField && !q.fled && !q.routed;
};

// Stable sort key for a deterministic order stream.
export const orderSortKey = (o) => [o.tick ?? 0, o.side ?? 0, o.seq ?? 0];
export const sortOrders = (orders) => [...orders].sort((a, b) => {
  const ka = orderSortKey(a); const kb = orderSortKey(b);
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
});

const isBack = (q) => !q.stats.melee && !q.stats.flying;

// Destination slots for a group: front row of melee/air, a row of shooters behind it, laid out
// perpendicular to the direction of travel (or along it, for 'column').
const formationSlots = (squads, x, y, formation) => {
  const cx = Math.trunc(squads.reduce((s, q) => s + q.x, 0) / squads.length);
  const cy = Math.trunc(squads.reduce((s, q) => s + q.y, 0) / squads.length);
  const heading = cx === x && cy === y ? 0 : angleBetween(cx, cy, x, y);
  const lateral = (heading + 64) & 255;
  const rows = formation === 'column'
    ? [squads]
    : [squads.filter((q) => !isBack(q)), squads.filter((q) => isBack(q))];
  const slots = new Map();
  rows.forEach((row, r) => {
    // Keep squads on the side of the line they are already on — no criss-crossing.
    const sorted = [...row].sort((a, b) => (polarX(lateral, 1000) * (a.x - b.x) + polarY(lateral, 1000) * (a.y - b.y)) || a.idx - b.idx);
    sorted.forEach((q, i) => {
      const along = formation === 'column' ? -i * SLOT_SPACING : -r * SLOT_SPACING;
      const across = formation === 'column' ? 0 : Math.round((i - (sorted.length - 1) / 2) * SLOT_SPACING);
      slots.set(q.idx, { x: x + polarX(heading, along) + polarX(lateral, across), y: y + polarY(heading, along) + polarY(lateral, across), facing: heading });
    });
  });
  return slots;
};

const lineSlots = (squads, x, y, x2, y2, side) => {
  const n = squads.length;
  const lineAngle = angleBetween(x, y, x2, y2);
  // Face away from our own edge: the attacker's forward is +x, the defender's is -x.
  const forwardA = (lineAngle + 64) & 255; const forwardB = (lineAngle + 192) & 255;
  const facing = (side === SIDE_ATTACKER ? polarX(forwardA, 100) >= 0 : polarX(forwardA, 100) <= 0) ? forwardA : forwardB;
  const sorted = [...squads].sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.idx - b.idx);
  const slots = new Map();
  sorted.forEach((q, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    slots.set(q.idx, { x: Math.round(x + (x2 - x) * t), y: Math.round(y + (y2 - y) * t), facing });
  });
  return slots;
};

const setMoveOrder = (q, type, slot, groupSpeed) => {
  q.order = { type, x: slot.x, y: slot.y, facing: slot.facing };
  q.groupSpeed = groupSpeed;
  q.retreating = false;
  if (type === 'move') { q.target = -1; q.targetKind = null; }
};

export const applyOrder = (w, o) => {
  const side = o.side;
  const ids = (o.squads || []).filter((i) => commandable(w, side, i));
  switch (o.type) {
    case 'move':
    case 'attackMove': {
      const squads = ids.map((i) => w.squads[i]);
      if (!squads.length) return;
      const slots = squads.length === 1 ? new Map([[squads[0].idx, { x: o.x, y: o.y, facing: squads[0].facing }]]) : formationSlots(squads, o.x, o.y, o.formation);
      const groupSpeed = squads.length > 1 ? Math.min(...squads.map((q) => q.stats.speed)) : 0;
      squads.forEach((q) => setMoveOrder(q, o.type, slots.get(q.idx), groupSpeed));
      return;
    }
    case 'formationLine': {
      const squads = ids.map((i) => w.squads[i]);
      if (!squads.length) return;
      const slots = lineSlots(squads, o.x, o.y, o.x2, o.y2, side);
      const groupSpeed = squads.length > 1 ? Math.min(...squads.map((q) => q.stats.speed)) : 0;
      squads.forEach((q) => setMoveOrder(q, 'move', slots.get(q.idx), groupSpeed));
      return;
    }
    case 'attack': {
      const t = o.target;
      if (!t) return;
      ids.forEach((i) => {
        const q = w.squads[i];
        q.order = { type: 'attack' };
        q.targetKind = t.kind; q.target = t.index; q.groupSpeed = 0; q.retreating = false;
      });
      return;
    }
    case 'stop':
      ids.forEach((i) => { const q = w.squads[i]; q.order = { type: 'idle' }; q.target = -1; q.targetKind = null; q.anchorX = q.x; q.anchorY = q.y; });
      return;
    case 'hold':
      ids.forEach((i) => { const q = w.squads[i]; q.order = { type: 'hold' }; q.anchorX = q.x; q.anchorY = q.y; });
      return;
    case 'retreat':
      ids.forEach((i) => { const q = w.squads[i]; q.retreating = true; q.target = -1; q.targetKind = null; q.order = { type: 'retreat' }; });
      return;
    case 'retreatAll':
      w.squads.forEach((q) => { if (q.side === side && q.alive && !q.fled) { if (q.onField) { q.retreating = true; q.target = -1; q.order = { type: 'retreat' }; } q.reserve = false; q.enterTick = -1; } });
      w.retreatOrdered = w.retreatOrdered || [false, false];
      w.retreatOrdered[side] = true;
      return;
    case 'callReserve':
      (o.squads || []).forEach((i) => {
        const q = w.squads[i];
        if (!q || q.side !== side || !q.reserve || !q.alive || q.enterTick >= 0) return;
        if (w.supply[side] < RESERVE_COST || fieldCount(w, side) >= fieldCap(w)) return;
        w.supply[side] -= RESERVE_COST;
        q.enterTick = w.tick + RESERVE_ENTRY_TICKS;
        w.stats.reservesCalled[side] += 1;
        w.events.push({ t: w.tick, type: 'reserveCalled', id: q.idx, side });
      });
      return;
    default:
  }
};

export const applyOrders = (w, orders) => sortOrders(orders).forEach((o) => applyOrder(w, o));
