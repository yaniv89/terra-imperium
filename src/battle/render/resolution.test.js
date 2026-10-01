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
