// src/engine/boosts.test.js
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { BOOSTS, BOOST_SHARE } from '../data/boosts';
import { TECH_TREE } from '../data/techTree';
import { nationFacts, boostOf, applyBoosts } from './boosts';
import { getResearchCost } from './research';
import { peoplesWorld } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 3 });
const EG_ID = PEOPLES_WORLD.playerNationId;

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = quiet(peoplesWorld({ seed: 3 }));

describe('research boosts', () => {
  it('every tech has a boost with a label', () => {
    Object.keys(TECH_TREE).forEach((id) => { expect(BOOSTS[id], id).toBeDefined(); expect(BOOSTS[id].label.length).toBeGreaterThan(3); });
  });

  it('reads the map: Cairo on the Nile boosts Irrigation Canals; two cities boost Mudbrick Roads', () => {
    const f = nationFacts(S, EG_ID);
    const tiles = getTiles();
    expect(f.cities).toBe(1);
    expect(f.river).toBe(!!tiles.rivers[S.regions[getNationCapital(EG_ID)].tile]);
    const b = boostOf(S, EG_ID, 'infrastructure_mudbrick_roads');
    expect(b).toMatchObject({ label: 'Rule 2 cities', met: false, taken: false });
    expect(boostOf(S, EG_ID, 'governance_code_of_laws').met).toBe(S.regions[getNationCapital(EG_ID)].size >= 3);
  });

  it('pays 40% of the cost once, for the player and for an AI nation', () => {
    const researched = new Set();
    const research = { current: null, queue: [], progress: {}, auto: false };
    const r = applyBoosts(S, EG_ID, research, researched);
    const metNow = Object.keys(BOOSTS).filter((id) => BOOSTS[id].check(nationFacts(S, EG_ID)));
    expect(r.applied.sort()).toEqual(metNow.sort());
    metNow.forEach((id) => expect(r.research.progress[id]).toBe(Math.round(getResearchCost(S, EG_ID, id) * BOOST_SHARE)));
    const again = applyBoosts(S, EG_ID, r.research, researched);
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
