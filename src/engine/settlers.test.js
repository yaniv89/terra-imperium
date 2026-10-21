// src/engine/settlers.test.js
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getOwnedRegionIds } from '../data/regions';
import { assertGameState } from './stateAudit';
import { getTiles } from '../data/geo/tiles';
import { ringDistance } from './world/cities';
import {
  bestSites, settlerPath, canSettle, settlersOf, outpostsOf, processSettlers, makeSettler, OUTPOST_DONE, OUTPOST_PROGRESS, SETTLER_MOVES, OUTPOST_SLOTS_BY_AGE, SETTLER_GIVE_UP_TURNS
} from './settlers';
import { chooseProduction, SETTLER_THINK_PERIOD } from './aiProduction';
import { addCity, cap, peoplesWorld, neighbourWorld, rivalOf, borderPair } from './testWorld';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const play = (s) => {
  let x = s;
  if (x.pendingPeaceOffer) x = gameReducer(x, { type: x.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
  x = resolveTurn(x);
  return x.activeProceduralEvent ? { ...x, activeProceduralEvent: null } : x;
};

describe('settlers of a captured city (T87)', () => {
  const setup = () => {
    const w = peoplesWorld({ seed: 5 });
    const P = w.playerNationId;
    const a = addCity(w, P);
    const lost = a.state.regions[a.cityId];
    const keep = a.state.regions[cap(P)];
    const settler = makeSettler('s1', lost, P);
    // The city changed hands: the settlers still stand on its tile.
    const regions = { ...a.state.regions, [lost.id]: { ...lost, owner: rivalOf(w) } };
    return { state: { ...a.state, regions, units: { s1: settler } }, lost, keep, settler, P, R: rivalOf(w) };
  };
  it('go to the old owner nearest city, with a log line', () => {
    const { state, lost, keep, P } = setup();
    const out = processSettlers(state, state.regions, state.units, state.world, () => 'bronze', state.turnNumber);
    expect(out.units.s1.homeRegionId).toBe(keep.id);
    expect(out.units.s1.tile).toBe(keep.tile);
    expect(out.logs.some((l) => l.nationId === P && l.message.includes(lost.name) && l.message.includes(keep.name))).toBe(true);
  });
  it('are lost, with a line, when the old owner has no city left', () => {
    const { state, P, R } = setup();
    const regions = Object.fromEntries(Object.entries(state.regions).map(([id, r]) => [id, r.owner === P ? { ...r, owner: R } : r]));
    const out = processSettlers({ ...state, regions }, regions, state.units, state.world, () => 'bronze', state.turnNumber);
    expect(out.units.s1).toBeUndefined();
    expect(out.logs.some((l) => /no city left/.test(l.message))).toBe(true);
  });
});

describe('settlers and outposts', () => {
  it('finds sites in reach, scored by yields, never on owned land or too close to a city', () => {
    const s = peoplesWorld({ seed: 1 });
    const P = s.playerNationId;
    const cairo = s.regions[cap(P)];
    const sites = bestSites(s, P, cairo.tile, 'bronze');
    expect(sites.length).toBeGreaterThan(0);
    sites.forEach((site) => {
      expect(s.world.tileOwner[site.tile]).toBeUndefined();
      expect(canSettle(s, site.tile, P, 'bronze').ok).toBe(true);
    });
    expect(sites[0].score).toBeGreaterThanOrEqual(sites[sites.length - 1].score);
  });

  it('walks over free and own land only, not through a neighbour at peace', () => {
    const s = neighbourWorld({ rivals: 1, seed: 1 });
    const P = s.playerNationId;
    const paris = s.regions[cap(P)];
    const brussels = s.regions[borderPair(s, P, rivalOf(s))[1]];
    expect(settlerPath(s, paris.tile, brussels.tile, P)).toBeNull(); // a neighbour's city is its land
    const site = bestSites(s, P, paris.tile, 'bronze', { rings: 12, limit: 1 })[0];
    expect(site).toBeDefined();
    const path = settlerPath(s, paris.tile, site.tile, P);
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toBe(site.tile);
  });

  it('the player builds a settler, sends it, and the outpost becomes a city', () => {
    let s = quiet(peoplesWorld({ seed: 2 }));
    const P = s.playerNationId;
    const cairoId = cap(P);
    // The player's free Dawn settler (scenarios.js) is set aside: this test builds one from the queue.
    s = { ...s, units: Object.fromEntries(Object.entries(s.units).filter(([, u]) => !(u.ownerId === P && settlersOf({ [u.id]: u }, P).length))) };
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: cairoId, item: { kind: 'settler' } } });
    expect(s.regions[cairoId].production.current).toEqual({ kind: 'settler' });
    let prev = s;
    for (let i = 0; i < 80 && !settlersOf(s.units, P).length; i++) { prev = s; s = play(s); }
    const settler = settlersOf(s.units, P)[0];
    expect(settler).toBeDefined();
    expect(settler.tile).toBe(s.regions[cairoId].tile);
    expect(s.regions[cairoId].size).toBeLessThanOrEqual(prev.regions[cairoId].size); // the settler cost a citizen (growth that turn adds at most one)
    const site = bestSites(s, P, settler.tile, 'bronze', { limit: 1 })[0];
    s = gameReducer(s, { type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: settler.id, tile: site.tile } });
    expect(s.units[settler.id].target).toBe(site.tile);
    const turns = Math.ceil(site.steps / SETTLER_MOVES);
    for (let i = 0; i < turns + 2 && s.units[settler.id]; i++) s = play(s);
    expect(s.units[settler.id]).toBeUndefined();
    const outpost = outpostsOf(s.regions, P)[0];
    expect(outpost).toBeDefined();
    expect(outpost.tile).toBe(site.tile);
    expect(outpost.size).toBe(1);
    expect(s.world.tileOwner[site.tile]).toBe(outpost.id);
    assertGameState(s);
    for (let i = 0; i < Math.ceil(OUTPOST_DONE / OUTPOST_PROGRESS) + 3 && s.regions[outpost.id].outpost; i++) s = play(s);
    expect(s.regions[outpost.id].outpost).toBeNull();
    expect(getOwnedRegionIds(s.regions, P)).toContain(outpost.id);
    assertGameState(s);
  }, 60000);

  it('a settler can found on the spot, and never where a nation already is', () => {
    const s = peoplesWorld({ seed: 1 });
    const P = s.playerNationId;
    const paris = s.regions[cap(P)];
    const settler = makeSettler('u_test', paris, P);
    const withSettler = { ...s, units: { ...s.units, u_test: settler } };
    const refused = gameReducer(withSettler, { type: ActionTypes.FOUND_CITY, payload: { unitId: 'u_test' } });
    expect(refused.units.u_test).toBeDefined(); // on Paris itself: too close
    const site = bestSites(s, P, paris.tile, 'bronze', { rings: 12, limit: 1 })[0];
    const there = { ...withSettler, units: { ...withSettler.units, u_test: { ...settler, tile: site.tile } } };
    const founded = gameReducer(there, { type: ActionTypes.FOUND_CITY, payload: { unitId: 'u_test' } });
    expect(founded.units.u_test).toBeUndefined();
    expect(outpostsOf(founded.regions, P)).toHaveLength(1);
    assertGameState(founded);
  });

  it('respects the outpost slot cap of the age', () => {
    const s = peoplesWorld({ seed: 1, fog: false }); // sites need explored land
    const P = s.playerNationId;
    const paris = s.regions[cap(P)];
    const slots = OUTPOST_SLOTS_BY_AGE.bronze;
    // Sites far enough apart that founding one does not crowd the next (MIN_CITY_SPACING).
    const tiles = getTiles();
    const sites = [];
    bestSites(s, P, paris.tile, 'bronze', { rings: 12, limit: 200 }).forEach((site) => { if (sites.length < slots + 1 && sites.every((o) => ringDistance(tiles, o.tile, site.tile, 3) > 2)) sites.push(site); });
    expect(sites.length).toBe(slots + 1);
    const units = Object.fromEntries(sites.map((site, i) => [`s${i}`, { ...makeSettler(`s${i}`, paris, P), tile: site.tile, target: site.tile }]));
    const r = processSettlers({ ...s, units }, s.regions, units, s.world, () => 'bronze', 2);
    expect(outpostsOf(r.regions, P)).toHaveLength(slots); // one settler waits for a slot
    expect(Object.keys(r.units)).toHaveLength(1);
  });

  it('an AI settler without a target looks for a site again, and one idle too long is disbanded', () => {
    const s = quiet(peoplesWorld({ seed: 5, fog: false }));
    const AI = rivalOf(s);
    const cairo = s.regions[cap(AI)];
    const idle = { ...makeSettler('u_idle', cairo, AI), target: null };
    const r = processSettlers(s, s.regions, { ...s.units, u_idle: idle }, s.world, () => 'bronze', 1);
    // the retry found a site (a close one is founded at once, so the settler may already be gone)
    expect(r.units.u_idle ? r.units.u_idle.target : 'founded').not.toBeNull();
    expect(r.units.u_idle?.idleSince ?? null).toBeNull();
    const stuck = { ...idle, idleSince: 1 };
    const r2 = processSettlers(s, s.regions, { ...s.units, u_idle: stuck }, s.world, () => 'bronze', 1 + SETTLER_GIVE_UP_TURNS);
    expect(r2.units.u_idle).toBeUndefined();
    expect(r2.logs.some((l) => l.nationId === AI && /went home/.test(l.message))).toBe(true);
    // The player's settlers are theirs to send: never retargeted, never disbanded.
    const mine = { ...makeSettler('u_mine', s.regions[cap(s.playerNationId)], s.playerNationId), target: null, idleSince: 1 };
    const r3 = processSettlers(s, s.regions, { ...s.units, u_mine: mine }, s.world, () => 'bronze', 1 + SETTLER_GIVE_UP_TURNS);
    expect(r3.units.u_mine.target).toBeNull();
  });

  it('AI cities queue settlers when they have room and then buildings, and the AI world fills in', () => {
    const s = quiet(peoplesWorld({ seed: 5 }));
    const cairo = s.regions[cap(rivalOf(s))]; // an AI capital
    const thinkTurn = (SETTLER_THINK_PERIOD - (cairo.tile % SETTLER_THINK_PERIOD)) % SETTLER_THINK_PERIOD; // the site search runs one turn in a few
    const item = chooseProduction(s, cairo, { researched: [], ageId: 'bronze', citiesOwned: 1, units: s.units, turnNumber: thinkTurn });
    expect(item).toEqual({ kind: 'settler' });
    const small = { ...cairo, size: 2 };
    expect(['building', 'unit']).toContain(chooseProduction(s, small, { researched: [], ageId: 'bronze', citiesOwned: 1, units: s.units })?.kind);
    let x = s;
    const before = Object.keys(x.regions).length;
    for (let i = 0; i < 60; i++) x = play(x);
    const after = Object.keys(x.regions).length;
    expect(after).toBeGreaterThan(before + 5);
    expect(Object.values(x.regions).some((c) => c.outpost)).toBe(true);
    const tiles = getTiles();
    Object.values(x.regions).forEach((c) => expect(tiles.land[c.tile]).toBe(1));
    assertGameState(x);
  }, 120000);
});
