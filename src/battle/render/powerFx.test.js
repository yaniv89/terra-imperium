import { describe, it, expect } from 'vitest';
import { POWERS } from '../sim/effects';
import { powerFx } from './powerFx';

const Q = 256;
const sq = (idx, side, x, y, extra = {}) => ({ idx, side, x: x * Q, y: y * Q, alive: true, onField: true, fled: false, classId: 'infantry', ageId: 'bronze', ...extra });
const view = { squads: [sq(0, 0, 10, 10), sq(1, 0, 14, 10), sq(2, 1, 30, 10, { classId: 'cavalry', ageId: 'modern' }), sq(3, 1, 31, 12), sq(4, 0, 12, 12, { classId: 'worker' })] };
const map = { w: 60, h: 40 };

describe('powerFx', () => {
  it('every power of every age shows a ring and a label key', () => {
    Object.keys(POWERS).forEach((id) => {
      const fx = powerFx({ side: 0, power: id, x: 30 * Q, y: 10 * Q }, view, map);
      expect(fx, id).toBeTruthy();
      expect(fx.ring, id).toBeTruthy();
      expect(fx.ring.r, id).toBeGreaterThan(0);
      expect(fx.effect, id).toMatch(/^(rally|strike|hide|emp|jam|recon|hijack)$/);
    });
  });
  it('Rally Cry rings the caller\'s fighters and bursts on each, never on workers', () => {
    const fx = powerFx({ side: 0, power: 'rallyCry', x: 0, y: 0 }, view, map);
    expect(fx.count).toBe(2);
    expect(fx.bursts).toEqual([{ x: 10, z: 10 }, { x: 14, z: 10 }]);
    expect(fx.ring.x).toBe(12);
    expect(fx.ring.r).toBeGreaterThanOrEqual(2);
  });
  it('EMP bursts only on the enemy machines in its radius', () => {
    const fx = powerFx({ side: 0, power: 'emp', x: 30 * Q, y: 10 * Q }, view, map);
    expect(fx.bursts).toEqual([{ x: 30, z: 10 }]);
  });
});
