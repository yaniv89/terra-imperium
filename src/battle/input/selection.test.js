// Picking buildings on the battlefield: a generous hit area, your own buildings only, the keep as
// the town hall, and a second click at the same spot cycles from the units to the building.
import { describe, it, expect } from 'vitest';
import { pickOwnBuilding, isCycleClick, decidePointer, selectionAfter, needsWork, SAME_SPOT_PX, CYCLE_MS } from './selection';

const Q = 256;
const b = (idx, x, y, o = {}) => ({ idx, x: x * Q, y: y * Q, size: 3, side: 0, alive: true, built: true, hp: 100, maxHp: 100, proxy: false, ...o });
const view = { eco: { buildings: [b(1, 10, 10), b(2, 20, 10, { side: 1 }), b(3, 0, 0, { proxy: true, size: 1 }), b(4, 14.2, 10)] } };

describe('picking a building', () => {
  it('hits a building well outside its footprint (the margin), and the nearest of two', () => {
    expect(pickOwnBuilding({ x: 10, z: 10 }, view, 0)?.idx).toBe(1);
    expect(pickOwnBuilding({ x: 12.0, z: 10 }, view, 0, { margin: 0.7 })?.idx).toBe(1); // 0.5 past the edge
    expect(pickOwnBuilding({ x: 12.15, z: 10 }, view, 0, { margin: 0.7 })?.idx).toBe(4); // nearer to 4
    expect(pickOwnBuilding({ x: 10, z: 13 }, view, 0, { margin: 0.7 })).toBe(null);
  });

  it("never picks the enemy's buildings; the keep counts as your town hall", () => {
    expect(pickOwnBuilding({ x: 20, z: 10 }, view, 0)).toBe(null);
    expect(pickOwnBuilding({ x: 30, z: 30 }, view, 0, { keepHit: true })?.idx).toBe(3);
  });

  it('units over a building: the first click picks the units, a second at the same spot the building, a third the units', () => {
    const building = view.eco.buildings[0];
    const p = { x: 100, y: 100 };
    let state = { ids: [], building: null };
    let last = null;
    const clickAt = (t, input = 'tap') => {
      const cycle = isCycleClick(last, p, t, 5, state.ids);
      const act = decidePointer({ input, ownSquad: 5, building, selection: state.ids.map((idx) => ({ idx, classId: 'infantry' })), cycle });
      last = act.do === 'select' ? { x: p.x, y: p.y, t, squad: 5 } : null;
      state = selectionAfter(state, act);
    };
    clickAt(0);
    expect(state).toEqual({ ids: [5], building: null });
    clickAt(400);
    expect(state).toEqual({ ids: [], building: 1 });
    clickAt(800);
    expect(state).toEqual({ ids: [5], building: null });
    // The same for a mouse left click.
    state = { ids: [], building: null }; last = null;
    clickAt(0, 'left'); clickAt(300, 'left');
    expect(state.building).toBe(1);
  });

  it('a cycle needs the same spot and a short gap', () => {
    const last = { x: 0, y: 0, t: 0, squad: 2 };
    expect(isCycleClick(last, { x: SAME_SPOT_PX - 1, y: 0 }, 100, 2, [2])).toBe(true);
    expect(isCycleClick(last, { x: SAME_SPOT_PX + 5, y: 0 }, 100, 2, [2])).toBe(false);
    expect(isCycleClick(last, { x: 0, y: 0 }, CYCLE_MS + 1, 2, [2])).toBe(false);
    expect(isCycleClick(last, { x: 0, y: 0 }, 100, 3, [3])).toBe(false);
  });

  it('only workers on an unfinished or damaged building build or repair; otherwise it is selected', () => {
    const damaged = b(9, 0, 0, { hp: 40 });
    const site = b(9, 0, 0, { built: false });
    const fine = b(9, 0, 0);
    const workers = [{ idx: 1, classId: 'worker' }];
    expect(needsWork(damaged) && needsWork(site) && !needsWork(fine)).toBe(true);
    expect(decidePointer({ input: 'tap', building: damaged, selection: workers }).do).toBe('order');
    expect(decidePointer({ input: 'tap', building: site, selection: workers }).do).toBe('order');
    expect(decidePointer({ input: 'tap', building: fine, selection: workers })).toEqual({ do: 'selectBuilding', idx: 9 });
    expect(decidePointer({ input: 'tap', building: damaged, selection: [...workers, { idx: 2, classId: 'cavalry' }] })).toEqual({ do: 'selectBuilding', idx: 9 });
    // A mouse orders with the right button: workers repair, other units walk there.
    expect(decidePointer({ input: 'right', building: damaged, selection: workers }).do).toBe('order');
  });

  it('right click cancels a building being placed or an armed power; left click carries them out', () => {
    expect(decidePointer({ input: 'right', armed: { type: 'place' } }).do).toBe('cancelArmed');
    expect(decidePointer({ input: 'right', armed: { type: 'power' } }).do).toBe('cancelArmed');
    expect(decidePointer({ input: 'left', armed: { type: 'place' } }).do).toBe('armed');
    expect(decidePointer({ input: 'tap', armed: { type: 'power' }, ownSquad: 3 }).do).toBe('armed');
  });
});
