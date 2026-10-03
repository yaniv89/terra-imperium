// src/components/map/closeView/groundBlend.test.js
import { describe, it, expect } from 'vitest';
import { isLandAt, maskFromRgba, sampleLandColour, groundTint, tintKey } from './groundBlend';

// a 4 x 2 world: the western half land, the eastern half sea
const W = 4; const H = 2;
const rgba = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2) rgba[(y * W + x) * 4 + 3] = 255;
const mask = maskFromRgba(rgba, W, H);

describe('ground blend', () => {
  it('tells land from sea, and allows everything until the mask is in', () => {
    expect(isLandAt(mask, 10, -100)).toBe(true);
    expect(isLandAt(mask, 10, 100)).toBe(false);
    expect(isLandAt(null, 10, 100)).toBe(true);
  });

  it('averages only the land pixels of the world picture', () => {
    const pic = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { const land = i % W < 2; pic.set(land ? [100, 150, 50, 255] : [0, 0, 255, 255], i * 4); }
    const c = sampleLandColour({ w: W, h: H, rgba: pic }, mask, 10, -45, 2);
    expect(c.map((v) => Math.round(v * 255))).toEqual([100, 150, 50]);
    expect(sampleLandColour(null, mask, 0, 0)).toBeNull();
  });

  it('turns a land colour into a bounded, quantised ground multiplier', () => {
    const green = groundTint([0.35, 0.5, 0.25]);
    expect(green[1]).toBeGreaterThan(green[0]); // greener than the authored earth
    groundTint([0, 0, 0]).forEach((c) => expect(c).toBeGreaterThanOrEqual(0.55)); // never black
    groundTint([1, 1, 1]).forEach((c) => expect(c).toBeLessThanOrEqual(1.4));
    expect(groundTint(null)).toBeNull();
    expect(tintKey(null)).toBe('');
  });
});
