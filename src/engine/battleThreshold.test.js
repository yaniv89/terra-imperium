import { describe, it, expect } from 'vitest';
import { battleRequired, isSmallOpenTown, autoSiegeOn, SMALL_TOWN_SIZE } from './battleThreshold';
import { AGE_ORDER } from '../data/ages';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';

const mk = (city, units = {}, battleSettings = {}) => ({
  regions: { t: { id: 't', owner: 'b', size: 2, ...city } },
  nations: { b: { id: 'b' } }, units, battleSettings, playerNationId: 'a'
});
const guard = { g: { id: 'g', regionId: 't', ownerId: 'b', domain: 'land', classId: 'infantry' } };

describe('battleRequired', () => {
  it('a capital always opens the card, even a small unwalled one', () => expect(battleRequired(mk({ isCapital: true }), 't')).toBe(true));
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

it('each measured age limit is at most that age median (balance run, seed 11, 300 turns)', () => {
  const median = { bronze: 3, classical: 3, kingdoms: 4, gunpowder: 6 };
  Object.entries(median).forEach(([a, m]) => expect(SMALL_TOWN_SIZE[a]).toBeLessThanOrEqual(m));
});

describe('Auto until the siege ends', () => {
  const sieged = (autoSieges) => ({ ...mk({ size: 20, siege: { hp: 50, maxHp: 100, by: 'a', startedTurn: 4 } }, guard), autoSieges });
  it('skips the card for that siege only, whatever the size or garrison', () => {
    expect(battleRequired(sieged(undefined), 't')).toBe(true);
    expect(battleRequired(sieged({ t: 4 }), 't')).toBe(false);
    expect(autoSiegeOn(sieged({ t: 4 }), 't')).toBe(true);
  });
  it('a later siege of the same city asks again', () => expect(battleRequired(sieged({ t: 2 }), 't')).toBe(true));
  it('a siege that ended no longer counts', () => expect(autoSiegeOn({ ...mk({ siege: null }), autoSieges: { t: 4 } }, 't')).toBe(false));
});

it('SET_AUTO_SIEGE arms only a city under siege, and off clears it', () => {
  const s = { ...mk({ siege: { hp: 50, startedTurn: 4 } }) };
  const on = gameReducer(s, { type: ActionTypes.SET_AUTO_SIEGE, payload: { regionId: 't', on: true } });
  expect(on.autoSieges).toEqual({ t: 4 });
  expect(gameReducer(on, { type: ActionTypes.SET_AUTO_SIEGE, payload: { regionId: 't', on: false } }).autoSieges).toEqual({});
  expect(gameReducer(mk({}), { type: ActionTypes.SET_AUTO_SIEGE, payload: { regionId: 't', on: true } }).autoSieges).toBeUndefined();
});
