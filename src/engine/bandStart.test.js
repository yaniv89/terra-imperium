// The Stone Age opening (eight-ages plan U23): a new game's majors start as a band with no city.
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes, GameStatus } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { ringDistance } from './world/cities';
import { BAND_RANGE_KM, bandsOf, canFoundVillage } from './settlers';
import { majorIds } from './testWorld';
import { auditGameState } from './stateAudit';

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const fresh = () => quiet(createInitialState({ playerNationId: 'akkad', rngSeed: 7, scenario: { mode: 'peoples', size: 'small', seed: 7, band: true } }));
const citiesOf = (s, id) => Object.values(s.regions).filter((c) => c.owner === id);

describe('band start (U23)', () => {
  it('starts every major as a band and Hunters with no city, and the state is sound', () => {
    const s = fresh();
    majorIds(s).forEach((id) => {
      expect(citiesOf(s, id), id).toHaveLength(0);
      expect(bandsOf(s.units, id), id).toHaveLength(1);
      expect(Object.values(s.units).some((u) => u.ownerId === id && u.classId === 'ranged'), id).toBe(true);
    });
    expect(s.techAgeId).toBe('stone');
    expect(auditGameState(s).filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('AI bands found on turn 1; the player who waits stays in the game, then founds on the home tile', () => {
    const s = fresh();
    const me = s.playerNationId;
    const t1 = resolveTurn(s);
    expect(t1.gameStatus).toBe(GameStatus.ACTIVE);
    majorIds(t1).filter((id) => id !== me).forEach((id) => expect(citiesOf(t1, id).length, id).toBe(1));
    expect(citiesOf(t1, me)).toHaveLength(0);
    const band = bandsOf(t1.units, me)[0];
    const founded = gameReducer(t1, { type: ActionTypes.FOUND_CITY, payload: { unitId: band.id } });
    const [city] = citiesOf(founded, me);
    expect(city.tile).toBe(band.band.home);
    expect(city.size).toBe(band.band.size);
    expect(founded.nations[me].capitalRegionId).toBe(city.id);
    expect(bandsOf(founded.units, me)).toHaveLength(0);
    expect(Object.values(founded.units).filter((u) => u.ownerId === me).every((u) => u.regionId === city.id)).toBe(true);
  });

  it(`refuses a village beyond ${BAND_RANGE_KM} km of home`, () => {
    const s = fresh();
    const band = bandsOf(s.units, s.playerNationId)[0];
    const tiles = getTiles();
    const far = Object.keys(tiles.land).map(Number).find((t) => tiles.land[t] && ringDistance(tiles, band.band.home, t, ringsForKm(BAND_RANGE_KM)) === Infinity);
    expect(canFoundVillage(s, band, far).ok).toBe(false);
  });

  it('a nation whose band dies before founding is eliminated', () => {
    const s = fresh();
    const ai = majorIds(s).find((id) => id !== s.playerNationId);
    const units = Object.fromEntries(Object.entries(s.units).filter(([, u]) => u.ownerId !== ai));
    const next = resolveTurn({ ...s, units });
    expect(next.nations[ai].isEliminated).toBe(true);
  });
});
