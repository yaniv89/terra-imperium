// Gesture disambiguation (Tactical Battles plan §11.2): each gesture is decided early and never
// turns into another — panning can't open a menu, a second finger always means pinch.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGestureRecognizer, LONG_MS } from './gestures';
import { decidePointer, selectionAfter } from './selection';

const makeEl = () => {
  const handlers = {};
  return {
    handlers,
    addEventListener: (t, fn) => { handlers[t] = fn; },
    removeEventListener: (t) => { delete handlers[t]; },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: () => {}
  };
};
let clock = 0;
const ev = (id, x, y, extra = {}) => ({ pointerId: id, clientX: x, clientY: y, timeStamp: clock, pointerType: 'touch', button: 0, preventDefault: () => {}, ...extra });

describe('battle gestures', () => {
  let el; let h; let dispose;
  beforeEach(() => {
    vi.useFakeTimers(); clock = 0;
    el = makeEl();
    h = { tap: vi.fn(), pan: vi.fn(), longPress: vi.fn(), radial: vi.fn(), formationDrag: vi.fn(), formationEnd: vi.fn(), lassoDrag: vi.fn(), lassoEnd: vi.fn(), zoom: vi.fn(), order: vi.fn(), isOnSelectedSquad: vi.fn(() => false) };
    dispose = createGestureRecognizer(el, h);
  });
  afterEach(() => { dispose(); vi.useRealTimers(); });
  const down = (id, x, y, extra) => el.handlers.pointerdown(ev(id, x, y, extra));
  const move = (id, x, y, extra) => el.handlers.pointermove(ev(id, x, y, extra));
  const up = (id, x, y, extra) => el.handlers.pointerup(ev(id, x, y, extra));

  it('a quick touch is a tap', () => {
    down(1, 100, 100); clock += 100; up(1, 102, 101);
    expect(h.tap).toHaveBeenCalledTimes(1);
    expect(h.pan).not.toHaveBeenCalled();
  });

  it('a drag on empty ground pans, and never becomes a long-press', () => {
    down(1, 100, 100); clock += 50; move(1, 130, 100); vi.advanceTimersByTime(LONG_MS + 50); clock += 400; move(1, 160, 110); up(1, 160, 110);
    expect(h.pan).toHaveBeenCalled();
    expect(h.longPress).not.toHaveBeenCalled();
    expect(h.tap).not.toHaveBeenCalled();
  });

  it('holding still on the ground is a long-press (attack-move)', () => {
    down(1, 100, 100); vi.advanceTimersByTime(LONG_MS + 10); clock += LONG_MS + 10; up(1, 100, 100);
    expect(h.longPress).toHaveBeenCalledTimes(1);
    expect(h.tap).not.toHaveBeenCalled();
  });

  it('dragging from a selected squad draws a formation line; holding it opens the radial', () => {
    h.isOnSelectedSquad.mockReturnValue(true);
    down(1, 100, 100); clock += 30; move(1, 200, 140); up(1, 200, 140);
    expect(h.formationDrag).toHaveBeenCalled();
    expect(h.formationEnd).toHaveBeenCalledTimes(1);
    clock += 1000;
    down(2, 100, 100); vi.advanceTimersByTime(LONG_MS + 10);
    expect(h.radial).toHaveBeenCalledTimes(1);
  });

  it('double-tap then drag is a lasso', () => {
    down(1, 100, 100); clock += 80; up(1, 100, 100);
    clock += 120; down(1, 100, 100); clock += 30; move(1, 180, 170); up(1, 180, 170);
    expect(h.lassoEnd).toHaveBeenCalledTimes(1);
    expect(h.pan).not.toHaveBeenCalled();
  });

  it('a second finger turns the gesture into pinch-zoom', () => {
    down(1, 100, 100); down(2, 200, 100); move(2, 260, 100); up(2, 260, 100); up(1, 100, 100);
    expect(h.zoom).toHaveBeenCalled();
    expect(h.tap).not.toHaveBeenCalled();
  });

  describe('select mode (the HUD Select button)', () => {
    let selectMode;
    beforeEach(() => {
      dispose();
      selectMode = true;
      h.isSelectMode = vi.fn(() => selectMode);
      h.selectModeDone = vi.fn(() => { selectMode = false; });
      dispose = createGestureRecognizer(el, h);
    });

    it('a one-finger drag draws the box instead of panning', () => {
      down(1, 100, 100); clock += 30; move(1, 180, 170); up(1, 180, 170);
      expect(h.lassoDrag).toHaveBeenCalled();
      expect(h.lassoEnd).toHaveBeenCalledTimes(1);
      expect(h.pan).not.toHaveBeenCalled();
    });

    it('wins over a formation drag from a selected squad', () => {
      h.isOnSelectedSquad.mockReturnValue(true);
      down(1, 100, 100); clock += 30; move(1, 180, 170); up(1, 180, 170);
      expect(h.lassoEnd).toHaveBeenCalledTimes(1);
      expect(h.formationDrag).not.toHaveBeenCalled();
    });

    it('two fingers still pan and pinch, and keep the mode on', () => {
      down(1, 100, 100); down(2, 200, 100); move(2, 260, 120); move(1, 110, 120); up(2, 260, 120); up(1, 110, 120);
      expect(h.pan).toHaveBeenCalled();
      expect(h.zoom).toHaveBeenCalled();
      expect(h.lassoEnd).not.toHaveBeenCalled();
      expect(h.selectModeDone).not.toHaveBeenCalled();
      expect(selectMode).toBe(true);
    });

    it('turns off after a completed selection: the next drag pans', () => {
      down(1, 100, 100); clock += 30; move(1, 180, 170); up(1, 180, 170);
      expect(h.selectModeDone).toHaveBeenCalledTimes(1);
      expect(selectMode).toBe(false);
      clock += 1000; down(1, 100, 100); clock += 30; move(1, 160, 140); up(1, 160, 140);
      expect(h.pan).toHaveBeenCalled();
      expect(h.lassoEnd).toHaveBeenCalledTimes(1);
    });

    it('a double-tap lasso outside select mode does not report a select-mode selection', () => {
      selectMode = false;
      down(1, 100, 100); clock += 80; up(1, 100, 100);
      clock += 120; down(1, 100, 100); clock += 30; move(1, 180, 170); up(1, 180, 170);
      expect(h.lassoEnd).toHaveBeenCalledTimes(1);
      expect(h.selectModeDone).not.toHaveBeenCalled();
    });

    it('the mouse ignores it: right drag with nothing selected pans', () => {
      down(1, 50, 50, { pointerType: 'mouse', button: 2 }); clock += 30; move(1, 120, 90, { pointerType: 'mouse', button: 2 }); up(1, 120, 90, { pointerType: 'mouse', button: 2 });
      expect(h.pan).toHaveBeenCalled();
      expect(h.lassoEnd).not.toHaveBeenCalled();
    });
  });

  describe('with a mouse', () => {
    const M = { pointerType: 'mouse' };
    const R = { pointerType: 'mouse', button: 2 };
    beforeEach(() => { h.click = vi.fn(); h.hasSelection = vi.fn(() => false); });

    it('right click orders, left drag box-selects', () => {
      down(1, 50, 50, R); clock += 50; up(1, 50, 50, R);
      expect(h.order).toHaveBeenCalledTimes(1);
      down(1, 50, 50, M); clock += 50; move(1, 150, 120, M); up(1, 150, 120, M);
      expect(h.lassoEnd).toHaveBeenCalledTimes(1);
    });

    it('left click is a click (never an order), with the shift key passed on', () => {
      down(1, 50, 50, { ...M, shiftKey: true }); clock += 50; up(1, 50, 50, M);
      expect(h.click).toHaveBeenCalledWith({ x: 50, y: 50 }, { shift: true });
      expect(h.order).not.toHaveBeenCalled();
      expect(h.tap).not.toHaveBeenCalled();
    });

    it('left drag from a selected squad is still a box, not a battle line', () => {
      h.isOnSelectedSquad.mockReturnValue(true);
      down(1, 50, 50, M); clock += 30; move(1, 150, 120, M); up(1, 150, 120, M);
      expect(h.lassoEnd).toHaveBeenCalledTimes(1);
      expect(h.formationEnd).not.toHaveBeenCalled();
    });

    it('right drag with a selection draws the battle line; middle drag pans', () => {
      h.hasSelection.mockReturnValue(true);
      down(1, 50, 50, R); clock += 30; move(1, 150, 60, R); up(1, 150, 60, R);
      expect(h.formationEnd).toHaveBeenCalledTimes(1);
      expect(h.order).not.toHaveBeenCalled();
      down(1, 50, 50, { ...M, button: 1 }); clock += 30; move(1, 90, 80, { ...M, button: 1 }); up(1, 90, 80, { ...M, button: 1 });
      expect(h.pan).toHaveBeenCalled();
      expect(h.click).not.toHaveBeenCalled();
    });

    it('blocks the browser context menu', () => {
      const e = { preventDefault: vi.fn() };
      el.handlers.contextmenu(e);
      expect(e.preventDefault).toHaveBeenCalled();
    });
  });
});

