import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { turnBlockers } from './turnBlockers';
import { keepBuilding, setKeep } from './productionAdvisor';
import { processCity, emptyWorld } from './world/cities';
import { getTiles } from '../data/geo/tiles';
import { peoplesWorld } from './testWorld';

const EMPTY = { current: null, queue: [], progress: 0 };
const idleGame = () => {
  const S = peoplesWorld({ seed: 7 });
  const me = S.playerNationId;
  const regions = Object.fromEntries(Object.entries(S.regions).map(([id, c]) => [id, c.owner === me ? { ...c, production: EMPTY } : c]));
  return { ...S, regions, activeEventId: null, activeProceduralEvent: null, pendingPeaceOffer: null, pendingDefenses: [], pendingDemand: null, tributeDemands: [], joinOffers: [], pendingBattle: null };
};
const myCity = (S) => Object.values(S.regions).find((c) => c.owner === S.playerNationId && !c.outpost);

describe('keep building (standing orders)', () => {
  it('setKeep sets, clears and ignores an unknown mode', () => {
    const c = { production: EMPTY };
    expect(setKeep(c, 'repeat').production.keep).toBe('repeat');
    expect('keep' in setKeep(setKeep(c, 'repeat'), null).production).toBe(false);
    expect(setKeep(c, 'bogus')).toBe(c);
  });

  it('an advisor order fills the idle city at once and clears End Turn', () => {
    const S = idleGame();
    const city = myCity(S);
    expect(turnBlockers(S).some((b) => b.kind === 'city' && b.target.regionId === city.id)).toBe(true);
    const next = gameReducer(S, { type: ActionTypes.SET_PRODUCTION_KEEP, payload: { cityId: city.id, keep: 'advisor' } });
    expect(next.regions[city.id].production.keep).toBe('advisor');
    expect(next.regions[city.id].production.current).toBeTruthy();
    expect(turnBlockers(next).some((b) => b.target?.regionId === city.id)).toBe(false);
  });

  it('keepBuilding leaves cities without an order alone (same state)', () => {
    const S = idleGame();
    expect(keepBuilding(S)).toBe(S);
  });

  it('a repeat order trains the same unit again when the queue runs dry', () => {
    const S = idleGame();
    const city = myCity(S);
    const unit = { kind: 'unit', classId: 'infantry' };
    const c = { ...city, production: { current: unit, queue: [], progress: 9999, keep: 'repeat' } };
    const world = { ...emptyWorld(), cities: { [c.id]: c }, tileOwner: S.world.tileOwner, tileState: S.world.tileState };
    const r = processCity(world, getTiles(), c, { ageId: 'stone' });
    expect(r.completed.filter((i) => i.kind === 'unit').length).toBeGreaterThanOrEqual(1);
    expect(r.city.production.current).toMatchObject(unit);
    expect(r.city.production.keep).toBe('repeat');
    const once = processCity(world, getTiles(), { ...c, production: { ...c.production, keep: undefined, progress: 50 } }, { ageId: 'stone' });
    expect(once.city.production.current).toBeNull();
  });

  it('refuses a city that is not the player\'s', () => {
    const S = idleGame();
    const other = Object.values(S.regions).find((c) => c.owner && c.owner !== S.playerNationId);
    const next = gameReducer(S, { type: ActionTypes.SET_PRODUCTION_KEEP, payload: { cityId: other.id, keep: 'repeat' } });
    expect(next.regions[other.id].production?.keep).toBeUndefined();
  });
});
