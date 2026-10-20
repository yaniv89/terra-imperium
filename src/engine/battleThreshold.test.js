import { describe, it, expect } from 'vitest';
import { battleRequired, isSmallOpenTown, SMALL_TOWN_SIZE } from './battleThreshold';
import { AGE_ORDER } from '../data/ages';

const mk = (city, units = {}, battleSettings = {}) => ({
  regions: { t: { id: 't', owner: 'b', size: 2, ...city } },
  nations: { b: { id: 'b' } }, units, battleSettings, playerNationId: 'a'
});
const guard = { g: { id: 'g', regionId: 't', ownerId: 'b', domain: 'land', classId: 'infantry' } };

describe('battleRequired', () => {
  it('a size 2 town with no defense tier needs no battle screen', () => expect(battleRequired(mk({}), 't')).toBe(false));
  it('an outpost needs none, whatever its size', () => expect(battleRequired(mk({ outpost: true, size: 9 }), 't')).toBe(false));
  it('any Defense-line tier opens the card', () => expect(battleRequired(mk({ buildings: { categories: { defense: 0 } } }), 't')).toBe(true));
  it('an army in the town opens the card', () => expect(battleRequired(mk({}, guard), 't')).toBe(true));
  it('a big town opens the card', () => expect(battleRequired(mk({ size: 20 }), 't')).toBe(true));
  it("'ask' opens the card every time", () => expect(battleRequired(mk({}, {}, { smallTowns: 'ask' }), 't')).toBe(true));
  it('the player\'s own small town offers Command by default, Auto when chosen', () => {
    expect(battleRequired(mk({}), 't', { byPlayer: false })).toBe(true);
    expect(battleRequired(mk({}, {}, { smallTownDefense: 'auto' }), 't', { byPlayer: false })).toBe(false);
  });
  it('every age has a small-town size', () => AGE_ORDER.forEach((a) => expect(SMALL_TOWN_SIZE[a]).toBeGreaterThan(0)));
  it('no city means not small', () => expect(isSmallOpenTown({}, null)).toBe(false));
});

it('each measured age limit is below that age median (balance run, seed 11, 300 turns)', () => {
  const median = { bronze: 3, classical: 3, kingdoms: 4, gunpowder: 6 };
  Object.entries(median).forEach(([a, m]) => expect(SMALL_TOWN_SIZE[a]).toBeLessThan(m));
});
