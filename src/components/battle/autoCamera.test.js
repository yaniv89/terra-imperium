import { describe, it, expect } from 'vitest';
import { autoCameraGoal, HAND_HOLD_MS } from './autoCamera';

const sq = (idx, x, y, o = {}) => ({ idx, x: x * 256, y: y * 256, alive: true, onField: true, side: 0, lastHitTick: -10000, ...o });
const screen = (cx, cz) => (x, z) => ({ x: 400 + (x - cx) * 30, y: 200 + (z - cz) * 30 });
const args = (cur, state, o = {}) => ({ cur, selected: new Set(), playerSide: 0, state, now: 10000, toScreen: screen(0, 0), width: 800, height: 400, ...o });

describe('the camera goes to the first clash, then keeps the selection in view (battle-art-8)', () => {
  it('goes to the first clash once, until a hand moves the camera', () => {
    const state = { clash: 'wait', handAt: 0 };
    const cur = { tick: 100, squads: [sq(0, 10, 10, { lastHitTick: 95 }), sq(1, 12, 10, { side: 1, lastHitTick: 99 }), sq(2, 40, 40)] };
    expect(autoCameraGoal(args(cur, state))).toEqual({ x: 11, z: 10 });
    expect(state.clash).toBe('going');
    expect(autoCameraGoal(args(cur, { clash: 'wait', handAt: 1 }, { now: 1 + HAND_HOLD_MS }))).toBeNull(); // the player moved it first
  });
  it('leaves a selection in the middle alone and brings one near the edge back in', () => {
    const state = { clash: 'done', handAt: 0 };
    const cur = { tick: 100, squads: [sq(0, 2, 1), sq(1, 12, 0)] };
    expect(autoCameraGoal(args(cur, state, { selected: new Set([0]) }))).toBeNull();
    expect(autoCameraGoal(args(cur, state, { selected: new Set([1]) }))).toEqual({ x: 12, z: 0 });
    expect(autoCameraGoal(args(cur, { ...state, handAt: 9000 }, { selected: new Set([1]) }))).toBeNull(); // a hand holds it
  });
});
