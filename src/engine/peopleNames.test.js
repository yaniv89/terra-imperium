import { describe, it, expect } from 'vitest';
import { getTiles } from '../data/geo/tiles';
import { pickCityName, generatePeopleCityName } from './cityNames';
import { refreshPeopleNames } from './peopleNames';
import { battleName } from './battleNames';
import { regimentName, ordinal } from '../data/regimentNames';
import { PEOPLES } from '../data/peoples';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { armySheetModel } from '../components/map/armySheetModel';

const tiles = getTiles();
const akkadWorld = () => createInitialState({ playerNationId: 'akkad', rngSeed: 4, scenario: { mode: 'peoples', size: 'small', seed: 4 } });

describe('city names of a people (plans/peoples-and-world-setup.md 4.6)', () => {
  const city = (id, name, owner) => ({ id, name, owner, founderId: owner, tile: 0 });
  it('takes the next unused name of the founder\'s own list, in order', () => {
    const tile = PEOPLES.akkad.tile;
    expect(pickCityName({ a: city('a', 'Kish', 'akkad') }, tiles, tile, 'akkad')).toBe('Agade');
    expect(pickCityName({ a: city('a', 'Kish', 'akkad'), b: city('b', 'Agade', 'akkad') }, tiles, tile, 'akkad')).toBe('Sippar');
    // a name held by a conqueror is skipped (conquest keeps the name)
    expect(pickCityName({ a: city('a', 'Jerusalem', 'israel'), b: city('b', 'Samaria', 'akkad') }, tiles, PEOPLES.israel.tile, 'israel')).toBe('Megiddo');
  });

  it('after its 20 names: a real name from the nearest people not in the world, then made from its own syllables', () => {
    const regions = Object.fromEntries(PEOPLES.akkad.cities.map((n, i) => [`c${i}`, city(`c${i}`, n, 'akkad')]));
    const next = pickCityName(regions, tiles, PEOPLES.akkad.tile, 'akkad');
    const neighbour = Object.values(PEOPLES).find((p) => p.id !== 'akkad' && p.cities.includes(next));
    expect(neighbour, next).toBeDefined();
    expect(neighbour.region).toBe('neareast');
    const made = generatePeopleCityName('akkad', 'x');
    expect(made).toBe(generatePeopleCityName('akkad', 'x'));
    expect(made).toMatch(/^[A-Z][a-z]+$/);
    // fill everything nearby: 300 cities, no repeat, never a numbered name
    const names = new Set(Object.values(regions).map((c) => c.name));
    for (let k = 0; k < 300; k++) {
      const all = Object.fromEntries([...names].map((n, i) => [`x${i}`, city(`x${i}`, n, 'akkad')]));
      const n = pickCityName(all, tiles, PEOPLES.akkad.tile, 'akkad');
      expect(names.has(n), n).toBe(false);
      names.add(n);
    }
  });
});

describe('titles, regiments and battle names in a peoples world', () => {
  it('a nation is renamed by its government; regiments are numbered once per nation and kind', () => {
    let s = akkadWorld();
    const start = Object.values(s.units).find((u) => u.ownerId === 'akkad');
    expect(start.regiment).toBe(1);
    expect(s.nations.akkad.regiments).toEqual({ infantry: 1 });
    s = refreshPeopleNames({ ...s, nations: { ...s.nations, akkad: { ...s.nations.akkad, government: { type: 'monarchy', reforms: {} } } } });
    expect(s.nations.akkad.name).toBe('Kingdom of Akkad');
    const extra = { ...start, id: 'u_new', regiment: undefined };
    s = refreshPeopleNames({ ...s, units: { ...s.units, u_new: extra } });
    expect(s.units.u_new.regiment).toBe(2);
    expect(s.units[start.id].regiment).toBe(1);
    expect(refreshPeopleNames(s)).toBe(s); // nothing to change: the same state
  });

  it('the reducer keeps names current after an action, and leaves a legacy world alone', () => {
    const s = akkadWorld();
    const next = gameReducer(s, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } });
    if (next.nations.akkad.government.type === 'monarchy') expect(next.nations.akkad.name).toBe('Kingdom of Akkad');
    const legacy = createInitialState({ playerNationId: 'fr', rngSeed: 4 });
    expect(refreshPeopleNames(legacy)).toBe(legacy);
    expect(legacy.nations.fr.name).toBe('France');
  });

  it('unit names: the adjective, the unit, the regiment', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
    expect(regimentName({ people: 'akkad' }, { regiment: 3 }, 'Slingers')).toBe('3rd Akkadian Slingers');
    expect(regimentName({ people: 'akkad' }, {}, 'Slingers')).toBe('Akkadian Slingers');
    expect(regimentName({ id: 'fr' }, { regiment: 3 }, 'Slingers')).toBe('Slingers');
    const s = akkadWorld();
    const sheet = armySheetModel(s, s.regions[s.nations.akkad.capitalRegionId].tile);
    expect(sheet.groups[0].units[0].name).toMatch(/^1st Akkadian /);
  });

  it('battles are named after the city or the nearest place', () => {
    const s = akkadWorld();
    const kish = s.nations.akkad.capitalRegionId;
    expect(battleName(s, { kind: 'land', targetRegionId: kish })).toBe('Siege of Kish');
    expect(battleName(s, { kind: 'invasion', targetRegionId: kish })).toBe('Siege of Kish');
    expect(battleName(s, { kind: 'defense', targetRegionId: kish })).toBe('Siege of Kish');
    expect(battleName(s, { kind: 'amphibious', targetRegionId: kish })).toBe('Landing at Kish');
    expect(battleName(s, { kind: 'raid', targetRegionId: kish })).toBe('Raid on Kish');
    expect(battleName(s, { kind: 'sack', targetRegionId: kish })).toBe('Sack of Kish');
    const near = tiles.neighbors[PEOPLES.akkad.tile][0];
    expect(battleName(s, { kind: 'field', tile: near, targetRegionId: kish })).toBe('Battle of Kish');
    expect(battleName(s, { kind: 'naval', tile: near })).toBe('Sea battle off Kish');
  });
});
