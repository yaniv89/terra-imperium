// src/engine/world/tileIndex.test.js
import { describe, it, expect } from 'vitest';
import { ownerSlots, noteOwnerCopy, noteOwnerWrite, copyTileMap, reviveTileMaps } from './tileIndex';
import { resolveTurn } from '../resolveTurn';
import { getTiles } from '../../data/geo/tiles';
import { peoplesWorld } from '../testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).

const ownerAt = (idx, t) => (idx.slot[t] < 0 ? null : idx.ids[idx.slot[t]]);
const sameAsWalk = (map, count) => {
  const derived = ownerSlots(map, count);
  const walked = ownerSlots({ ...map }, count); // a spread has no history: indexed by a walk
  for (let t = 0; t < count; t++) if (ownerAt(derived, t) !== ownerAt(walked, t)) return t;
  return -1;
};

describe('tile owner index', () => {
  it('indexes a plain map', () => {
    const idx = ownerSlots({ 3: 'a', 5: 'b', 7: 'a' }, 10);
    expect([0, 3, 5, 7].map((t) => ownerAt(idx, t))).toEqual([null, 'a', 'b', 'a']);
  });

  it('derives a copy from its base plus the recorded writes', () => {
    const base = { 1: 'a', 2: 'a' };
    ownerSlots(base, 8);
    const copy = { ...base }; noteOwnerCopy(base, copy);
    copy[2] = 'b'; noteOwnerWrite(copy, 2);
    copy[6] = 'c'; noteOwnerWrite(copy, 6);
    expect(sameAsWalk(copy, 8)).toBe(-1);
    expect(ownerAt(ownerSlots(base, 8), 2)).toBe('a'); // the base is untouched
    copy[1] = 'c'; noteOwnerWrite(copy, 1); // a write after the index was built is applied lazily
    expect(ownerAt(ownerSlots(copy, 8), 1)).toBe('c');
  });

  it('matches a fresh walk on every turn of a real game', () => {
    let s = { ...peoplesWorld({ seed: 7 }), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    const count = getTiles().count;
    for (let t = 0; t < 8; t++) {
      s = resolveTurn(s);
      s = { ...s, activeEventId: null, activeProceduralEvent: null };
      expect(sameAsWalk(s.world.tileOwner, count)).toBe(-1);
    }
  }, 60000);
});

describe('tile map copies', () => {
  it('read, enumerate and save like the object they copy', () => {
    const map = { 9: 'b', 2: 'a', 40: 'c' };
    const copy = copyTileMap(map, 50);
    copy[7] = 'd'; delete copy[40];
    const plain = { ...map, 7: 'd' }; delete plain[40];
    expect(Array.isArray(copy)).toBe(true);
    expect(Object.keys(copy)).toEqual(Object.keys(plain));
    expect(Object.entries(copyTileMap(copy, 50))).toEqual(Object.entries(plain));
    expect(copy[3]).toBeUndefined();
    expect(JSON.stringify({ m: copy })).toBe(JSON.stringify({ m: plain }));
    expect(copyTileMap({ 1: 'a', x: 'b' }, 50)).toEqual({ 1: 'a', x: 'b' }); // not a tile map: stays an object
    const cloned = reviveTileMaps(structuredClone({ world: { tileOwner: copy } }));
    expect(JSON.stringify(cloned.world.tileOwner)).toBe(JSON.stringify(plain));
  });
});
