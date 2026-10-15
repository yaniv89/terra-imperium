// The Dawn bridge's last readers on the tile world (plans/civ-map-rework.md, workstream 13):
// reinforcements by tile distance, the garrison's fallback to the nearest held city, the siege's
// protecting fort from lands that touch, trade routes as caravan paths over tiles.
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../context/GameContext';
import { getTiles } from '../data/geo/tiles';
import { getCapital, getNeighborIds, getTouchingIds } from '../data/regions';
import { getReinforcementSources } from './invasion';
import { getWithdrawalTarget } from './defense';
import { getZoneOfControlMultiplier, ZOC_FORT_LEVEL_THRESHOLD } from './siege';
import { findCaravanPath, getTradeRoute, TRADE_ROUTE_MAX_TILES } from './tradeRoutes';
import { unitsWithinRings, nearestHeldCity, REINFORCE_RINGS, FALLBACK_RINGS } from './armies';
import { addCity } from './testWorld';
import { ringDistance } from './world/cities';

const base = () => createInitialState({ playerNationId: 'fr', rngSeed: 11 });
const unit = (id, regionId, ownerId, tile, extra = {}) => ({ id, regionId, ownerId, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, ...extra });
const tileAtRings = (tiles, centre, rings) => {
  let frontier = [centre]; const seen = new Set(frontier);
  for (let d = 1; d <= rings; d++) { const next = []; frontier.forEach((t) => tiles.neighbors[t].forEach((n) => { if (!seen.has(n)) { seen.add(n); next.push(n); } })); frontier = next; }
  return frontier.find((t) => tiles.land[t] === 1);
};

describe('reinforcements by tile distance', () => {
  it('counts idle troops within REINFORCE_RINGS of the city centre and not the garrison or the origin', () => {
    const s = base(); const tiles = getTiles();
    const target = getCapital(s, 'de'); const centre = s.regions[target].tile;
    const paris = getCapital(s, 'fr');
    const near = tileAtRings(tiles, centre, 2); const far = tileAtRings(tiles, centre, REINFORCE_RINGS + 2);
    const units = { n1: unit('n1', paris, 'fr', near), f1: unit('f1', paris, 'fr', far), g1: unit('g1', target, 'de', centre), o1: unit('o1', 'origin', 'fr', near), spent: unit('s1', paris, 'fr', near, { movesLeft: 0 }) };
    const withUnits = { ...s, units };
    expect(unitsWithinRings(withUnits, centre, 'fr', REINFORCE_RINGS).map((u) => u.id)).toEqual(['n1', 'o1', 's1']);
    const sources = getReinforcementSources(withUnits, target, 'fr', ['origin']);
    expect(sources).toEqual([{ regionId: paris, unitIds: ['n1'] }]);
    expect(getReinforcementSources(withUnits, target, 'de')).toEqual([]);
  });
});

describe('the garrison falls back to the nearest held city', () => {
  it('finds a second French city near Paris and nothing when there is none in reach', () => {
    const s = base(); const paris = getCapital(s, 'fr');
    expect(getWithdrawalTarget(s, paris)).toBeNull();
    const { state, cityId } = addCity(s, 'fr', { near: paris });
    expect(ringDistance(getTiles(), state.regions[paris].tile, state.regions[cityId].tile, FALLBACK_RINGS)).toBeLessThanOrEqual(FALLBACK_RINGS);
    expect(getWithdrawalTarget(state, paris)).toBe(cityId);
    expect(nearestHeldCity(state, cityId, 'fr')).toBe(paris);
    const occupied = { ...state, regions: { ...state.regions, [cityId]: { ...state.regions[cityId], occupiedBy: 'de' } } };
    expect(getWithdrawalTarget(occupied, paris)).toBeNull();
  });
});

describe('the protecting fort reads lands that touch', () => {
  it('a fort in a bridged neighbour that does not touch gives no cover', () => {
    const s = base(); const paris = getCapital(s, 'fr');
    const bridged = getNeighborIds(paris).find((id) => !getTouchingIds(paris).includes(id));
    expect(bridged).toBeDefined();
    const regions = { ...s.regions, [bridged]: { ...s.regions[bridged], owner: 'fr', defenseLevel: ZOC_FORT_LEVEL_THRESHOLD } };
    expect(getZoneOfControlMultiplier(regions, paris, 'fr')).toBe(1);
  });
});

describe('trade routes as caravan paths', () => {
  it('walks the tiles from capital to capital, bounded, and is closed by a war on the way', () => {
    const s = base(); const tiles = getTiles();
    const paris = s.regions[getCapital(s, 'fr')].tile; const berlin = s.regions[getCapital(s, 'de')].tile;
    const route = getTradeRoute(s, 'de');
    expect(route.ok).toBe(true); expect(route.kind).toBe('land');
    expect(route.tiles[0]).toBe(paris); expect(route.tiles[route.tiles.length - 1]).toBe(berlin);
    expect(route.tiles.length).toBeLessThanOrEqual(TRADE_ROUTE_MAX_TILES + 1);
    route.tiles.forEach((t, i) => { expect(tiles.land[t]).toBe(1); if (i) expect(tiles.neighbors[route.tiles[i - 1]]).toContain(t); });
    expect(findCaravanPath(s, paris, berlin, () => false)).toBeNull();
    // A war with every nation whose land the caravan crosses closes the land route.
    const crossed = route.regions.map((id) => s.regions[id].owner).filter((o) => o !== 'fr' && o !== 'de');
    const wars = crossed.map((o, i) => ({ id: `w${i}`, aggressor: 'fr', enemy: o, active: true }));
    const atWar = { ...s, wars };
    const after = getTradeRoute(atWar, 'de');
    if (crossed.length) expect(after.kind === 'land' ? after.regions.map((id) => s.regions[id].owner).some((o) => crossed.includes(o)) : true).toBe(false);
    expect(getTradeRoute({ ...s, wars: [{ id: 'w', aggressor: 'de', enemy: 'fr', active: true }] }, 'de').ok).toBe(false);
  });
  it('memoises per state parts and recomputes when they change', () => {
    const s = base();
    expect(getTradeRoute(s, 'de')).toBe(getTradeRoute(s, 'de'));
    expect(getTradeRoute({ ...s, wars: [] }, 'de')).not.toBe(getTradeRoute(s, 'de'));
  });
});
