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
//   { side, type: 'callReserve', squads: [idx] }   // no-op since U10 (no Reserve); still admitted for old logs
//   { side, type: 'retreatAll' }
//   { side, type: 'ability', squads: [idx], ability }   // general / perk ability (effects.js)
//   { side, type: 'power', power, x, y }                // commander power (effects.js)
//   { side, type: 'garrison', squads, structure }       // man the keep or a tower (objectives.js)
import { angleBetween, polarX, polarY } from './fixed';
import { deployZone } from './world';
import { Q, SIDE_ATTACKER } from './constants';
import { activateAbility, firePower } from './effects';
import { canGarrison, garrisonRoom, leaveGarrison } from './objectives';
import { applyEcoOrder, clearWorkerJobs } from './economy';
import { tileOf, walkableGoal } from './pathing';
import { TILE_COST } from '../setup/mapgen';

const SLOT_SPACING = Math.round(2.5 * Q);

// A squad set down on a house, a wall or water stands on the nearest open ground instead (H-04: one
// set down inside a building block could never walk out, and its orders did nothing).
const onGround = (w, q) => {
  const at = tileOf(w.map, q.x, q.y);
  if (TILE_COST[w.map.tiles[at]] > 0) return;
  const g = walkableGoal(w.map, at);
  if (g === at) return;
  q.x = (g % w.map.w) * Q + (Q >> 1); q.y = Math.floor(g / w.map.w) * Q + (Q >> 1);
};

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

// Every squad walks at its own pace, also in a mixed group (the user's ruling Q6, I192, U07): an
// order never slows cavalry down to the infantry's or the siege train's speed.
const setMoveOrder = (q, type, slot) => {
  q.order = { type, x: slot.x, y: slot.y, facing: slot.facing };
  q.retreating = false;
  if (type === 'move') { q.target = -1; q.targetKind = null; }
};

// Orders that send a squad somewhere bring it out of its building first.
const LEAVES_GARRISON = new Set(['move', 'attackMove', 'movePath', 'formationLine', 'attack', 'retreat']);
// Orders that take a worker off its job (economy.js).
const TAKES_OFF_WORK = new Set(['move', 'attackMove', 'movePath', 'formationLine', 'stop', 'hold', 'retreat']);
// Orders that leave what a squad is doing alone (an ability, a commander power).
const KEEPS_RESUME = new Set(['ability', 'power']);

