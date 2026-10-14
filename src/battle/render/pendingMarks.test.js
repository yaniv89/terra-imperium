// src/battle/render/pendingMarks.test.js
import { describe, expect, it } from 'vitest';
import { recordPendingMark, livePendingMarks, markPending, MAX_PENDING_MARKS } from './pendingMarks';

describe('pending order marks (RTS-03)', () => {
  it('stay while the sim has not stepped, and go once it has', () => {
    const list = [];
    recordPendingMark(list, { kind: 'move', x: 1, z: 2, squads: [0, 1], tick: 40 });
    expect(livePendingMarks(list, 40)).toHaveLength(1);
    expect(livePendingMarks(list, 41)).toHaveLength(0);
    expect(markPending({ tick: null }, 50)).toBe(true);
  });

  it('a newer order for the same squads replaces the older mark', () => {
    const list = [];
    recordPendingMark(list, { kind: 'move', x: 1, z: 1, squads: [0, 1], tick: 40 });
    recordPendingMark(list, { kind: 'attackMove', x: 5, z: 5, squads: [1], tick: 40 });
    expect(list).toHaveLength(2);
    expect(list[0].squads).toEqual([0]);
    recordPendingMark(list, { kind: 'attack', x: 9, z: 9, squads: [0], tick: 40 });
    expect(list.map((m) => m.kind)).toEqual(['attackMove', 'attack']);
  });

  it('building marks never replace each other, and the list is capped', () => {
    const list = [];
    for (let k = 0; k < MAX_PENDING_MARKS + 5; k++) recordPendingMark(list, { kind: 'build', x: k, z: k, size: 2, tx: k, ty: k, tick: 1 });
    expect(list).toHaveLength(MAX_PENDING_MARKS);
    expect(list[0].x).toBe(5);
  });
});
