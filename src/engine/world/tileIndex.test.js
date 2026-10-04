// src/engine/world/tileIndex.test.js
import { describe, it, expect } from 'vitest';
import { ownerSlots, noteOwnerCopy, noteOwnerWrite } from './tileIndex';
import { resolveTurn } from '../resolveTurn';
import { createInitialState } from '../../context/GameContext';
import { getTiles } from '../../data/geo/tiles';

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
    let s = { ...createInitialState({ playerNationId: 'au', rngSeed: 7 }), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    const count = getTiles().count;
    for (let t = 0; t < 8; t++) {
      s = resolveTurn(s);
      s = { ...s, activeEventId: null, activeProceduralEvent: null };
      expect(sameAsWalk(s.world.tileOwner, count)).toBe(-1);
    }
  }, 60000);
});
