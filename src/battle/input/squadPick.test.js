// src/battle/input/squadPick.test.js
// CB20 I218 / X30: the tap area of a squad (input only, true-scale soldiers).
import { describe, it, expect } from 'vitest';
import { pickSquadAt, squadPickCircle, SQUAD_PICK_PX } from './squadPick';

const Q = 256;
const sq = (idx, side, tx, ty, extra = {}) => ({ idx, side, x: tx * Q, y: ty * Q, alive: true, onField: true, fled: false, inside: -1, ...extra });
const view = (squads) => ({ playerSide: 0, squads });

describe('squad picking (I218)', () => {
  it('never shrinks below a finger on screen when zoomed out', () => {
    const v = view([sq(0, 0, 10, 10)]);
    // 0.2 tiles per css px: 22 px is 4.4 tiles
    expect(pickSquadAt({ x: 13.5, z: 10 }, v, { wpp: 0.2 })).toMatchObject({ idx: 0 });
    expect(pickSquadAt({ x: 15, z: 10 }, v, { wpp: 0.2 })).toBeNull();
    // near zoom: the ground radius (1.1 tiles) rules
    expect(pickSquadAt({ x: 11.5, z: 10 }, v, { wpp: 0.01 })).toBeNull();
    expect(SQUAD_PICK_PX * 2).toBeGreaterThanOrEqual(44);
  });

  it('a tap on the rear ranks of a deep block picks it (the block runs back from the point)', () => {
    // facing +x: the ranks stand behind, toward -x; 6 rows 0.8 apart
    const memo = { x: 20, z: 10, fx: 1, fz: 0, n: 24, cols: 4, rowGap: 0.8, spacing: 0.7 };
    const c = squadPickCircle(sq(0, 0, 20, 10), memo, 1.1);
    expect(c.cx).toBeCloseTo(18);
    expect(pickSquadAt({ x: 16.2, z: 10 }, view([sq(0, 0, 20, 10)]), { memoOf: () => memo, wpp: 0.01 })).toMatchObject({ idx: 0 });
    expect(pickSquadAt({ x: 16.2, z: 10 }, view([sq(0, 0, 20, 10)]), { wpp: 0.01 })).toBeNull();
  });

  it('a machine crew is picked by the drawn ring, not only its point', () => {
    const memo = { x: 30, z: 10, fx: 0, fz: 1, n: 2, cols: 2, rowGap: 2, spacing: 3, ring: 2.6 };
    expect(pickSquadAt({ x: 32.2, z: 10 }, view([sq(0, 0, 30, 10)]), { memoOf: () => memo, wpp: 0.01 })).toMatchObject({ idx: 0 });
  });

  it('keeps the old rules: enemyFirst, ignoreOwn, fog, garrisoned', () => {
    const v = view([sq(0, 0, 10, 10), sq(1, 1, 10.6, 10)]);
    expect(pickSquadAt({ x: 10, z: 10 }, v, { wpp: 0.01 })).toMatchObject({ idx: 0 });
    expect(pickSquadAt({ x: 10, z: 10 }, v, { wpp: 0.01, enemyFirst: true })).toMatchObject({ idx: 1 });
    expect(pickSquadAt({ x: 10, z: 10 }, v, { wpp: 0.01, ignoreOwn: true })).toMatchObject({ idx: 1 });
    const fogged = view([sq(1, 1, 10.6, 10, { visible: false }), sq(2, 1, 10, 10, { inside: 3 })]);
    expect(pickSquadAt({ x: 10, z: 10 }, fogged, { wpp: 0.01 })).toBeNull();
  });

  it('between two squads the nearer one, relative to its size, wins', () => {
    const v = view([sq(0, 0, 10, 10), sq(1, 0, 12, 10)]);
    expect(pickSquadAt({ x: 10.8, z: 10 }, v, { wpp: 0.1 })).toMatchObject({ idx: 0 });
    expect(pickSquadAt({ x: 11.2, z: 10 }, v, { wpp: 0.1 })).toMatchObject({ idx: 1 });
  });

  it('a ship is picked along its hull, a soldier block is not', () => {
    const v = view([sq(0, 0, 10, 10, { classId: 'naval' }), sq(1, 0, 20, 10)]);
    expect(pickSquadAt({ x: 12, z: 10 }, v, { wpp: 0.01 })).toMatchObject({ idx: 0 });
    expect(pickSquadAt({ x: 22, z: 10 }, v, { wpp: 0.01 })).toBeNull();
  });
});
