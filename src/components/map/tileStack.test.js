import { describe, it, expect } from 'vitest';
import { orderedStack, topUnit, cycleUnit, isCivilian, unitsOnTile, unitAfterTap } from './tileStack';

const u = (id, classId, strength, extra = {}) => ({ id, classId, strength, ownerId: 'me', domain: 'land', ...extra });

describe('one model per tile with several units', () => {
  const stack = [u('c', 'infantry', 40), u('s', 'settler', 10), u('a', 'cavalry', 90), u('b', 'infantry', 90), u('w', 'worker', 5)];
  it('orders soldiers by strength, then id, with civilians last', () => {
    expect(orderedStack(stack).map((x) => x.id)).toEqual(['a', 'b', 'c', 's', 'w']);
    expect(isCivilian(stack[1])).toBe(true);
  });
  it('draws a soldier over a settler even when the settler is stronger', () => {
    const o = orderedStack([u('s', 'settler', 999), u('i', 'infantry', 1)]);
    expect(topUnit(o).id).toBe('i');
  });
  it('draws the selected unit, else the strongest, and exactly one unit', () => {
    const o = orderedStack(stack);
    expect(topUnit(o).id).toBe('a');
    expect(topUnit(o, 'c').id).toBe('c');
    expect(topUnit(o, 'gone').id).toBe('a');
    expect(topUnit([])).toBeNull();
  });
  it('cycles to the next unit on each tap, and back with the previous arrow', () => {
    const o = orderedStack(stack);
    const seen = []; let cur = topUnit(o).id;
    for (let i = 0; i < 6; i++) { seen.push(cur); cur = cycleUnit(o, cur, 1).id; }
    expect(seen).toEqual(['a', 'b', 'c', 's', 'w', 'a']);
    expect(cycleUnit(o, 'a', -1).id).toBe('w');
    expect(cycleUnit(o, 'unknown', 1).id).toBe('a');
    expect(cycleUnit([], 'a')).toBeNull();
  });
  it('finds the tile units of one owner, not embarked', () => {
    const state = { units: { a: u('a', 'infantry', 5, { tile: 7 }), b: u('b', 'infantry', 5, { tile: 7, embarkedOn: 'x' }), c: u('c', 'infantry', 5, { tile: 8 }), d: u('d', 'infantry', 5, { tile: 7, ownerId: 'them' }), e: u('e', 'settler', 0, { tile: 7 }) } };
    expect(unitsOnTile(state, 7, 'me', (x) => x.tile).map((x) => x.id).sort()).toEqual(['a', 'e']);
  });
  it('a tap selects the top unit, the next tap of the same tile the next unit, wrapping round', () => {
    const o = orderedStack([u('a', 'infantry', 90), u('b', 'infantry', 50), u('c', 'cavalry', 10)]);
    let sel = unitAfterTap(o, false, null); const seen = [sel];
    for (let n = 0; n < 3; n++) { sel = unitAfterTap(o, true, sel); seen.push(sel); }
    expect(seen).toEqual(['a', 'b', 'c', 'a']);
    expect(unitAfterTap(o, false, 'c')).toBe('c'); // a first tap keeps a unit already picked on that tile
    expect(unitAfterTap([], true, null)).toBeNull();
  });
});
