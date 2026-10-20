// src/engine/governors.test.js
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { assertGameState } from './stateAudit';
import { loyaltyTarget } from './loyalty';
import { cityYields } from './world/cities';
import { getTiles } from '../data/geo/tiles';
import {
  cityGroups, governorOf, governorChoices, assignGovernor, autoGovern, governorEffects, generateGovernorCandidates, pruneGovernors, regroupGovernors,
  GOVERNOR_GROUP_MAX, GOVERNOR_ASSIGN_TURNS, GOVERNOR_FOOD, GOVERNOR_CULTURE, GOVERNOR_LOYALTY, UNGOVERNED_LOYALTY, GOVERNOR_REFRESH_TURNS
} from './governors';
import { peoplesWorld, rivalOf, addCities } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 3 });
const IN_ID = PEOPLES_WORLD.playerNationId;
const PK_ID = rivalOf(PEOPLES_WORLD, 0);

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const play = (s) => {
  let x = s;
  if (x.pendingPeaceOffer) x = gameReducer(x, { type: x.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
  x = resolveTurn(x);
  return x.activeProceduralEvent ? { ...x, activeProceduralEvent: null } : x;
};

describe('governors', () => {
  it('groups cities around the capital, at most GOVERNOR_GROUP_MAX each, every city in one group', () => {
    let s = quiet(peoplesWorld({ seed: 3 }));
    for (let i = 0; i < 40; i++) s = play(s);
    const big = Object.values(s.nations).filter((n) => !n.isEliminated).map((n) => ({ n, cities: Object.values(s.regions).filter((c) => c.owner === n.id) })).sort((a, b) => b.cities.length - a.cities.length)[0];
    const groups = cityGroups(s, big.n.id);
    expect(groups[0].seat).toBe(big.n.capitalRegionId);
    const all = groups.flatMap((g) => g.cities);
    expect(new Set(all).size).toBe(big.cities.length);
    groups.forEach((g) => expect(g.cities.length).toBeLessThanOrEqual(GOVERNOR_GROUP_MAX));
    expect(cityGroups({ ...s, regions: { ...s.regions } }, big.n.id)).toBe(groups); // memoised on the city set, not the regions object
  }, 60000);

  it('the player seats a candidate who takes office after GOVERNOR_ASSIGN_TURNS, with the yields and loyalty of a governed city', () => {
    let s = quiet(peoplesWorld({ seed: 3 }));
    s = play(s);
    const me = s.nations[IN_ID];
    expect(me.governorCandidates?.length).toBeGreaterThan(0);
    const cap = getNationCapital(IN_ID);
    expect(governorEffects(s, IN_ID, cap).loyalty).toBe(UNGOVERNED_LOYALTY);
    const before = loyaltyTarget(s, s.regions[cap]).governor;
    expect(before).toBe(UNGOVERNED_LOYALTY);
    const choice = governorChoices(me)[0];
    let x = gameReducer(s, { type: ActionTypes.ASSIGN_GOVERNOR, payload: { seatId: cap, candidateId: choice.id } });
    expect(x.nations[IN_ID].governors[cap].ready).toBe(s.turnNumber + GOVERNOR_ASSIGN_TURNS);
    expect(governorOf(x, IN_ID, cap)).toBeNull(); // on the road
    for (let i = 0; i < GOVERNOR_ASSIGN_TURNS; i++) x = play(x);
    const gov = governorOf(x, IN_ID, cap);
    expect(gov?.id).toBe(choice.id);
    const e = governorEffects(x, IN_ID, cap);
    expect(e).toMatchObject({ food: GOVERNOR_FOOD, culture: GOVERNOR_CULTURE, loyalty: GOVERNOR_LOYALTY + choice.skill, governed: true });
    expect(loyaltyTarget(x, x.regions[cap]).governor).toBe(GOVERNOR_LOYALTY + choice.skill);
    const tiles = getTiles(); const world = { cities: x.regions, tileOwner: x.world.tileOwner, tileState: x.world.tileState };
    const plain = cityYields(x.regions[cap], tiles, world, x.regions[cap].worked, [], {});
    const governed = cityYields(x.regions[cap], tiles, world, x.regions[cap].worked, [], { foodBonus: e.food, productionMult: e.productionMult, cultureBonus: e.culture });
    expect(governed.food - plain.food).toBe(GOVERNOR_FOOD);
    expect(governed.culture - plain.culture).toBe(GOVERNOR_CULTURE);
    expect(governed.production).toBeGreaterThan(plain.production);
    const recalled = gameReducer(x, { type: ActionTypes.DISMISS_GOVERNOR, payload: { seatId: cap } });
    expect(recalled.nations[IN_ID].governors[cap]).toBeUndefined();
    assertGameState(x);
  });

  it('candidates refresh on the period, AI nations govern every group, lost seats are pruned', () => {
    let s = quiet(peoplesWorld({ seed: 3 }));
    s = play(s);
    const first = s.nations[IN_ID].governorCandidates;
    for (let i = 0; i < GOVERNOR_REFRESH_TURNS; i++) s = play(s);
    expect(s.nations[IN_ID].governorCandidates).not.toEqual(first);
    const pk = s.nations[PK_ID];
    expect(pk.governors && Object.keys(pk.governors).length).toBe(cityGroups(s, PK_ID).length);
    expect(governorOf(s, PK_ID, getNationCapital(PK_ID))).not.toBeNull();
    expect(generateGovernorCandidates(IN_ID, 'a')).toEqual(generateGovernorCandidates(IN_ID, 'a'));
    const seated = assignGovernor(s.nations[IN_ID], getNationCapital(IN_ID), governorChoices(s.nations[IN_ID])[0], s.turnNumber);
    const lost = { ...s, regions: { ...s.regions, [getNationCapital(IN_ID)]: { ...s.regions[getNationCapital(IN_ID)], owner: PK_ID } }, nations: { ...s.nations, [IN_ID]: seated } };
    expect(pruneGovernors(lost, seated).governors[getNationCapital(IN_ID)]).toBeUndefined();
    expect(autoGovern(s, s.nations[PK_ID], s.turnNumber)).toBe(s.nations[PK_ID]);
  });

  it('a governor follows his city when the groups re-anchor, and every change is reported (H-11)', () => {
    const s0 = quiet(peoplesWorld({ seed: 3 }));
    const { state: s, cityIds } = addCities(s0, IN_ID, 3, { near: getNationCapital(IN_ID) });
    const groups = cityGroups(s, IN_ID);
    const cap = getNationCapital(IN_ID);
    const inCapGroup = groups.find((g) => g.seat === cap).cities.find((c) => c !== cap);
    expect(inCapGroup).toBeTruthy();
    // He was seated when this city anchored a group of its own; a founding since folded it into the capital's group.
    const gov = { id: 'g1', name: 'Omar', skill: 3, since: 1, ready: 2 };
    const nation = { ...s.nations[IN_ID], governors: { [inCapGroup]: gov } };
    const r = regroupGovernors(s, nation);
    expect(r.nation.governors[cap]).toEqual(gov);
    expect(r.nation.governors[inCapGroup]).toBeUndefined();
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({ kind: 'moved', name: 'Omar', seat: inCapGroup, to: cap });
    expect(pruneGovernors(s, nation).governors[cap]).toEqual(gov);
    // A lost seat city still ends the post, and says so.
    const lost = { ...s, regions: { ...s.regions, [inCapGroup]: { ...s.regions[inCapGroup], owner: PK_ID } } };
    const gone = regroupGovernors(lost, nation);
    expect(Object.keys(gone.nation.governors)).toHaveLength(0);
    expect(gone.changes[0]).toMatchObject({ kind: 'left', name: 'Omar' });
    expect(cityIds.length).toBe(3);
  });
});
