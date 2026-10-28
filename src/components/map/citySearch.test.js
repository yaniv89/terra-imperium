// Find a city by name on the map (newcomer rerun 245 to 246).
import { describe, expect, it } from 'vitest';
import { findCities } from './citySearch';

const state = {
  playerNationId: 'israel',
  regions: {
    a: { id: 'a', name: 'Shechem', tile: 1, owner: 'israel' },
    b: { id: 'b', name: 'Beersheba', tile: 2, owner: 'israel' },
    c: { id: 'c', name: 'Damascus', tile: 3, owner: 'aram' },
    d: { id: 'd', name: 'Nowhere', tile: null, owner: 'aram' }
  }
};

describe('findCities', () => {
  it('names that start with the query come first, then the others by name', () => {
    expect(findCities(state, 'she').map((c) => c.name)).toEqual(['Shechem', 'Beersheba']);
  });
  it('marks your own cities and skips a city with no tile', () => {
    expect(findCities(state, 'da')).toEqual([{ id: 'c', name: 'Damascus', mine: false }]);
    expect(findCities(state, 'nowhere')).toEqual([]);
  });
  it('an empty query finds nothing', () => {
    expect(findCities(state, '  ')).toEqual([]);
  });
});
