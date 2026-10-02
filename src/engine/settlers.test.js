// src/engine/settlers.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital, getOwnedRegionIds } from '../data/regions';
import { assertGameState } from './stateAudit';
import { getTiles } from '../data/geo/tiles';
import {
  bestSites, settlerPath, canSettle, settlersOf, outpostsOf, processSettlers, makeSettler, OUTPOST_DONE, OUTPOST_PROGRESS, SETTLER_MOVES
} from './settlers';
import { chooseProduction } from './aiProduction';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const play = (s) => {
  let x = s;
  if (x.pendingPeaceOffer) x = gameReducer(x, { type: x.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
  x = resolveTurn(x);
  return x.activeProceduralEvent ? { ...x, activeProceduralEvent: null } : x;
};

describe('settlers and outposts', () => {
  it('finds sites in reach, scored by yields, never on owned land or too close to a city', () => {
    const s = createInitialState({ playerNationId: 'eg', rngSeed: 1 });
    const cairo = s.regions[getNationCapital('eg')];
    const sites = bestSites(s, 'eg', cairo.tile, 'bronze');
    expect(sites.length).toBeGreaterThan(0);
    sites.forEach((site) => {
      expect(s.world.tileOwner[site.tile]).toBeUndefined();
      expect(canSettle(s, site.tile, 'eg', 'bronze').ok).toBe(true);
    });
    expect(sites[0].score).toBeGreaterThanOrEqual(sites[sites.length - 1].score);
  });

  it('walks over free and own land only, not through a neighbour at peace', () => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 1 });
    const paris = s.regions[getNationCapital('fr')];
    const brussels = s.regions[getNationCapital('be')];
    expect(settlerPath(s, paris.tile, brussels.tile, 'fr')).toBeNull(); // Brussels is Belgian land
    const site = bestSites(s, 'fr', paris.tile, 'bronze', { rings: 12, limit: 1 })[0];
    expect(site).toBeDefined();
    const path = settlerPath(s, paris.tile, site.tile, 'fr');
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toBe(site.tile);
  });

  it('the player builds a settler, sends it, and the outpost becomes a city', () => {
    let s = quiet(createInitialState({ playerNationId: 'eg', rngSeed: 2 }));
    const cairoId = getNationCapital('eg');
    const size0 = s.regions[cairoId].size;
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: cairoId, item: { kind: 'settler' } } });
    expect(s.regions[cairoId].production.current).toEqual({ kind: 'settler' });
    for (let i = 0; i < 40 && !settlersOf(s.units, 'eg').length; i++) s = play(s);
    const settler = settlersOf(s.units, 'eg')[0];
    expect(settler).toBeDefined();
    expect(settler.tile).toBe(s.regions[cairoId].tile);
    expect(s.regions[cairoId].size).toBe(size0 - 1);
    const site = bestSites(s, 'eg', settler.tile, 'bronze', { limit: 1 })[0];
    s = gameReducer(s, { type: ActionTypes.SET_SETTLER_TARGET, payload: { unitId: settler.id, tile: site.tile } });
    expect(s.units[settler.id].target).toBe(site.tile);
    const turns = Math.ceil(site.steps / SETTLER_MOVES);
    for (let i = 0; i < turns + 2 && s.units[settler.id]; i++) s = play(s);
    expect(s.units[settler.id]).toBeUndefined();
    const outpost = outpostsOf(s.regions, 'eg')[0];
    expect(outpost).toBeDefined();
    expect(outpost.tile).toBe(site.tile);
    expect(outpost.size).toBe(1);
    expect(s.world.tileOwner[site.tile]).toBe(outpost.id);
    assertGameState(s);
    for (let i = 0; i < Math.ceil(OUTPOST_DONE / OUTPOST_PROGRESS) + 3 && s.regions[outpost.id].outpost; i++) s = play(s);
    expect(s.regions[outpost.id].outpost).toBeNull();
    expect(getOwnedRegionIds(s.regions, 'eg')).toContain(outpost.id);
    assertGameState(s);
  }, 60000);

  it('a settler can found on the spot, and never where a nation already is', () => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 1 });
    const paris = s.regions[getNationCapital('fr')];
    const settler = makeSettler('u_test', paris, 'fr');
    const withSettler = { ...s, units: { ...s.units, u_test: settler } };
    const refused = gameReducer(withSettler, { type: ActionTypes.FOUND_CITY, payload: { unitId: 'u_test' } });
    expect(refused.units.u_test).toBeDefined(); // on Paris itself: too close
    const site = bestSites(s, 'fr', paris.tile, 'bronze', { rings: 12, limit: 1 })[0];
    const there = { ...withSettler, units: { ...withSettler.units, u_test: { ...settler, tile: site.tile } } };
    const founded = gameReducer(there, { type: ActionTypes.FOUND_CITY, payload: { unitId: 'u_test' } });
    expect(founded.units.u_test).toBeUndefined();
    expect(outpostsOf(founded.regions, 'fr')).toHaveLength(1);
    assertGameState(founded);
  });

  it('respects the outpost slot cap of the age', () => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 1 });
    const paris = s.regions[getNationCapital('fr')];
    const sites = bestSites(s, 'fr', paris.tile, 'bronze', { rings: 12, limit: 2 });
    expect(sites.length).toBe(2);
    const units = { a: { ...makeSettler('a', paris, 'fr'), tile: sites[0].tile, target: sites[0].tile }, b: { ...makeSettler('b', paris, 'fr'), tile: sites[1].tile, target: sites[1].tile } };
    const r = processSettlers({ ...s, units }, s.regions, units, s.world, () => 'bronze', 2);
    expect(outpostsOf(r.regions, 'fr')).toHaveLength(1); // Bronze: one slot
    expect(Object.keys(r.units)).toHaveLength(Object.keys(units).length - 1);
  });

  it('AI cities queue settlers when they have room and then buildings, and the AI world fills in', () => {
    const s = quiet(createInitialState({ playerNationId: 'au', rngSeed: 5 }));
    const cairo = s.regions[getNationCapital('eg')];
    const thinkTurn = (5 - (cairo.tile % 5)) % 5; // the site search runs one turn in five
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
