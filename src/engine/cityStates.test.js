// City-states, decision 42 (X25): two tiers of peoples, fewer city-states, the start gap, the
// raider cap, the types and the patron bonus.
import { describe, it, expect } from 'vitest';
import { PEOPLES, MAJOR_PEOPLES_LIST, CITY_STATE_PEOPLES_LIST, MAJOR_TIER, PEOPLE_REGIONS } from '../data/peoples';
import { WORLD_SIZE_IDS, START_MIN_GAP_KM, cityStateCount, CITY_STATE_SHIFT_KM } from '../data/worldSizes';
import { capRaiders, cityStateTypeOf, patronBonusOf, CITY_STATE_TYPES, PATRON_OPINION } from '../data/cityStates';
import { distanceKm } from '../data/geo/geodesic';
import { getTiles } from '../data/geo/tiles';
import { pickMajors } from './worldgen/peoplesWorld';
import { placeCityStatesOnEarth, independentIdsOf } from './independents';
import { createInitialState } from './gameReducer';
import { processPatrons, choosePatron } from './cityStates';
import { thinksOn } from './raids';

const tiles = getTiles();
const startTile = (sites, id) => sites[id] ?? PEOPLES[id].tile;

describe('two tiers of peoples', () => {
  it('has 50 majors spread over every region and 100 city-state peoples', () => {
    expect(MAJOR_PEOPLES_LIST).toHaveLength(50);
    expect(CITY_STATE_PEOPLES_LIST).toHaveLength(100);
    Object.keys(PEOPLE_REGIONS).forEach((r) => expect(MAJOR_TIER[r]?.length || 0).toBeGreaterThan(0));
    Object.values(MAJOR_TIER).flat().forEach((id) => { expect(PEOPLES[id]).toBeTruthy(); expect(PEOPLES[id].arrives).toBeUndefined(); });
    ['akkad', 'kemet', 'israel'].forEach((id) => expect(PEOPLES[id].major).toBe(true));
  });
});

describe('a world on the real Earth', () => {
  WORLD_SIZE_IDS.forEach((size) => {
    it(`${size}: majors from the major tier, city-states near the target, every start ${START_MIN_GAP_KM} km apart`, () => {
      [1, 2, 3].forEach((seed) => {
        const majors = pickMajors('akkad', size, seed, { tiles });
        majors.slice(1).forEach((id) => expect(PEOPLES[id].major).toBe(true));
        const cs = placeCityStatesOnEarth(majors, size, seed, { tiles });
        cs.ids.forEach((id) => expect(PEOPLES[id].major).toBe(false));
        expect(cs.ids.length).toBeLessThanOrEqual(cityStateCount(size));
        expect(cs.ids.length).toBeGreaterThanOrEqual(Math.floor(cityStateCount(size) * 0.75));
        const all = [...majors.map((id) => PEOPLES[id].tile), ...cs.ids.map((id) => startTile(cs.sites, id))];
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(distanceKm(tiles.centres[all[i]], tiles.centres[all[j]])).toBeGreaterThanOrEqual(START_MIN_GAP_KM);
        Object.entries(cs.sites).forEach(([id, t]) => expect(distanceKm(tiles.centres[t], tiles.centres[PEOPLES[id].tile])).toBeLessThanOrEqual(CITY_STATE_SHIFT_KM));
      });
    });
  });
  it('Few < Normal < Many', () => {
    const majors = pickMajors('akkad', 'standard', 5, { tiles });
    const n = (density) => placeCityStatesOnEarth(majors, 'standard', 5, { tiles, density }).ids.length;
    expect(n('few')).toBeLessThan(n('normal'));
    expect(n('normal')).toBeLessThan(n('many'));
  });
});

describe('raiders and types', () => {
  it('caps raiders at a third', () => {
    const p = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, i < 9 ? 'raiders' : 'mercantile']));
    const out = capRaiders(p);
    expect(Object.values(out).filter((x) => x === 'raiders')).toHaveLength(4);
    expect(capRaiders(out)).toBe(out);
  });
  it('maps personalities to types', () => {
    const t = (personality, id = 'x') => cityStateTypeOf({ id, kind: 'independent', indep: { personality } });
    expect(t('raiders')).toBe('raiders'); expect(t('mercantile')).toBe('trade'); expect(t('fortress')).toBe('military');
    expect(['science', 'culture']).toContain(t('tribal'));
    expect(cityStateTypeOf({ id: 'akkad' })).toBeNull();
    expect(patronBonusOf('raiders')).toEqual({});
    Object.keys(CITY_STATE_TYPES).filter((k) => k !== 'raiders').forEach((k) => expect(Object.values(patronBonusOf(k, 'classical'))[0]).toBeGreaterThan(0));
  });
});

describe('a new game', () => {
  const state = createInitialState({ playerNationId: 'akkad', rngSeed: 7, scenario: { mode: 'peoples', size: 'standard', seed: 7 }, fog: false });
  const indeps = independentIdsOf(state);
  it('starts with the Normal count, a third raiders at most, and saves the setting', () => {
    expect(indeps.length).toBeGreaterThanOrEqual(30);
    expect(indeps.length).toBeLessThanOrEqual(45);
    expect(indeps.filter((id) => state.nations[id].indep.personality === 'raiders').length).toBeLessThanOrEqual(Math.round(indeps.length / 3));
    expect(state.scenario.cityStates).toBe('normal');
    const few = createInitialState({ playerNationId: 'akkad', rngSeed: 7, scenario: { mode: 'peoples', size: 'standard', seed: 7, cityStates: 'few' }, fog: false });
    expect(independentIdsOf(few).length).toBeLessThan(indeps.length);
  });
  it('a liked major becomes the patron and gets the bonus every turn', () => {
    const id = indeps.find((x) => cityStateTypeOf(state.nations[x]) === 'trade') || indeps.find((x) => cityStateTypeOf(state.nations[x]) !== 'raiders');
    const n = state.nations[id];
    const city = state.regions[n.capitalRegionId];
    const majorCities = [{ owner: 'akkad', centre: tiles.centres[city.tile] }];
    // Favour buys the attitude: at FAVOUR_MAX the player is liked.
    const liked = { ...state, nations: { ...state.nations, [id]: { ...n, indep: { ...n.indep, favour: { akkad: 50 } } } } };
    expect(choosePatron(liked, id, majorCities)).toBe('akkad');
    const w = { turn: 1, year: state.year, age: state.age, playerId: 'akkad', nations: { ...liked.nations, [id]: { ...liked.nations[id], indep: { ...liked.nations[id].indep, patron: 'akkad' } } }, resources: { ...state.resources }, regions: state.regions, logs: [], stats: {} };
    w.view = { ...liked, nations: w.nations };
    // A turn it does not think on: the kept patron is paid.
    while (thinksOn(id, w.turn)) w.turn += 1;
    const before = { gold: w.resources.gold, hr: w.resources.hr, techPoints: w.resources.techPoints, prestige: w.nations.akkad.prestige || 0 };
    processPatrons(w, [id]);
    const b = patronBonusOf(cityStateTypeOf(w.nations[id]), state.age);
    expect(w.nations[id].indep.patron).toBe('akkad');
    {
      expect((w.resources.gold - before.gold) + (w.resources.hr - before.hr) + (w.resources.techPoints - before.techPoints) + ((w.nations.akkad.prestige || 0) - before.prestige)).toBe(Object.values(b)[0]);
      expect(w.stats.patrons).toBe(1);
    }
    expect(PATRON_OPINION).toBeGreaterThan(0);
  });
});
