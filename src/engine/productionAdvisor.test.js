import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { turnBlockers } from './turnBlockers';
import { advisorPicks, advisorPick } from './productionAdvisor';
import { peoplesWorld, addCities } from './testWorld';

const EMPTY = { current: null, queue: [], progress: 0 };

// The player's cities all idle, nothing else to answer.
const idleGame = (extra = 0) => {
  let S = peoplesWorld({ seed: 7 });
  if (extra) S = addCities(S, S.playerNationId, extra).state;
  const me = S.playerNationId;
  const regions = Object.fromEntries(Object.entries(S.regions).map(([id, c]) => [id, c.owner === me ? { ...c, production: EMPTY } : c]));
  return { ...S, regions, research: { ...S.research, current: 'science_cuneiform_records', queue: [], auto: false }, activeEventId: null, activeProceduralEvent: null, pendingPeaceOffer: null, pendingDefenses: [], pendingDemand: null, tributeDemands: [], joinOffers: [], pendingBattle: null };
};

describe('production advisor', () => {
  it('one action fills every idle city, and End Turn is free again', () => {
    const S = idleGame(2);
    const idle = turnBlockers(S).filter((b) => b.kind === 'city');
    expect(idle.length).toBeGreaterThanOrEqual(2);
    const picks = advisorPicks(S);
    expect(picks.map((p) => p.cityId)).toEqual(idle.map((b) => b.target.regionId));
    const next = gameReducer(S, { type: ActionTypes.ADVISOR_PRODUCTION });
    expect(turnBlockers(next).filter((b) => b.kind === 'city')).toEqual([]);
    picks.forEach((p) => expect(next.regions[p.cityId].production.current).toMatchObject({ kind: p.item.kind }));
  });

  it('is deterministic and picks at most one settler at a time', () => {
    const S = idleGame(3);
    expect(advisorPicks(S)).toEqual(advisorPicks(S));
    expect(advisorPicks(S).filter((p) => p.item.kind === 'settler').length).toBeLessThanOrEqual(1);
  });

  it('a city id fills that city only; a busy city is left alone', () => {
    const S = idleGame(1);
    const [a, b] = advisorPicks(S).map((p) => p.cityId);
    const next = gameReducer(S, { type: ActionTypes.ADVISOR_PRODUCTION, payload: { cityId: a } });
    expect(next.regions[a].production.current).toBeTruthy();
    expect(next.regions[b].production.current).toBeNull();
    expect(advisorPick(next, a)).toBeNull();
  });

  it('with nothing idle it changes no city and says so', () => {
    const S = gameReducer(idleGame(), { type: ActionTypes.ADVISOR_PRODUCTION });
    const again = gameReducer(S, { type: ActionTypes.ADVISOR_PRODUCTION });
    expect(again.regions).toBe(S.regions);
    expect(again.logs.at(-1).message).toMatch(/nothing to build/);
  });
});
