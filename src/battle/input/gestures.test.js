// Gesture disambiguation (Tactical Battles plan §11.2): each gesture is decided early and never
// turns into another — panning can't open a menu, a second finger always means pinch.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGestureRecognizer, LONG_MS } from './gestures';

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

    it('the mouse is unchanged: right drag still pans', () => {
      down(1, 50, 50, { pointerType: 'mouse', button: 2 }); clock += 30; move(1, 120, 90, { pointerType: 'mouse', button: 2 }); up(1, 120, 90, { pointerType: 'mouse', button: 2 });
      expect(h.pan).toHaveBeenCalled();
      expect(h.lassoEnd).not.toHaveBeenCalled();
    });
  });

  it('with a mouse: right click orders, left drag box-selects', () => {
    down(1, 50, 50, { pointerType: 'mouse', button: 2 }); clock += 50; up(1, 50, 50, { pointerType: 'mouse', button: 2 });
    expect(h.order).toHaveBeenCalledTimes(1);
    down(1, 50, 50, { pointerType: 'mouse' }); clock += 50; move(1, 150, 120, { pointerType: 'mouse' }); up(1, 150, 120, { pointerType: 'mouse' });
    expect(h.lassoEnd).toHaveBeenCalledTimes(1);
  });
});
