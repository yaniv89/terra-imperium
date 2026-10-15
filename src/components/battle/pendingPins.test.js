// src/components/battle/pendingPins.test.js
import { describe, expect, it } from 'vitest';
import { pinsFor } from './pendingPins';

describe('pins over orders given while paused (RTS-03)', () => {
  it('one pin a spot, two for a battle line, none for an attack on a squad', () => {
    expect(pinsFor([
      { kind: 'move', x: 1, z: 2, color: '#a3e635' },
      { kind: 'move', x: 3, z: 4, x2: 5, z2: 6, color: '#a3e635' },
      { kind: 'attack', x: 9, z: 9, ringless: true, color: '#ef4444' },
      { kind: 'build', x: 7, z: 8, size: 2, color: '#facc15' }
    ])).toEqual([
      { x: 1, z: 2, color: '#a3e635' }, { x: 3, z: 4, color: '#a3e635' }, { x: 5, z: 6, color: '#a3e635' }, { x: 7, z: 8, color: '#facc15' }
    ]);
    expect(pinsFor()).toEqual([]);
  });
});
