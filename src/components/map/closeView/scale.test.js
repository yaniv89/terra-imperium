// src/components/map/closeView/scale.test.js
import { describe, it, expect } from 'vitest';
import { lightRig, tiltFor } from './scale';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// a model's up and its south face (the side toward the viewer) after the tilt, in screen space
const up = (t) => [0, Math.cos(t), Math.sin(t)];
const south = (t) => [0, -Math.sin(t), Math.cos(t)];

describe('close view lights', () => {
  it('keep the sky above the models at every tilt', () => {
    for (const k of [10, 40, 200]) {
      const t = tiltFor(k);
      expect(dot(lightRig(t).sky, up(t))).toBeCloseTo(1, 6);
    }
  });

  it('light roofs and south faces from the same model-space sun, roofs brighter', () => {
    const lit = [];
    for (const k of [10, 40, 200]) {
      const t = tiltFor(k);
      const { sun } = lightRig(t);
      expect(Math.hypot(...sun)).toBeCloseTo(1, 6);
      expect(dot(sun, south(t))).toBeGreaterThan(0.3);
      expect(dot(sun, up(t))).toBeGreaterThan(dot(sun, south(t)));
      lit.push(dot(sun, south(t)));
    }
    expect(Math.max(...lit) - Math.min(...lit)).toBeLessThan(1e-9); // the tilt does not change it
  });
});
