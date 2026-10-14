// src/components/battle/minimapModel.test.js
// I196: the minimap is the field turned the way the camera looks, fits its box, and a tap on it
// lands where the mark for that ground is drawn.
import { describe, expect, it } from 'vitest';
import { minimapFrame } from './minimapModel';

describe('minimapFrame', () => {
  const f = minimapFrame(120, 80, 168, 104);
  it('fits the box and keeps every corner of the field inside it', () => {
    expect(f.width).toBeLessThanOrEqual(168);
    expect(f.height).toBeLessThanOrEqual(104);
    [[0, 0], [120, 0], [0, 80], [120, 80]].forEach(([x, z]) => {
      const p = f.toMini(x, z);
      expect(p.x).toBeGreaterThanOrEqual(-0.01); expect(p.x).toBeLessThanOrEqual(f.width + 0.01);
      expect(p.y).toBeGreaterThanOrEqual(-0.01); expect(p.y).toBeLessThanOrEqual(f.height + 0.01);
    });
  });
  it('turns like the camera: screen right is +x -z, screen down is +x +z', () => {
    const o = f.toMini(60, 40);
    expect(f.toMini(61, 39).x).toBeGreaterThan(o.x);
    expect(Math.abs(f.toMini(61, 39).y - o.y)).toBeLessThan(1e-9);
    expect(f.toMini(61, 41).y).toBeGreaterThan(o.y);
  });
  it('a tap maps back to the ground drawn there, clamped to the field', () => {
    const p = f.toMini(37, 21);
    const g = f.toWorld(p.x, p.y);
    expect(g.x).toBeCloseTo(37, 6); expect(g.z).toBeCloseTo(21, 6);
    const out = f.toWorld(-50, -50);
    expect(out.x).toBeGreaterThanOrEqual(0); expect(out.z).toBeGreaterThanOrEqual(0);
    expect(out.x).toBeLessThanOrEqual(120); expect(out.z).toBeLessThanOrEqual(80);
  });
  it('the canvas transform draws tile (x, z) where toMini puts it', () => {
    const [a, b, c, d, e, g] = f.transform;
    const x = 50; const z = 30;
    const p = f.toMini(x, z);
    expect(a * x + c * z + e).toBeCloseTo(p.x, 6);
    expect(b * x + d * z + g).toBeCloseTo(p.y, 6);
  });
});
