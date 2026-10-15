// The Dawn bridge's last readers on the tile world (plans/civ-map-rework.md, workstream 13):
// reinforcements by tile distance, the garrison's fallback to the nearest held city, the siege's
// protecting fort from lands that touch, trade routes as caravan paths over tiles.
import { describe, it, expect } from 'vitest';
import { getTiles } from '../data/geo/tiles';
import { getCapital, getNeighborIds, getTouchingIds } from '../data/regions';
import { getReinforcementSources } from './invasion';
import { getWithdrawalTarget } from './defense';
import { getZoneOfControlMultiplier, ZOC_FORT_LEVEL_THRESHOLD } from './siege';
import { findCaravanPath, getTradeRoute, TRADE_ROUTE_MAX_TILES } from './tradeRoutes';
import { unitsWithinRings, nearestHeldCity, REINFORCE_RINGS, FALLBACK_RINGS } from './armies';
import { addCity } from './testWorld';
import { ringDistance } from './world/cities';
import { neighbourWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 11 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);

const base = () => neighbourWorld({ seed: 11 });
const unit = (id, regionId, ownerId, tile, extra = {}) => ({ id, regionId, ownerId, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, ...extra });
const tileAtRings = (tiles, centre, rings) => {
  let frontier = [centre]; const seen = new Set(frontier);
  for (let d = 1; d <= rings; d++) { const next = []; frontier.forEach((t) => tiles.neighbors[t].forEach((n) => { if (!seen.has(n)) { seen.add(n); next.push(n); } })); frontier = next; }
  return frontier.find((t) => tiles.land[t] === 1);
};

describe('reinforcements by tile distance', () => {
  it('counts idle troops within REINFORCE_RINGS of the city centre and not the garrison or the origin', () => {
    const s = base(); const tiles = getTiles();
    const target = getCapital(s, DE_ID); const centre = s.regions[target].tile;
    const paris = getCapital(s, FR_ID);
    const near = tileAtRings(tiles, centre, 2); const far = tileAtRings(tiles, centre, REINFORCE_RINGS + 2);
    const units = { n1: unit('n1', paris, FR_ID, near), f1: unit('f1', paris, FR_ID, far), g1: unit('g1', target, DE_ID, centre), o1: unit('o1', 'origin', FR_ID, near), spent: unit('s1', paris, FR_ID, near, { movesLeft: 0 }) };
    const withUnits = { ...s, units };
    expect(unitsWithinRings(withUnits, centre, FR_ID, REINFORCE_RINGS).map((u) => u.id)).toEqual(['n1', 'o1', 's1']);
    const sources = getReinforcementSources(withUnits, target, FR_ID, ['origin']);
    expect(sources).toEqual([{ regionId: paris, unitIds: ['n1'] }]);
    expect(getReinforcementSources(withUnits, target, DE_ID)).toEqual([]);
  });
});

describe('the garrison falls back to the nearest held city', () => {
  it('finds a second French city near Paris and nothing when there is none in reach', () => {
    const s = base(); const paris = getCapital(s, FR_ID);
    expect(getWithdrawalTarget(s, paris)).toBeNull();
    const { state, cityId } = addCity(s, FR_ID, { near: paris });
    expect(ringDistance(getTiles(), state.regions[paris].tile, state.regions[cityId].tile, FALLBACK_RINGS)).toBeLessThanOrEqual(FALLBACK_RINGS);
    expect(getWithdrawalTarget(state, paris)).toBe(cityId);
    expect(nearestHeldCity(state, cityId, FR_ID)).toBe(paris);
    const occupied = { ...state, regions: { ...state.regions, [cityId]: { ...state.regions[cityId], occupiedBy: DE_ID } } };
    expect(getWithdrawalTarget(occupied, paris)).toBeNull();
  });
});

describe('the protecting fort reads lands that touch', () => {
  it('a fort in a bridged neighbour that does not touch gives no cover', () => {
    const s = base(); const paris = getCapital(s, FR_ID);
    const bridged = getNeighborIds(paris).find((id) => !getTouchingIds(paris).includes(id));
    expect(bridged).toBeDefined();
    const regions = { ...s.regions, [bridged]: { ...s.regions[bridged], owner: FR_ID, defenseLevel: ZOC_FORT_LEVEL_THRESHOLD } };
    expect(getZoneOfControlMultiplier(regions, paris, FR_ID)).toBe(1);
  });
});

describe('trade routes as caravan paths', () => {
  it('walks the tiles from capital to capital, bounded, and is closed by a war on the way', () => {
    const s = base(); const tiles = getTiles();
    const paris = s.regions[getCapital(s, FR_ID)].tile; const berlin = s.regions[getCapital(s, DE_ID)].tile;
    const route = getTradeRoute(s, DE_ID);
    expect(route.ok).toBe(true); expect(route.kind).toBe('land');
    expect(route.tiles[0]).toBe(paris); expect(route.tiles[route.tiles.length - 1]).toBe(berlin);
    expect(route.tiles.length).toBeLessThanOrEqual(TRADE_ROUTE_MAX_TILES + 1);
    route.tiles.forEach((t, i) => { expect(tiles.land[t]).toBe(1); if (i) expect(tiles.neighbors[route.tiles[i - 1]]).toContain(t); });
    expect(findCaravanPath(s, paris, berlin, () => false)).toBeNull();
    // A war with every nation whose land the caravan crosses closes the land route.
    const crossed = route.regions.map((id) => s.regions[id].owner).filter((o) => o !== FR_ID && o !== DE_ID);
    const wars = crossed.map((o, i) => ({ id: `w${i}`, aggressor: FR_ID, enemy: o, active: true }));
    const atWar = { ...s, wars };
    const after = getTradeRoute(atWar, DE_ID);
    if (crossed.length) expect(after.kind === 'land' ? after.regions.map((id) => s.regions[id].owner).some((o) => crossed.includes(o)) : true).toBe(false);
    expect(getTradeRoute({ ...s, wars: [{ id: 'w', aggressor: DE_ID, enemy: FR_ID, active: true }] }, DE_ID).ok).toBe(false);
  });
  it('memoises per state parts and recomputes when they change', () => {
    const s = base();
    expect(getTradeRoute(s, DE_ID)).toBe(getTradeRoute(s, DE_ID));
    expect(getTradeRoute({ ...s, wars: [] }, DE_ID)).not.toBe(getTradeRoute(s, DE_ID));
  });
});
