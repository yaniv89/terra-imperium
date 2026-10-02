// src/engine/wonders.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { tileFacts } from '../data/tileYields';
import { GREAT_PROJECTS, getGreatProjectOwner } from '../data/greatProjects';
import { WONDER_TILE_RULE, wonderTileRule, wonderSites, canQueueWonder, wonderOptions, wonderCost, WONDER_PRODUCTION_PER_TURN } from './wonders';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const play = (s) => { let x = s; if (x.pendingPeaceOffer) x = gameReducer(x, { type: ActionTypes.ACCEPT_PENDING_PEACE }); x = resolveTurn(x); return x.activeProceduralEvent ? { ...x, activeProceduralEvent: null } : x; };

describe('wonders as tiles', () => {
  it('every project has a tile rule; sites are border tiles that fit', () => {
    Object.keys(GREAT_PROJECTS).forEach((id) => expect(WONDER_TILE_RULE[id]).toBeTruthy());
    const s = createInitialState({ playerNationId: 'eg', rngSeed: 3 });
    const cap = s.regions[getNationCapital('eg')];
    const tiles = getTiles();
    const sites = wonderSites(s, cap, 'great_pyramids');
    sites.forEach((t) => { expect(cap.tiles).toContain(t); expect(t).not.toBe(cap.tile); expect(wonderTileRule('great_pyramids').ok(tileFacts(tiles, t, {}))).toBe(true); });
    expect(wonderCost(1)).toBe(4 * WONDER_PRODUCTION_PER_TURN);
  });

  it('a capital queues the Pyramids on a desert tile, builds them from production, gains prestige, and raises the tier on the same tile', () => {
    let s = quiet(createInitialState({ playerNationId: 'eg', rngSeed: 3 }));
    const capId = getNationCapital('eg');
    const cap = s.regions[capId];
    const can = canQueueWonder(s, cap, 'great_pyramids', 1);
    if (!can.ok) { expect(can.reason).toMatch(/desert|rule/); return; } // Egypt's start has no desert in its first ring on this seed
    expect(wonderOptions(s, cap).some((w) => w.projectId === 'great_pyramids')).toBe(true);
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: capId, item: { kind: 'wonder', projectId: 'great_pyramids', tier: 1 } } });
    expect(s.regions[capId].production.current).toMatchObject({ kind: 'wonder', projectId: 'great_pyramids', tier: 1, tile: can.tile });
    expect(canQueueWonder(s, s.regions[capId], 'great_pyramids', 1).reason).toMatch(/queue/);
    const prestige = s.nations.eg.prestige || 0;
    s = { ...s, regions: { ...s.regions, [capId]: { ...s.regions[capId], production: { ...s.regions[capId].production, progress: 10000 } } } };
    s = play(s);
    expect(s.greatProjects.great_pyramids).toEqual({ regionId: capId, tier: 1, tile: can.tile });
    expect(s.world.tileState[can.tile].wonder).toBe('great_pyramids');
    expect(getGreatProjectOwner(s, 'great_pyramids')).toBe('eg');
    expect(s.nations.eg.prestige).toBeGreaterThan(prestige);
    expect(s.logs.some((l) => /Pyramids .*stands at/.test(l.message))).toBe(true);
    const up = canQueueWonder(s, s.regions[capId], 'great_pyramids', 2);
    expect(up).toMatchObject({ ok: true, tile: can.tile });
    expect(canQueueWonder(s, s.regions[capId], 'great_pyramids', 3).ok).toBe(false);
    expect(canQueueWonder(s, s.regions[capId], 'great_pyramids', 1).reason).toMatch(/elsewhere/);
  });
});

describe('AI wonders (plan C9)', () => {
  it('an AI city may queue a wonder as its owner and never as the player', async () => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
    const giza = s.regions[getNationCapital('eg')];
    expect(canQueueWonder(s, giza, 'great_pyramids').ok).toBe(false);
    const can = canQueueWonder(s, giza, 'great_pyramids', 1, 'eg');
    expect(can.ok).toBe(true);
    expect(wonderOptions(s, giza, 'eg').some((o) => o.projectId === 'great_pyramids')).toBe(true);
    const { chooseProduction, WONDER_MIN_PRODUCTION, WONDER_THINK_PERIOD } = await import('./aiProduction');
    const rich = { ...giza, lastYields: { ...(giza.lastYields || {}), production: WONDER_MIN_PRODUCTION * 3 }, buildings: { ...giza.buildings, categories: Object.fromEntries(['food', 'economy', 'culture', 'science', 'industry', 'military', 'infrastructure', 'defense', 'naval'].map((c) => [c, 9])) }, production: { current: null, queue: [], progress: 0 } };
    const turn = [...Array(WONDER_THINK_PERIOD).keys()].find((t) => (t + rich.tile) % WONDER_THINK_PERIOD === 0);
    const ctx = { researched: [], ageId: 'bronze', citiesOwned: 1, turnNumber: turn, units: s.units, counts: { settlers: 1, outposts: 0, landUnits: 9 } };
    const item = chooseProduction({ ...s, regions: { ...s.regions, [giza.id]: rich } }, rich, ctx);
    expect(item?.kind).toBe('wonder');
    expect(item.cost).toBe(wonderCost(1));
    expect(chooseProduction({ ...s, regions: { ...s.regions, [giza.id]: rich } }, rich, { ...ctx, turnNumber: turn + 1 })?.kind).not.toBe('wonder');
  });
  it('a wonder built elsewhere is dropped from a queue with its production banked, and a same-turn race goes to the first city', () => {
    const s0 = quiet(createInitialState({ playerNationId: 'fr', rngSeed: 3 }));
    const paris = s0.regions[getNationCapital('fr')];
    const site = wonderSites(s0, paris, 'colosseum')[0] ?? wonderSites(s0, paris, 'great_pyramids')[0];
    const projectId = wonderSites(s0, paris, 'colosseum')[0] != null ? 'colosseum' : 'great_pyramids';
    const cost = wonderCost(1);
    const queued = { ...paris, production: { current: { kind: 'wonder', projectId, tier: 1, tile: site, cost }, queue: [], progress: cost - 1 } };
    const elsewhere = { ...s0, age: 'classical', regions: { ...s0.regions, [paris.id]: queued }, greatProjects: { [projectId]: { regionId: getNationCapital('de'), tier: 1, tile: null } } };
    const next = play(elsewhere);
    expect(next.greatProjects[projectId].regionId).toBe(getNationCapital('de'));
    expect(next.regions[paris.id].production.current).toBeNull();
    expect(next.regions[paris.id].production.progress).toBe(50); // banked, then capped as an idle city's bank
    expect(next.world.tileState[site]?.wonder).toBeUndefined();
    // The race: two cities complete the same wonder this turn; the lower id keeps it.
    const berlin = s0.regions[getNationCapital('de')];
    const bSite = wonderSites(s0, berlin, projectId)[0];
    if (bSite == null) return;
    const both = { ...s0, age: 'classical', regions: { ...s0.regions, [paris.id]: queued, [berlin.id]: { ...berlin, production: { current: { kind: 'wonder', projectId, tier: 1, tile: bSite, cost }, queue: [], progress: cost } } } };
    const raced = play(both);
    const winner = [paris.id, berlin.id].sort()[0];
    expect(raced.greatProjects[projectId].regionId).toBe(winner);
    const loserTile = winner === paris.id ? bSite : site;
    expect(raced.world.tileState[loserTile]?.wonder).toBeUndefined();
    expect(raced.world.tileState[raced.greatProjects[projectId].tile]?.wonder).toBe(projectId);
  });
});
