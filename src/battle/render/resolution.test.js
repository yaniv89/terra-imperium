import { describe, it, expect, vi } from 'vitest';
import { BattleRenderer } from './BattleRenderer';

describe('adaptive battle resolution', () => {
  it('recovers on a 60 Hz display after sustained frame stability', () => {
    const renderer = { setPixelRatio: vi.fn(), setSize: vi.fn() };
    const view = { renderer, baseDpr: 2, dpr: 2, slowFrames: 0, fastFrames: 0, width: 800, height: 600 };
    const frame = dt => BattleRenderer.prototype.adaptResolution.call(view, dt);
    for (let i = 0; i < 3; i++) frame(1 / 30);
    expect(view.dpr).toBe(1.25);
    for (let i = 0; i < 240; i++) frame(1 / 60);
    expect(view.dpr).toBe(2);
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(2);
  });
  it('does not recover during borderline slow frames or exceed native DPR', () => {
    const view = { renderer: { setPixelRatio: vi.fn() }, baseDpr: 1.1, dpr: 1, slowFrames: 0, fastFrames: 0 };
    for (let i = 0; i < 240; i++) BattleRenderer.prototype.adaptResolution.call(view, 0.019);
    expect(view.dpr).toBe(1);
    for (let i = 0; i < 240; i++) BattleRenderer.prototype.adaptResolution.call(view, 1 / 60);
    expect(view.dpr).toBe(1.1);
  });
});

// H-06: a resize or a display change (browser zoom, another screen) must size the drawing buffer to
// the canvas's box at the screen's pixel ratio now, not the one the battle opened with.
describe('battle resize and pixel ratio', () => {
  const view = (over = {}) => {
    const renderer = { setPixelRatio: vi.fn(), setSize: vi.fn() };
    const camera = { updateProjectionMatrix: vi.fn() };
    return { renderer, camera, baseDpr: 1, dpr: 1, syncPixelRatio: BattleRenderer.prototype.syncPixelRatio, ...over };
  };
  it('takes a new device pixel ratio on resize, up to the battle cap', () => {
    const v = view();
    BattleRenderer.prototype.resize.call(v, 1118, 646, { devicePixelRatio: 1.36 });
    expect(v.baseDpr).toBe(1.36); expect(v.dpr).toBe(1.36);
    expect(v.renderer.setPixelRatio).toHaveBeenLastCalledWith(1.36);
    expect(v.renderer.setSize).toHaveBeenLastCalledWith(1118, 646, false);
    BattleRenderer.prototype.resize.call(v, 1118, 646, { devicePixelRatio: 3 });
    expect(v.dpr).toBeLessThanOrEqual(2);
  });
  it('keeps an adaptive step down below the new top, and leaves the ratio alone when it did not change', () => {
    const v = view({ baseDpr: 2, dpr: 1.25 });
    BattleRenderer.prototype.resize.call(v, 800, 420, { devicePixelRatio: 1.5 });
    expect(v.baseDpr).toBe(1.5); expect(v.dpr).toBe(1.25);
    v.renderer.setPixelRatio.mockClear();
    BattleRenderer.prototype.resize.call(v, 900, 420, { devicePixelRatio: 1.5 });
    expect(v.renderer.setPixelRatio).not.toHaveBeenCalled();
    expect(v.renderer.setSize).toHaveBeenLastCalledWith(900, 420, false);
  });
  it('follows a pixel ratio change with no resize on the next frame (a zoom: the canvas box is the same)', () => {
    // opened at 1.36 (1118 css px drawn 1518 wide), then the screen went back to 1 (no window here: 1)
    const v = view({ baseDpr: 1.36, dpr: 1.36, width: 1118, height: 646, slowFrames: 0, fastFrames: 0 });
    BattleRenderer.prototype.adaptResolution.call(v, 1 / 60);
    expect(v.dpr).toBe(1);
    expect(v.renderer.setPixelRatio).toHaveBeenLastCalledWith(1);
    expect(v.renderer.setSize).toHaveBeenLastCalledWith(1118, 646, false);
  });
});
