// src/engine/boosts.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { BOOSTS, BOOST_SHARE } from '../data/boosts';
import { TECH_TREE } from '../data/techTree';
import { nationFacts, boostOf, applyBoosts } from './boosts';
import { getResearchCost } from './research';

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = quiet(createInitialState({ playerNationId: 'eg', rngSeed: 3 }));

describe('research boosts', () => {
  it('every tech has a boost with a label', () => {
    Object.keys(TECH_TREE).forEach((id) => { expect(BOOSTS[id], id).toBeDefined(); expect(BOOSTS[id].label.length).toBeGreaterThan(3); });
  });

  it('reads the map: Cairo on the Nile boosts Irrigation Canals; two cities boost Mudbrick Roads', () => {
    const f = nationFacts(S, 'eg');
    const tiles = getTiles();
    expect(f.cities).toBe(1);
    expect(f.river).toBe(!!tiles.rivers[S.regions[getNationCapital('eg')].tile]);
    const b = boostOf(S, 'eg', 'infrastructure_mudbrick_roads');
    expect(b).toMatchObject({ label: 'Rule 2 cities', met: false, taken: false });
    expect(boostOf(S, 'eg', 'governance_code_of_laws').met).toBe(S.regions[getNationCapital('eg')].size >= 3);
  });

  it('pays 40% of the cost once, for the player and for an AI nation', () => {
    const researched = new Set();
    const research = { current: null, queue: [], progress: {}, auto: false };
    const r = applyBoosts(S, 'eg', research, researched);
    const metNow = Object.keys(BOOSTS).filter((id) => BOOSTS[id].check(nationFacts(S, 'eg')));
    expect(r.applied.sort()).toEqual(metNow.sort());
    metNow.forEach((id) => expect(r.research.progress[id]).toBe(Math.round(getResearchCost(S, 'eg', id) * BOOST_SHARE)));
    const again = applyBoosts(S, 'eg', r.research, researched);
    expect(again.applied).toEqual([]);
    expect(again.research).toBe(r.research);
    // Through a turn: the player's boosts land in state.research and are logged.
    const next = resolveTurn(S);
    expect(Object.keys(next.research.boosted || {}).length).toBeGreaterThan(0);
    expect(next.logs.some((l) => /^Boost:/.test(l.message))).toBe(true);
    // An AI nation, on its research turn, gets the same.
    let s = next;
    for (let i = 0; i < 4; i++) s = resolveTurn(s);
    expect(Object.values(s.nations).some((n) => n.research?.boosted && Object.keys(n.research.boosted).length > 0)).toBe(true);
  }, 60000);
});
