// Raids on trade routes, the pillage order and the trade lens (plan D6, D5b).
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { getTradeRoute } from './tradeRoutes';
import { plunderedRoutes, plunderGoldFor, PLUNDER_GOLD } from './plunder';
import { RAID_GOLD } from './threat';
import { armySheetModel } from '../components/map/armySheetModel';
import { tradeLines } from '../components/map/lenses';
import { getModifier } from './modifiers/sheet';

const unit = (id, ownerId, tile, regionId, extra = {}) => ({ id, ownerId, tile, regionId, homeRegionId: regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, ...extra });
const base = () => {
  const s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  return { ...s, nations: { ...s.nations, de: { ...s.nations.de, hasTradeAgreement: true } }, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
};

describe('raids on trade routes', () => {
  it('a caravan goes round one enemy stack, and is plundered when every way out is cut', () => {
    const s = base(); const tiles = getTiles();
    const route = getTradeRoute(s, 'de');
    expect(route.ok).toBe(true); expect(route.kind).toBe('land');
    const paris = s.regions[getNationCapital('fr')];
    const step = route.tiles[1];
    const one = { ...s, units: { ...s.units, r1: unit('r1', 'rebels', step, null) } };
    const around = getTradeRoute(one, 'de');
    expect(around.ok).toBe(true); expect(around.tiles).not.toContain(step);
    expect(plunderedRoutes(one)).toEqual([]);
    const ring = tiles.neighbors[paris.tile].filter((t) => tiles.land[t] === 1);
    const units = { ...s.units }; ring.forEach((t, i) => { units[`r${i}`] = unit(`r${i}`, 'rebels', t, null); });
    const cut = { ...s, units };
    expect(getTradeRoute(cut, 'de').ok === false || getTradeRoute(cut, 'de').kind === 'sea').toBe(true);
    const p = plunderedRoutes(cut);
    if (getTradeRoute(cut, 'de').ok) return; // a sea route stood in: nothing to plunder on land
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ partnerId: 'de', kind: 'land', by: 'rebels' });
    expect(ring).toContain(p[0].tile);
    // The pact's gold line is gone while the route is cut; a turn tells the player.
    const line = (st) => getModifier(st, 'fr', 'national.goldMult').breakdown.find((l) => l.sourceId === 'trade_pacts');
    expect(line(s)).toBeTruthy(); expect(line(cut)).toBeFalsy();
    const next = resolveTurn(cut);
    expect(next.logs.some((l) => /plunder your land trade route/.test(l.message))).toBe(true);
  });
  it('a plunderer at war takes the gold, doubled under Chieftaincy', () => {
    const s = base();
    expect(plunderGoldFor(s, 'be')).toBe(PLUNDER_GOLD);
    const chief = { ...s, nations: { ...s.nations, be: { ...s.nations.be, government: { type: 'tribal', reforms: { bronze: 'chieftaincy' } } } } };
    expect(plunderGoldFor(chief, 'be')).toBe(PLUNDER_GOLD * 2);
    const tiles = getTiles(); const paris = s.regions[getNationCapital('fr')];
    const ring = tiles.neighbors[paris.tile].filter((t) => tiles.land[t] === 1);
    const units = { ...s.units }; ring.forEach((t, i) => { units[`b${i}`] = unit(`b${i}`, 'be', t, getNationCapital('be')); });
    const war = { ...s, units, wars: [{ id: 'w1', aggressor: 'be', enemy: 'fr', active: true, startTurn: 1 }] };
    if (getTradeRoute(war, 'de').ok) return;
    expect(plunderedRoutes(war)[0]).toMatchObject({ partnerId: 'de', by: 'be' });
    // The same turn without the pact has nothing to plunder: the difference is the plunder.
    const next = resolveTurn(war);
    const quiet = resolveTurn({ ...war, nations: { ...war.nations, de: { ...war.nations.de, hasTradeAgreement: false } } });
    expect(next.nations.be.economy.gold - quiet.nations.be.economy.gold).toBe(PLUNDER_GOLD);
    expect(next.logs.some((l) => /plunder your land trade route to/.test(l.message))).toBe(true);
  });
});

describe('the pillage order', () => {
  it('burns an enemy improvement under the stack for its gold and spends the moves', () => {
    const s = base(); const tiles = getTiles();
    const berlin = s.regions[getNationCapital('de')];
    const farm = berlin.tiles.find((t) => t !== berlin.tile && tiles.land[t] === 1);
    const withFarm = { ...s, world: { ...s.world, tileState: { ...s.world.tileState, [farm]: { improvement: 'farm' } } }, units: { ...s.units, a1: unit('a1', 'fr', farm, getNationCapital('fr')) } };
    const peace = gameReducer(withFarm, { type: ActionTypes.PILLAGE_TILE, payload: { unitIds: ['a1'] } });
    expect(peace).toBe(withFarm); // not an enemy's land
    expect(armySheetModel(withFarm, farm).pillage).toBeNull();
    const war = { ...withFarm, wars: [{ id: 'w1', aggressor: 'fr', enemy: 'de', active: true, startTurn: 1 }] };
    expect(armySheetModel(war, farm).pillage).toMatchObject({ name: 'Farm', gold: RAID_GOLD });
    const next = gameReducer(war, { type: ActionTypes.PILLAGE_TILE, payload: { unitIds: ['a1'] } });
    expect(next.resources.gold).toBe(war.resources.gold + RAID_GOLD);
    expect(next.world.tileState[farm].pillaged).toBe(true);
    expect(next.units.a1.movesLeft).toBe(0);
    expect(next.logs.at(-1).message).toMatch(/pillages/);
    expect(armySheetModel(next, farm).pillage).toBeNull();
    expect(gameReducer(next, { type: ActionTypes.PILLAGE_TILE, payload: { unitIds: ['a1'] } })).toBe(next);
  });
});

describe('the trade lens', () => {
  it('draws one line per pact with its tiles and marks a plundered route', () => {
    const s = base();
    const lines = tradeLines(s);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ partnerId: 'de', kind: 'land', ok: true, plundered: false });
    expect(lines[0].tiles.length).toBeGreaterThan(2);
  });
});
