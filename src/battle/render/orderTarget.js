// src/battle/render/orderTarget.js
// The order target indicator: when the player sends units or workers at an OBJECT (workers to a
// resource node, to build or repair a building; troops to attack an enemy squad, building or
// structure, or to man a keep or tower), a pulsing brass-yellow ring marks that object and a thin
// dashed line runs to it from the group. It shows while the order is fresh (ORDER_FRESH_S, then
// it fades over ORDER_FADE_S) and again whenever one of the ordered squads is selected, as long
// as the order still holds. Plain move orders keep the old ground marker. Pure: the renderer
// (BattleRenderer.drawOrderTargets) draws what orderRingState says; nothing here touches the sim.

export const ORDER_FRESH_S = 2;
export const ORDER_FADE_S = 0.6;
// Until the sim has taken the order (a frame or two later), it counts as holding.
export const ORDER_GRACE_S = 1;
export const ORDER_GRACE_TICKS = 4;
export const ORDER_RING_COLOR = '#F5C542';
export const ORDER_RING_MIN_PX = 24; // the ring's smallest diameter on screen (phones zoomed out)
export const MAX_ORDER_TARGETS = 8;

const Q = 256;

/** The order type a squad shows while it carries out an order at a target of this kind. */
export const expectedOrderType = (cmd) => (cmd === 'attack' ? 'attack' : cmd === 'garrison' ? 'garrison' : 'work');

/**
 * Where the target is now (tiles) and how big, or null when it is gone or out of sight.
 * target: { kind: 'node' | 'eco' | 'structure' | 'squad', index }; writes into `out`.
 */
export const targetPosition = (target, view, out = {}) => {
  if (!target || !view) return null;
  if (target.kind === 'node') {
    const nodes = view.eco?.nodes || [];
    for (let k = 0; k < nodes.length; k++) {
      const n = nodes[k];
      if (n.i === target.index) { out.x = n.x / Q; out.z = n.y / Q; out.r = 0.9; out.row = n; return out; }
    }
    return null; // used up or no longer seen
  }
  if (target.kind === 'eco') {
    const bs = view.eco?.buildings || [];
    for (let k = 0; k < bs.length; k++) {
      const b = bs[k];
      if (b.idx === target.index) {
        if (!b.alive) return null;
        out.x = b.x / Q; out.z = b.y / Q; out.r = b.size / 2 + 0.35; out.row = b; return out;
      }
    }
    return null;
  }
  if (target.kind === 'structure') {
    const s = view.structures?.[target.index];
    if (!s || !s.alive) return null;
    out.x = s.x / Q; out.z = s.y / Q; out.r = s.radius / Q + 0.4; out.row = s; return out;
  }
  if (target.kind === 'squad') {
    const q = view.squads?.[target.index];
    if (!q || !q.alive || !q.onField || q.fled || q.visible === false) return null;
    out.x = q.x / Q; out.z = q.y / Q; out.r = 1.3; out.row = q; return out;
  }
  return null;
};

/**
 * Does the order still hold? Some ordered squad is alive on the field and (after the grace
 * period) still on that kind of order; workers sent to build or repair stop once the building
 * needs no more work.
 */
export const orderStillActive = (order, view, age, pos) => {
  if (!order || !pos) return false;
  if (order.cmd === 'assist' || order.cmd === 'repair') {
    const b = pos.row;
    if (!b || (b.built !== false && !(b.hp < b.maxHp))) return false;
  }
  const want = expectedOrderType(order.cmd);
  // Not taken yet: a moment after the order, or the sim has not stepped since (paused).
  const grace = age < ORDER_GRACE_S || (order.tick != null && view.tick != null && view.tick <= order.tick + ORDER_GRACE_TICKS);
  for (let k = 0; k < order.squads.length; k++) {
    const q = view.squads?.[order.squads[k]];
    if (!q || !q.alive || q.fled || q.routed) continue;
    if (grace || q.order === want) return true;
  }
  return false;
};

/** How strongly the ring shows: 1 while fresh or the group is selected, fading after. */
export const orderAlpha = (order, age, selected) => {
  for (let k = 0; k < order.squads.length; k++) if (selected?.has?.(order.squads[k])) return 1;
  if (age < ORDER_FRESH_S) return 1;
  if (age < ORDER_FRESH_S + ORDER_FADE_S) return 1 - (age - ORDER_FRESH_S) / ORDER_FADE_S;
  return 0;
};

/** The ring's world radius so its diameter stays at least ORDER_RING_MIN_PX on screen. */
export const ringRadius = (r, worldPerPixel) => Math.max(r, (ORDER_RING_MIN_PX * (worldPerPixel || 0)) / 2);

/**
 * Should a ring show for `order` now, and where? Returns `out` filled with
 * { x, z, radius, alpha, fromX, fromZ, hasFrom } (tiles), or null.
 * order: { squads: [idx], target, cmd: 'gather' | 'assist' | 'repair' | 'attack' | 'garrison', t }
 */
export const orderRingState = (order, view, selected, now, worldPerPixel = 0, out = {}) => {
  if (!order || !view) return null;
  const age = now - order.t;
  if (age < 0) return null;
  const pos = targetPosition(order.target, view, out);
  if (!pos || !orderStillActive(order, view, age, pos)) return null;
  const alpha = orderAlpha(order, age, selected);
  if (alpha <= 0) return null;
  // The line starts at the ordered squads' centre (the selected ones when the group is picked).
  let sx = 0; let sz = 0; let n = 0; let anySel = false;
  for (let k = 0; k < order.squads.length; k++) if (selected?.has?.(order.squads[k])) { anySel = true; break; }
  for (let k = 0; k < order.squads.length; k++) {
    const i = order.squads[k];
    const q = view.squads?.[i];
    if (!q || !q.alive || !q.onField || q.fled || (q.inside ?? -1) >= 0) continue;
    if (anySel && !selected.has(i)) continue;
    sx += q.x / Q; sz += q.y / Q; n += 1;
  }
  out.radius = ringRadius(pos.r, worldPerPixel);
  out.alpha = alpha;
  out.hasFrom = n > 0;
  out.fromX = n ? sx / n : out.x; out.fromZ = n ? sz / n : out.z;
  out.row = null;
  return out;
};

/**
 * Remember a new order in `list` (mutated, newest last): the squads leave any older order, empty
 * orders go, and the list keeps at most MAX_ORDER_TARGETS. target null = a plain move (the squads
 * just leave their old orders).
 */
export const recordOrderTarget = (list, squads, target, cmd, t, tick = null) => {
  for (let k = list.length - 1; k >= 0; k--) {
    const o = list[k];
    o.squads = o.squads.filter((i) => !squads.includes(i));
    if (!o.squads.length) list.splice(k, 1);
  }
  if (target && squads.length) {
    list.push({ squads: [...squads], target: { kind: target.kind, index: target.index }, cmd, t, tick });
    while (list.length > MAX_ORDER_TARGETS) list.shift();
  }
  return list;
};