export const applyOrder = (w, o) => {
  const side = o.side;
  // The battle economy's orders (gather, build, assist, repair, train, cancelTrain, rally,
  // cancelBuild: economy.js), only in a battle with an economy.
  if (applyEcoOrder(w, o)) return;
  const ids = (o.squads || []).filter((i) => commandable(w, side, i));
  // A new order replaces the job a squad would have gone back to after a fight (U11).
  if (!KEEPS_RESUME.has(o.type)) ids.forEach((i) => { w.squads[i].resumeKind = null; w.squads[i].resumeTarget = -1; w.squads[i].path = null; }); // a new order drops a drawn path (U38)
  if (LEAVES_GARRISON.has(o.type))ids.forEach((i) => leaveGarrison(w, w.squads[i]));
  if (TAKES_OFF_WORK.has(o.type)) clearWorkerJobs(w, side, ids);
  switch (o.type) {
    case 'garrison': {
      // { structure } — march into the keep or a tower (defenders' infantry/ranged, while there's room).
      const si = o.structure;
      const s = w.structures[si];
      if (!s) return;
      let room = garrisonRoom(w, si) - w.squads.filter((q) => q.order.type === 'garrison' && q.order.structure === si && q.inside < 0).length;
      ids.forEach((i) => {
        const q = w.squads[i];
        if (room <= 0 || !canGarrison(q) || q.inside >= 0) return;
        q.order = { type: 'garrison', structure: si, x: s.x, y: s.y };
        q.target = -1; q.targetKind = null; q.retreating = false;
        room -= 1;
      });
      return;
    }
    case 'move':
    case 'attackMove': {
      const squads = ids.map((i) => w.squads[i]);
      if (!squads.length) return;
      const slots = squads.length === 1 ? new Map([[squads[0].idx, { x: o.x, y: o.y, facing: squads[0].facing }]]) : formationSlots(squads, o.x, o.y, o.formation);
      squads.forEach((q) => setMoveOrder(q, o.type, slots.get(q.idx)));
      return;
    }
    case 'movePath': {
      // U38 { path: [{x, y}] }: walk the drawn waypoints in turn (movement.js takes the next on arrival).
      // The group keeps its shape: each squad's slot offset at the first point rides along.
      const squads = ids.map((i) => w.squads[i]);
      const [first, ...rest] = o.path || [];
      if (!squads.length || !first) return;
      const slots = squads.length === 1 ? new Map([[squads[0].idx, { x: first.x, y: first.y, facing: squads[0].facing }]]) : formationSlots(squads, first.x, first.y, o.formation);
      squads.forEach((q) => {
        const slot = slots.get(q.idx);
        setMoveOrder(q, 'move', slot);
        q.path = rest.map((pt) => ({ x: pt.x + slot.x - first.x, y: pt.y + slot.y - first.y }));
      });
      return;
    }
    case 'formationLine': {
      const squads = ids.map((i) => w.squads[i]);
      if (!squads.length) return;
      const slots = lineSlots(squads, o.x, o.y, o.x2, o.y2, side);
      squads.forEach((q) => setMoveOrder(q, 'move', slots.get(q.idx)));
      return;
    }
    case 'attack': {
      const t = o.target;
      // A target that is not on this field (an index past the list, an economy building in a
      // battle without an economy) is no order at all.
      if (!t || !(t.kind === 'squad' ? w.squads[t.index] : t.kind === 'eco' ? w.eco?.buildings[t.index] : t.kind === 'structure' ? w.structures[t.index] : null)) return;
      ids.forEach((i) => {
        const q = w.squads[i];
        q.order = { type: 'attack' };
        q.targetKind = t.kind; q.target = t.index; q.retreating = false;
      });
      return;
    }
    case 'deploy': {
      // { x, y } before the first tick only (the deployment phase, plan D5): the squads are set
      // down at once, in formation, clamped to their side's deployment zone (world.js).
      if (w.tick !== 0) return;
      const squads = ids.map((i) => w.squads[i]).filter((q) => q.onField && !(q.inside >= 0));
      if (!squads.length) return;
      const zone = deployZone(w, side);
      const clampX = (x) => Math.max(zone.x0 * Q + (Q >> 1), Math.min(zone.x1 * Q + (Q >> 1), x));
      const clampY = (y) => Math.max(zone.y0 * Q + (Q >> 1), Math.min(zone.y1 * Q + (Q >> 1), y));
      const slots = squads.length === 1 ? new Map([[squads[0].idx, { x: o.x, y: o.y }]]) : formationSlots(squads, clampX(o.x), clampY(o.y), o.formation);
      squads.forEach((q) => { const slot = slots.get(q.idx); q.x = clampX(slot.x); q.y = clampY(slot.y); onGround(w, q); q.anchorX = q.x; q.anchorY = q.y; q.order = { type: 'idle' }; q.target = -1; q.targetKind = null; });
      w.events.push({ t: w.tick, type: 'deployed', side, ids: squads.map((q) => q.idx) });
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
      w.squads.forEach((q) => { if (q.side === side && q.alive && !q.fled) { leaveGarrison(w, q); if (q.onField) { q.retreating = true; q.target = -1; q.order = { type: 'retreat' }; } q.reserve = false; q.enterTick = -1; } });
      w.retreatOrdered = w.retreatOrdered || [false, false];
      w.retreatOrdered[side] = true;
      return;
    case 'callReserve':
      // U10 (the user's ruling Q2): there is no reserve to call. The whole army starts on the field
      // and allied reinforcements march in on their own (world.js). Kept as a harmless order so a
      // log recorded before setup version 8 is still admitted (battleVerify.js refuses to replay it).
      return;
    case 'ability':
      ids.forEach((i) => activateAbility(w, w.squads[i], o.ability));
      return;
    case 'power':
      firePower(w, side, o.power, o.x, o.y);
      return;
    default:
  }
};

export const applyOrders = (w, orders) => sortOrders(orders).forEach((o) => applyOrder(w, o));

// The deployment phase (plan D5): before the first tick the live battle sets a `deploy` order down
// the moment it arrives (worker/battleLoop.js pushOrders), ahead of the first tick's fog, the AI's
// first thought and any other order given before Start. Every replay of a log (headless.js,
// replay.js, the loop's resume) does the same through here, in the log's order, so both agree.
export const isDeployment = (o) => o?.type === 'deploy' && o.tick === 0;
/** Sets the log's deployment down on a world at tick 0; returns the orders left for step(). */
export const applyDeployment = (w, orders) => {
  if (!orders.some(isDeployment)) return orders;
  if (w.tick === 0) { orders.forEach((o) => { if (isDeployment(o)) applyOrder(w, o); }); w.events.length = 0; }
  return orders.filter((o) => !isDeployment(o));
};
