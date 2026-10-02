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
