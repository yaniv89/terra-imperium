import { describe, it, expect } from 'vitest';
import { zonePerimeter, ZONE_DOT_STEP } from './deployZone';

describe('deployment zone outline', () => {
  it('lists dots along the four edges of the zone and nothing for no zone', () => {
    expect(zonePerimeter(null)).toEqual([]);
    const dots = zonePerimeter({ x0: 1, y0: 2, x1: 4, y1: 5 }, 1);
    const xs = dots.map((d) => d.x); const zs = dots.map((d) => d.z);
    expect(Math.min(...xs)).toBe(1); expect(Math.max(...xs)).toBe(5); expect(Math.min(...zs)).toBe(2); expect(Math.max(...zs)).toBe(6);
    expect(dots.every((d) => d.x === 1 || d.x === 5 || d.z === 2 || d.z === 6)).toBe(true);
    expect(new Set(dots.map((d) => `${d.x},${d.z}`)).size).toBe(dots.length);
    expect(zonePerimeter({ x0: 0, y0: 0, x1: 9, y1: 9 }).length).toBeGreaterThan(zonePerimeter({ x0: 0, y0: 0, x1: 9, y1: 9 }, 1).length);
    expect(ZONE_DOT_STEP).toBeLessThanOrEqual(1);
  });
});
