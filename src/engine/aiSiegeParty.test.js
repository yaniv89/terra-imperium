import { describe, it, expect } from 'vitest';
import { siegeParty } from './aiOperations';

// CB09 I120: a stack that only touches an enemy city from its own city marches out to lay siege,
// leaving its weakest unit at home.
describe('siegeParty', () => {
  const state = { regions: { home: { id: 'home', owner: 'k', tile: 10 }, field: { id: 'field', owner: 'k', tile: 99 } } };
  const u = (id, strength) => ({ id, ownerId: 'k', strength });

  it('leaves the weakest unit as the garrison of its own city', () => {
    const stack = [u('a', 900), u('b', 400), u('c', 1000)];
    expect(siegeParty(state, stack, 10, 'home').map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('a lone garrison stays home', () => {
    expect(siegeParty(state, [u('a', 900)], 10, 'home')).toEqual([]);
  });

  it('a stack in the field goes whole', () => {
    const stack = [u('a', 900), u('b', 400)];
    expect(siegeParty(state, stack, 55, 'home')).toBe(stack);
  });
});
