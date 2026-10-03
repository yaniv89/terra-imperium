// src/components/map/closeView/occupancy.test.js
import { describe, it, expect } from 'vitest';
import { createOccupancy } from './occupancy';

describe('close view occupancy', () => {
  it('lets the first claim win and turns later overlaps away', () => {
    const o = createOccupancy();
    o.claim(0, 0, 10); // a town
    expect(o.take(13, 0, 4)).toBe(false); // a field touching it
    expect(o.take(15, 0, 4)).toBe(true); // just clear of it
    expect(o.take(21, 0, 4)).toBe(false); // on that field
    expect(o.free(100, 100, 5)).toBe(true);
    expect(o.size()).toBe(2);
  });

  it('measures on the ground: screen y is foreshortened by the lean', () => {
    const o = createOccupancy(0.5);
    o.claim(0, 0, 10);
    // 8 px below on screen is 16 px away on the ground
    expect(o.free(0, 8, 5)).toBe(true);
    expect(o.free(0, 6, 5)).toBe(false);
  });
});
