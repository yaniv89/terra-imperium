// When and where the order target ring shows (orderTarget.js): fresh for two seconds then fading,
// again while the ordered group is selected, only while the order holds and the target exists,
// and never smaller than ORDER_RING_MIN_PX on screen.
import { describe, it, expect } from 'vitest';
import { orderRingState, recordOrderTarget, ringRadius, targetPosition, ORDER_FRESH_S, ORDER_FADE_S, ORDER_GRACE_S, ORDER_RING_MIN_PX, MAX_ORDER_TARGETS } from './orderTarget';

const Q = 256;
const sq = (idx, x, y, o = {}) => ({ idx, x: x * Q, y: y * Q, side: 0, alive: true, onField: true, visible: true, order: 'idle', inside: -1, ...o });
const view = (o = {}) => ({
  squads: [sq(0, 10, 10, { classId: 'worker', order: 'work' }), sq(1, 12, 10, { classId: 'worker', order: 'work' }), sq(2, 30, 30, { side: 1 }), sq(3, 10, 14, { order: 'attack' })],
  structures: [{ id: 'keep', x: 40 * Q, y: 40 * Q, radius: 2 * Q, alive: true, hp: 100, maxHp: 100 }],
  eco: {
    nodes: [{ i: 5, x: 20 * Q, y: 10 * Q, res: 'wood', amount: 100 }],
    buildings: [{ idx: 7, x: 15 * Q, y: 20 * Q, size: 3, alive: true, built: false, hp: 10, maxHp: 100 }]
  },
  ...o
});
const gather = (t = 0) => ({ squads: [0, 1], target: { kind: 'node', index: 5 }, cmd: 'gather', t });
const none = new Set();

describe('order target ring', () => {
  it('shows on the node, with a line from the group centre, while fresh', () => {
    const s = orderRingState(gather(), view(), none, 0.5);
    expect(s).toMatchObject({ x: 20, z: 10, alpha: 1, hasFrom: true, fromX: 11, fromZ: 10 });
  });

  it('fades after the fresh time, then hides', () => {
    expect(orderRingState(gather(), view(), none, ORDER_FRESH_S + ORDER_FADE_S / 2).alpha).toBeCloseTo(0.5);
    expect(orderRingState(gather(), view(), none, ORDER_FRESH_S + ORDER_FADE_S + 0.01)).toBe(null);
  });

  it('comes back whenever the ordered group is selected, the line from the selected squads', () => {
    const s = orderRingState(gather(), view(), new Set([1]), 30);
    expect(s).toMatchObject({ alpha: 1, fromX: 12, fromZ: 10 });
    expect(orderRingState(gather(), view(), new Set([3]), 30)).toBe(null); // another squad selected
  });

  it('goes once the order no longer holds or the target is gone', () => {
    const idle = view(); idle.squads[0].order = 'idle'; idle.squads[1].order = 'move';
    expect(orderRingState(gather(), idle, new Set([0]), ORDER_GRACE_S + 0.1)).toBe(null);
    // the sim has not taken the order yet: it still counts in the grace period
    expect(orderRingState(gather(), idle, none, 0.1)).not.toBe(null);
    // paused: the sim has not stepped since the order, so it still holds for the selected group
    expect(orderRingState({ ...gather(), tick: 100 }, { ...idle, tick: 100 }, new Set([0]), 30)).not.toBe(null);
    expect(orderRingState({ ...gather(), tick: 100 }, { ...idle, tick: 120 }, new Set([0]), 30)).toBe(null);
    expect(orderRingState(gather(), view({ eco: { nodes: [], buildings: [] } }), new Set([0]), 1)).toBe(null); // used up
    const dead = view(); dead.squads[0].alive = false; dead.squads[1].alive = false;
    expect(orderRingState(gather(), dead, none, 0.1)).toBe(null);
  });

  it('attack on an enemy squad follows it and ends when it falls or hides in the fog', () => {
    const o = { squads: [3], target: { kind: 'squad', index: 2 }, cmd: 'attack', t: 0 };
    expect(orderRingState(o, view(), new Set([3]), 10)).toMatchObject({ x: 30, z: 30 });
    const v = view(); v.squads[2].alive = false;
    expect(orderRingState(o, v, new Set([3]), 10)).toBe(null);
    const f = view(); f.squads[2].visible = false;
    expect(orderRingState(o, f, new Set([3]), 1)).toBe(null);
  });

  it('build or repair ends when the building needs no more work', () => {
    const o = { squads: [0], target: { kind: 'eco', index: 7 }, cmd: 'assist', t: 0 };
    expect(orderRingState(o, view(), none, 1)).not.toBe(null);
    const done = view(); done.eco.buildings[0].built = true; done.eco.buildings[0].hp = 100;
    expect(orderRingState(o, done, none, 1)).toBe(null);
    const keep = { squads: [3], target: { kind: 'structure', index: 0 }, cmd: 'garrison', t: 0 };
    const v = view(); v.squads[3].order = 'garrison';
    expect(orderRingState(keep, v, none, 1)).toMatchObject({ x: 40, z: 40 });
    expect(targetPosition({ kind: 'structure', index: 0 }, v).r).toBeCloseTo(2.4);
  });

  it('keeps at least the minimum size on screen when zoomed out', () => {
    expect(ringRadius(0.9, 0.01)).toBe(0.9); // zoomed in: the object's own size
    expect(ringRadius(0.9, 0.2)).toBeCloseTo((ORDER_RING_MIN_PX * 0.2) / 2); // zoomed out: 24 px wide
    expect(orderRingState(gather(), view(), none, 0, 0.2).radius * 2 / 0.2).toBeGreaterThanOrEqual(ORDER_RING_MIN_PX);
  });

  it('a new order takes the squads from older ones; a plain move just clears them', () => {
    const list = [];
    recordOrderTarget(list, [0, 1], { kind: 'node', index: 5 }, 'gather', 0);
    recordOrderTarget(list, [1], { kind: 'eco', index: 7 }, 'assist', 1);
    expect(list.map((o) => o.squads)).toEqual([[0], [1]]);
    recordOrderTarget(list, [0, 1], null, null, 2);
    expect(list).toEqual([]);
    for (let k = 0; k < MAX_ORDER_TARGETS + 3; k++) recordOrderTarget(list, [k], { kind: 'squad', index: 2 }, 'attack', k);
    expect(list.length).toBe(MAX_ORDER_TARGETS);
  });
});
