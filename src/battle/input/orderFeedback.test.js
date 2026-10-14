// src/battle/input/orderFeedback.test.js
import { describe, it, expect } from 'vitest';
import { pickStructureAt, arrivalNote } from './orderFeedback';

const Q = 256;
const W = 20; // map width in tiles
const tile = (x, y) => y * W + x;

describe('pickStructureAt (I189, I190)', () => {
  // A long wall along x = 5..14 on row 10: its hit circle used to cover open ground 3 tiles away.
  const wall = { alive: true, x: 10 * Q, y: 10 * Q + 128, radius: Math.round(4.5 * Q) };
  const fixedWall = { footprint: Array.from({ length: 10 }, (_, i) => tile(5 + i, 10)) };
  const tower = { alive: true, x: 3 * Q, y: 3 * Q, radius: Math.round(0.8 * Q) };

  it('a wall is hit on its own tiles, not on the open ground beside it', () => {
    expect(pickStructureAt({ x: 8.5, z: 10.5 }, [wall], [fixedWall], W)).toEqual({ kind: 'structure', index: 0 });
    expect(pickStructureAt({ x: 8.5, z: 10.5 + 0.8 }, [wall], [fixedWall], W)).toEqual({ kind: 'structure', index: 0 }); // within the margin
    expect(pickStructureAt({ x: 8.5, z: 13 }, [wall], [fixedWall], W)).toBeNull();
  });

  it('a structure without tiles of its own is hit by its circle; a fallen one never', () => {
    expect(pickStructureAt({ x: 3.5, z: 3 }, [tower], [{}], W)).toEqual({ kind: 'structure', index: 0 });
    expect(pickStructureAt({ x: 3.5, z: 3 }, [{ ...tower, alive: false }], [{}], W)).toBeNull();
  });

  it('the nearest of two wins', () => {
    const near = { alive: true, x: 4 * Q, y: 3 * Q, radius: Q };
    expect(pickStructureAt({ x: 4, z: 3 }, [tower, near], [{}, {}], W)).toEqual({ kind: 'structure', index: 1 });
  });
});

describe('arrivalNote (I192, X13)', () => {
  it('warns when cavalry marches with slower squads', () => {
    expect(arrivalNote(['infantry', 'cavalry'], 'attack')).toMatch(/Cavalry will arrive first/);
    expect(arrivalNote(['siege', 'cavalry'], 'attackMove')).toMatch(/siege engines/);
    expect(arrivalNote(['ranged', 'cavalry'], 'move')).toMatch(/own speed/);
  });
  it('says nothing for one speed or for other orders', () => {
    expect(arrivalNote(['cavalry', 'cavalry'], 'attack')).toBeNull();
    expect(arrivalNote(['infantry', 'ranged'], 'attack')).toBeNull();
    expect(arrivalNote(['infantry', 'cavalry'], 'hold')).toBeNull();
    [arrivalNote(['infantry', 'cavalry'], 'attack'), arrivalNote(['infantry', 'cavalry'], 'move')].forEach((t) => expect(t).not.toMatch(/—/));
  });
});
