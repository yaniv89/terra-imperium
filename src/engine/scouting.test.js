import { describe, it, expect } from 'vitest';
import { createInitialState } from '../context/GameContext';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { productionCost, itemKey, canQueue } from './world/cities';
import { getTiles } from '../data/geo/tiles';
import { getCapital } from '../data/regions';
import { isExplored } from './fog';
import { computeSupplyFlow } from './supplies';
import { orderExplore, explorePath, EXPLORER_STRENGTH } from './scouting';
import { buildOptions } from '../components/city/cityBuildModel';
import { armyStatus } from './standingOrders';
import { findTilePath } from './armies';
import { ageOf } from './nationState';
import { FIRST_AGE_ID } from '../data/ages';

const base = createInitialState({ playerNationId: 'gunditjmara', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const me = base.playerNationId;
const cap = base.regions[getCapital(base, me)];
const scout = { id: 'scout_1', ownerId: me, regionId: cap.id, homeRegionId: cap.id, tile: cap.tile, domain: 'land', classId: 'support', explorer: true, strength: EXPLORER_STRENGTH, maxStrength: EXPLORER_STRENGTH, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null };
const withScout = { ...base, units: { ...base.units, scout_1: scout } };
const quiet = (s) => ({ ...s, proceduralEventCooldown: 999999, battleSettings: { ...(s.battleSettings || {}), autoDefend: true } });

describe('player scouts (I122)', () => {
  it('cost well under a Spearman, and are offered in the city build list', () => {
    const spear = productionCost({ kind: 'unit', classId: 'infantry' });
    const sc = productionCost({ kind: 'unit', classId: 'support', explorer: true });
    expect(sc).toBeLessThan(spear / 2);
    expect(itemKey({ kind: 'unit', classId: 'support', explorer: true })).not.toBe(itemKey({ kind: 'unit', classId: 'support' }));
    const row = buildOptions(base, cap.id).find((o) => o.item.explorer);
    expect(row?.ok).toBe(true);
    expect(canQueue(cap, getTiles(), base.world, row.item, { ageId: 'bronze' }).ok).toBe(true);
  });

  it('a finished order becomes a scout unit', () => {
    const city = { ...cap, production: { current: { kind: 'unit', classId: 'support', explorer: true }, progress: 9999, queue: [], stored: {} } };
    const s = quiet({ ...base, regions: { ...base.regions, [cap.id]: city } });
    const next = resolveTurn(s);
    const made = Object.values(next.units).filter((u) => u.explorer && u.ownerId === me);
    expect(made.length).toBe(1);
    expect(made[0].strength).toBe(EXPLORER_STRENGTH);
  });

  it('Explore sets a march to unexplored land; a scout walks it and explores on its own', () => {
    const found = explorePath(withScout, scout);
    expect(found.path.length).toBeGreaterThan(1);
    const goal = found.path[found.path.length - 1];
    expect(isExplored(withScout, goal, me)).toBe(false);
    let s = quiet(gameReducer(withScout, { type: ActionTypes.EXPLORE_ORDER, payload: { unitIds: ['scout_1'] } }));
    expect(s.units.scout_1.route.length).toBeGreaterThan(0);
    expect(s.units.scout_1.explore.auto).toBe(true);
    expect(armyStatus(s, s.units.scout_1)).toBe('marching');
    const start = s.units.scout_1.tile;
    for (let i = 0; i < 12; i++) { s = quiet(resolveTurn(s)); if (s.pendingPeaceOffer || s.activeEventId) break; }
    expect(s.units.scout_1.tile).not.toBe(start);
    // still busy, never idle, and no war or battle came from it
    expect(['marching', 'exploring']).toContain(armyStatus(s, s.units.scout_1));
    expect((s.wars || []).filter((w) => w.active && (w.aggressor === me))).toHaveLength(0);
  });

  it('a Stone Age scout never paths over the sea (playtest 22 Oct)', () => {
    const t = getTiles();
    expect(ageOf(withScout, me)).toBe(FIRST_AGE_ID);
    // a sea tile near the capital, and a land tile on another landmass (an island across the water)
    const near = [...new Set(t.neighbors[cap.tile].flatMap((n) => [n, ...t.neighbors[n]]))];
    let sea = null;
    for (let r = 0, ring = [cap.tile], seen = new Set(ring); r < 12 && sea == null; r++) {
      ring = ring.flatMap((x) => t.neighbors[x]).filter((x) => !seen.has(x) && seen.add(x));
      sea = ring.find((x) => t.land[x] !== 1) ?? null;
    }
    expect(sea).not.toBeNull();
    expect(findTilePath(withScout, cap.tile, sea, me).path).toBeUndefined();
    expect(explorePath(withScout, scout, sea).path).toBeUndefined();
    // every route a scout or a land army is given stays on land
    const found = explorePath(withScout, scout);
    expect(found.path.every((x) => t.land[x] === 1)).toBe(true);
    near.filter((x) => t.land[x] === 1 && x !== cap.tile).forEach((x) => {
      const p = findTilePath(withScout, cap.tile, x, me).path;
      if (p) expect(p.every((y) => t.land[y] === 1)).toBe(true);
    });
  });

  it('eats no march supplies and counts as no campaigning unit', () => {
    const away = { ...scout, regionId: cap.id, tile: cap.tile + 0, marchedTurn: 5 };
    const flow = computeSupplyFlow({ regions: base.regions, units: { s: away }, nationId: me, ageId: 'bronze', resources: base.resources, turnNumber: 5, tileOwner: {} });
    expect(flow.marching).toBe(0);
    expect(flow.campaigning).toBe(0);
  });

  it('refuses a non-scout and a tile it cannot reach at peace', () => {
    const spear = Object.values(base.units).find((u) => u.ownerId === me && u.domain === 'land' && u.classId !== 'settler');
    if (spear) expect(orderExplore(base, [spear.id]).units).toBeUndefined();
    const closedTile = Object.entries(withScout.world.tileOwner).find(([, c]) => c != null && withScout.regions[c]?.owner !== me && withScout.regions[c]?.owner)?.[0];
    if (closedTile != null) {
      const r = orderExplore(withScout, ['scout_1'], Number(closedTile));
      expect(r.units).toBeUndefined();
    }
  });
});
