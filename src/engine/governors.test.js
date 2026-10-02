// src/engine/governors.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { assertGameState } from './stateAudit';
import { loyaltyTarget } from './loyalty';
import { cityYields } from './world/cities';
import { getTiles } from '../data/geo/tiles';
import {
  cityGroups, governorOf, governorChoices, assignGovernor, autoGovern, governorEffects, generateGovernorCandidates, pruneGovernors,
  GOVERNOR_GROUP_MAX, GOVERNOR_ASSIGN_TURNS, GOVERNOR_FOOD, GOVERNOR_CULTURE, GOVERNOR_LOYALTY, UNGOVERNED_LOYALTY, GOVERNOR_REFRESH_TURNS
} from './governors';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const play = (s) => {
  let x = s;
  if (x.pendingPeaceOffer) x = gameReducer(x, { type: x.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
  x = resolveTurn(x);
  return x.activeProceduralEvent ? { ...x, activeProceduralEvent: null } : x;
};

describe('governors', () => {
  it('groups cities around the capital, at most GOVERNOR_GROUP_MAX each, every city in one group', () => {
    let s = quiet(createInitialState({ playerNationId: 'in', rngSeed: 3 }));
    for (let i = 0; i < 40; i++) s = play(s);
    const big = Object.values(s.nations).filter((n) => !n.isEliminated).map((n) => ({ n, cities: Object.values(s.regions).filter((c) => c.owner === n.id) })).sort((a, b) => b.cities.length - a.cities.length)[0];
    const groups = cityGroups(s, big.n.id);
    expect(groups[0].seat).toBe(big.n.capitalRegionId);
    const all = groups.flatMap((g) => g.cities);
    expect(new Set(all).size).toBe(big.cities.length);
    groups.forEach((g) => expect(g.cities.length).toBeLessThanOrEqual(GOVERNOR_GROUP_MAX));
    expect(cityGroups(s, big.n.id)).toBe(groups); // cached per cities map
  }, 60000);

  it('the player seats a candidate who takes office after GOVERNOR_ASSIGN_TURNS, with the yields and loyalty of a governed city', () => {
    let s = quiet(createInitialState({ playerNationId: 'in', rngSeed: 3 }));
    s = play(s);
    const me = s.nations.in;
    expect(me.governorCandidates?.length).toBeGreaterThan(0);
    const cap = getNationCapital('in');
    expect(governorEffects(s, 'in', cap).loyalty).toBe(UNGOVERNED_LOYALTY);
    const before = loyaltyTarget(s, s.regions[cap]).governor;
    expect(before).toBe(UNGOVERNED_LOYALTY);
    const choice = governorChoices(me)[0];
    let x = gameReducer(s, { type: ActionTypes.ASSIGN_GOVERNOR, payload: { seatId: cap, candidateId: choice.id } });
    expect(x.nations.in.governors[cap].ready).toBe(s.turnNumber + GOVERNOR_ASSIGN_TURNS);
    expect(governorOf(x, 'in', cap)).toBeNull(); // on the road
    for (let i = 0; i < GOVERNOR_ASSIGN_TURNS; i++) x = play(x);
    const gov = governorOf(x, 'in', cap);
    expect(gov?.id).toBe(choice.id);
    const e = governorEffects(x, 'in', cap);
    expect(e).toMatchObject({ food: GOVERNOR_FOOD, culture: GOVERNOR_CULTURE, loyalty: GOVERNOR_LOYALTY + choice.skill, governed: true });
    expect(loyaltyTarget(x, x.regions[cap]).governor).toBe(GOVERNOR_LOYALTY + choice.skill);
    const tiles = getTiles(); const world = { cities: x.regions, tileOwner: x.world.tileOwner, tileState: x.world.tileState };
    const plain = cityYields(x.regions[cap], tiles, world, x.regions[cap].worked, [], {});
    const governed = cityYields(x.regions[cap], tiles, world, x.regions[cap].worked, [], { foodBonus: e.food, productionMult: e.productionMult, cultureBonus: e.culture });
    expect(governed.food - plain.food).toBe(GOVERNOR_FOOD);
    expect(governed.culture - plain.culture).toBe(GOVERNOR_CULTURE);
    expect(governed.production).toBeGreaterThan(plain.production);
    const recalled = gameReducer(x, { type: ActionTypes.DISMISS_GOVERNOR, payload: { seatId: cap } });
    expect(recalled.nations.in.governors[cap]).toBeUndefined();
    assertGameState(x);
  });

  it('candidates refresh on the period, the heir may serve, AI nations govern every group, lost seats are pruned', () => {
    let s = quiet(createInitialState({ playerNationId: 'in', rngSeed: 3 }));
    s = play(s);
    const first = s.nations.in.governorCandidates;
    for (let i = 0; i < GOVERNOR_REFRESH_TURNS; i++) s = play(s);
    expect(s.nations.in.governorCandidates).not.toEqual(first);
    const withHeir = { ...s.nations.in, heir: { id: 'heir_x', name: 'Asha', adm: 5, dip: 1, mil: 1 } };
    expect(governorChoices(withHeir).some((c) => c.heir && c.skill === 3)).toBe(true);
    const pk = s.nations.pk;
    expect(pk.governors && Object.keys(pk.governors).length).toBe(cityGroups(s, 'pk').length);
    expect(governorOf(s, 'pk', getNationCapital('pk'))).not.toBeNull();
    expect(generateGovernorCandidates('in', 'a')).toEqual(generateGovernorCandidates('in', 'a'));
    const seated = assignGovernor(s.nations.in, getNationCapital('in'), governorChoices(s.nations.in)[0], s.turnNumber);
    const lost = { ...s, regions: { ...s.regions, [getNationCapital('in')]: { ...s.regions[getNationCapital('in')], owner: 'pk' } }, nations: { ...s.nations, in: seated } };
    expect(pruneGovernors(lost, seated).governors[getNationCapital('in')]).toBeUndefined();
    expect(autoGovern(s, s.nations.pk, s.turnNumber)).toBe(s.nations.pk);
  });
});
