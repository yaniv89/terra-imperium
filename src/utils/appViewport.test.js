// The visible area (iOS Safari's bars) as --app-height / --app-vh, and no page scroll behind the game.
import { describe, it, expect } from 'vitest';
import { visibleHeight, applyAppViewport } from './appViewport';

const fakeWindow = ({ inner = 390, vv = null, scrollY = 0 } = {}) => {
  const props = {};
  const win = {
    innerHeight: inner,
    visualViewport: vv,
    scrollY,
    scrollX: 0,
    scrolledTo: null,
    scrollTo(x, y) { this.scrolledTo = [x, y]; this.scrollY = y; },
    document: { documentElement: { style: { setProperty: (k, v) => { props[k] = v; }, getPropertyValue: (k) => props[k] || '' } } }
  };
  return { win, props };
};

describe('appViewport', () => {
  it('uses the visual viewport when Safari bars take height', () => {
    expect(visibleHeight({ innerHeight: 390, visualViewport: { height: 340, scale: 1 } })).toBe(340);
  });
  it('never exceeds the layout height, and ignores a pinch zoom', () => {
    expect(visibleHeight({ innerHeight: 340, visualViewport: { height: 390, scale: 1 } })).toBe(340);
    expect(visibleHeight({ innerHeight: 390, visualViewport: { height: 160, scale: 2.4 } })).toBe(390);
    expect(visibleHeight({ innerHeight: 390 })).toBe(390);
  });
  it('writes --app-height and --app-vh, and scrolls a scrolled page back to the top', () => {
    const { win, props } = fakeWindow({ inner: 390, vv: { height: 340.4, scale: 1 }, scrollY: 50 });
    expect(applyAppViewport(win)).toBe(340);
    expect(props['--app-height']).toBe('340px');
    expect(props['--app-vh']).toBe('3.4px');
    expect(win.scrolledTo).toEqual([0, 0]);
  });
});