// The control scheme end to end: the recognizer feeds selection.js's decisions, as
// TacticalBattleScreen.jsx wires them. A tiny world: squad 0 (infantry) at (100,100), squad 1
// (worker) at (300,100), your damaged barracks at (200,200), empty ground elsewhere.
describe('battle controls: select, deselect, order', () => {
  const squads = { 0: { x: 100, y: 100, classId: 'infantry' }, 1: { x: 300, y: 100, classId: 'worker' } };
  const barracks = { idx: 7, built: true, hp: 300, maxHp: 500, proxy: false };
  const near = (p, q, r = 15) => Math.hypot(p.x - q.x, p.y - q.y) <= r;
  let el; let state; let orders; let dispose;
  const pointer = (input, p, mods = {}) => {
    const own = Object.keys(squads).map(Number).find((i) => near(p, squads[i]));
    const building = near(p, { x: 200, y: 200 }, 40) ? barracks : null;
    const act = decidePointer({ input, shift: !!mods.shift, ownSquad: own ?? null, building, selection: state.ids.map((i) => ({ idx: i, classId: squads[i].classId })), selectedBuilding: state.building !== null ? { idx: state.building, trains: true } : null });
    if (act.do === 'order' || act.do === 'rally') orders.push({ ...act, at: p });
    state = selectionAfter(state, act);
  };
  beforeEach(() => {
    vi.useFakeTimers(); clock = 0;
    el = makeEl(); state = { ids: [], building: null }; orders = [];
    dispose = createGestureRecognizer(el, { tap: (p) => pointer('tap', p), click: (p, m) => pointer('left', p, m), order: (p) => pointer('right', p), hasSelection: () => state.ids.length > 0 });
  });
  afterEach(() => { dispose(); vi.useRealTimers(); });
  const click = (x, y, extra = {}) => { el.handlers.pointerdown(ev(1, x, y, { pointerType: 'mouse', ...extra })); clock += 40; el.handlers.pointerup(ev(1, x, y, { pointerType: 'mouse', ...extra })); clock += 500; };
  const tap = (x, y) => { el.handlers.pointerdown(ev(1, x, y)); clock += 40; el.handlers.pointerup(ev(1, x, y)); clock += 500; };

  it('mouse: left click selects, left click on empty ground deselects everything', () => {
    click(100, 100);
    expect(state.ids).toEqual([0]);
    click(300, 100, { shiftKey: true });
    expect(state.ids).toEqual([0, 1]);
    click(600, 300);
    expect(state.ids).toEqual([]);
    expect(orders).toEqual([]);
  });

  it('mouse: right click orders (and keeps the selection); left click never orders', () => {
    click(100, 100);
    click(500, 300, { button: 2 });
    expect(orders).toHaveLength(1);
    expect(orders[0].do).toBe('order');
    expect(state.ids).toEqual([0]);
  });

  it('mouse: a building selects with a left click; right click then sets its rally point', () => {
    click(205, 195);
    expect(state).toEqual({ ids: [], building: 7 });
    click(500, 300, { button: 2 });
    expect(orders.map((o) => o.do)).toEqual(['rally']);
  });

  it('touch: tap selects, tap the selected unit again deselects it, tap the ground orders', () => {
    tap(100, 100);
    expect(state.ids).toEqual([0]);
    tap(500, 300);
    expect(orders).toHaveLength(1);
    tap(100, 100);
    expect(state.ids).toEqual([]);
  });

  it('touch: your own building selects that building, not an order for the troops', () => {
    tap(100, 100);
    tap(200, 200);
    expect(orders).toEqual([]);
    expect(state).toEqual({ ids: [], building: 7 });
  });

  it('touch: workers alone on a damaged building repair it', () => {
    tap(300, 100);
    tap(200, 200);
    expect(orders).toHaveLength(1);
    expect(state.ids).toEqual([1]);
  });

  it('the selection card x (and Esc) clears everything', () => {
    tap(100, 100);
    state = selectionAfter(state, { do: 'deselect' });
    expect(state).toEqual({ ids: [], building: null });
  });
});
