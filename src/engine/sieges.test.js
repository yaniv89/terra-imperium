// src/engine/sieges.test.js
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { assertGameState } from './stateAudit';
import { allocateTiles, cityYields, SIEGE_YIELD_MULT } from './world/cities';
import {
  wallsOf, siegeMaxHp, besiegersOf, besiegesCity, siegeStrength, isEncircled, processSieges,
  SIEGE_HP_BASE, SIEGE_STRENGTH_OTHER, SIEGE_STRENGTH_SIEGE, WALL_REGEN, ENCIRCLE_MULT, SIEGE_HEAL
} from './sieges';
import { peoplesWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 3 });
const IN_ID = PEOPLES_WORLD.playerNationId;
const PK_ID = rivalOf(PEOPLES_WORLD, 0);

const tiles = getTiles();
const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = (() => { const s = quiet(peoplesWorld({ seed: 3 })); return { ...s, units: {} }; })();
const IN = getNationCapital(IN_ID);
const PK = getNationCapital(PK_ID);
const unit = (id, regionId, extra = {}) => ({ id, ownerId: IN_ID, regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWar = (s, enemy) => ({ ...s, wars: [...s.wars, { id: 'w-siege', aggressor: IN_ID, enemy, active: true, startYear: s.year, battleScore: 0 }], nations: { ...s.nations, [IN_ID]: { ...s.nations[IN_ID], isAtWar: true }, [enemy]: { ...s.nations[enemy], isAtWar: true } } });
const ring1Land = (city) => tiles.neighbors[city.tile].filter((t) => tiles.land[t] === 1);

describe('walls and HP', () => {
  it('reads walls from the Defense line and scales HP by walls and size', () => {
    const city = S.regions[PK];
    expect(wallsOf(city)).toBe(0);
    expect(siegeMaxHp(city)).toBe(Math.round(SIEGE_HP_BASE * (1 + city.size / 10)));
    const walled = { ...city, buildings: { ...city.buildings, categories: { ...city.buildings.categories, defense: 2 } } };
    expect(wallsOf(walled)).toBe(2);
    expect(wallsOf({ ...city, buildings: { categories: { defense: 0 } } })).toBe(1); // the Earthwork Ditch
    expect(siegeMaxHp(walled)).toBe(Math.round(SIEGE_HP_BASE * 3 * (1 + city.size / 10)));
    expect(wallsOf({ ...city, buildings: { categories: { defense: 3 } } })).toBe(3);
  });
});

describe('a siege', () => {
  it('counts the enemies beside the city, their siege strength, and encirclement', () => {
    const city = S.regions[PK];
    const [t0, t1] = ring1Land(city);
    const peace = withUnits(S, [unit('a', IN, { tile: t0 })]);
    expect(besiegersOf(peace, city).size).toBe(0); // at peace nobody besieges
    const war = atWar(withUnits(S, [unit('a', IN, { tile: t0 }), unit('b', IN, { tile: t1, classId: 'siege' }), unit('far', IN)]), PK_ID);
    const by = besiegersOf(war, city);
    expect(by.get(IN_ID).map((u) => u.id).sort()).toEqual(['a', 'b']);
    expect(siegeStrength(war, IN_ID, by.get(IN_ID))).toBe(SIEGE_STRENGTH_OTHER + SIEGE_STRENGTH_SIEGE);
    expect(isEncircled(war, city, IN_ID)).toBe(false);
    const all = atWar(withUnits(S, ring1Land(city).map((t, i) => unit(`r${i}`, IN, { tile: t }))), PK_ID);
    expect(isEncircled(all, city, IN_ID)).toBe(tiles.neighbors[city.tile].every((t) => tiles.land[t] === 1 || tiles.terrainOf(t) === 'lake'));
  });

  it('grinds HP turn by turn, heals when lifted, and never starves an encircled city', () => {
    const city = S.regions[PK];
    const [t0] = ring1Land(city);
    const war = atWar(withUnits(S, [unit('a', IN, { tile: t0 }), unit('b', IN, { tile: t0, classId: 'siege' })]), PK_ID);
    const regions = { ...war.regions };
    const r1 = processSieges(war, regions, war.units, { turn: 2 });
    expect(r1.fallen).toBeUndefined(); // a siege never takes a city
    expect(regions[PK].siege.hp).toBe(siegeMaxHp(city) - (SIEGE_STRENGTH_OTHER + SIEGE_STRENGTH_SIEGE - WALL_REGEN * wallsOf(city)));
    expect(regions[PK].siege.by).toBe(IN_ID);
    expect(r1.logs.some((l) => l.nationId === PK_ID && /under siege/.test(l.message))).toBe(true);
    // Walls regen: a Stone Walls city takes less.
    const walledRegions = { ...war.regions, [PK]: { ...city, buildings: { ...city.buildings, categories: { ...city.buildings.categories, defense: 2 } } } };
    processSieges(war, walledRegions, war.units, { turn: 2 });
    expect(siegeMaxHp(walledRegions[PK]) - walledRegions[PK].siege.hp).toBe(SIEGE_STRENGTH_OTHER + SIEGE_STRENGTH_SIEGE - WALL_REGEN * 2);
    // Lifted: it heals a tenth a turn and the record goes once full.
    const lifted = { ...regions, [PK]: { ...regions[PK], siege: { ...regions[PK].siege, hp: Math.round(siegeMaxHp(city) / 2) } } };
    processSieges({ ...war, units: {} }, lifted, {}, { turn: 3 });
    expect(lifted[PK].siege.hp).toBe(Math.round(siegeMaxHp(city) / 2) + Math.round(siegeMaxHp(city) * SIEGE_HEAL));
    expect(lifted[PK].siege.by).toBe(null);
    const full = { ...lifted, [PK]: { ...lifted[PK], siege: { ...lifted[PK].siege, hp: siegeMaxHp(city) - 1 } } };
    processSieges({ ...war, units: {} }, full, {}, { turn: 4 });
    expect(full[PK].siege).toBe(null);
    // Encircled (every land neighbour held, no water): double damage, but the city never shrinks or falls.
    const ringUnits = ring1Land(city).map((t, i) => unit(`r${i}`, IN, { tile: t }));
    const ringWar = atWar(withUnits(S, ringUnits), PK_ID);
    const noWater = tiles.neighbors[city.tile].every((t) => tiles.land[t] === 1 || tiles.terrainOf(t) === 'lake');
    if (noWater) {
      const enc = { ...ringWar.regions };
      processSieges(ringWar, enc, ringWar.units, { turn: 2 });
      expect(enc[PK].siege.encircled).toBe(true);
      expect(siegeMaxHp(city) - enc[PK].siege.hp).toBe(SIEGE_STRENGTH_OTHER * ringUnits.length * ENCIRCLE_MULT);
      let st = { ...ringWar, regions: enc };
      for (let i = 0; i < 4; i++) { const r = { ...st.regions }; processSieges(st, r, st.units, { turn: 3 + i }); st = { ...st, regions: r }; }
      expect(st.regions[PK].size).toBe(city.size);
      expect(st.regions[PK].owner).toBe(PK_ID);
    }
  });

  it('a besieged city loses production and taxes, not food', () => {
    const city = S.regions[PK];
    const world = { cities: S.regions, tileOwner: S.world.tileOwner, tileState: S.world.tileState };
    const big = { ...city, size: 6, tiles: [...city.tiles, ...tiles.neighbors[city.tiles[1]].filter((t) => tiles.land[t] && !S.world.tileOwner[t]).slice(0, 3)] };
    const w2 = { ...world, tileOwner: { ...world.tileOwner, ...Object.fromEntries(big.tiles.map((t) => [t, PK])) } };
    const worked = allocateTiles(big, tiles, w2);
    const open = cityYields(big, tiles, w2, worked);
    const besieged = cityYields({ ...big, siege: { hp: 10, maxHp: 100, by: IN_ID } }, tiles, w2, worked);
    expect(besieged.raw.food).toBe(open.raw.food);
    expect(besieged.raw.production).toBeLessThan(open.raw.production);
    expect(besieged.raw.gold).toBeLessThan(open.raw.gold);
    expect(besieged.raw.production).toBeLessThanOrEqual(open.raw.production * SIEGE_YIELD_MULT);
    // A battered city whose siege was lifted (no besiegers) works normally while it heals.
    const healing = cityYields({ ...big, siege: { hp: 10, maxHp: 100, by: null } }, tiles, w2, worked);
    expect(healing.raw).toEqual(open.raw);
  });

  it('through resolveTurn: a siege grinds the walls to 0 HP but never takes the city', () => {
    const city = S.regions[PK];
    const stack = ring1Land(city).slice(0, 2).flatMap((t, i) => [unit(`s${i}a`, IN, { tile: t, classId: 'siege' }), unit(`s${i}b`, IN, { tile: t, classId: 'siege' })]);
    let s = atWar(withUnits(S, stack), PK_ID);
    s = resolveTurn(s);
    expect(s.regions[PK].siege).toBeTruthy();
    expect(s.regions[PK].siege.by).toBe(IN_ID);
    expect(s.logs.some((l) => /lays siege to/.test(l.message))).toBe(true);
    assertGameState(s);
    let minHp = Infinity; let turnsAtZero = 0;
    for (let i = 0; i < 25; i++) {
      if (s.pendingPeaceOffer) s = gameReducer(s, { type: ActionTypes.REJECT_PENDING_PEACE });
      // Keep the besiegers there (the defenders may sally against them): this tests the siege alone.
      s = { ...s, units: { ...s.units, ...Object.fromEntries(stack.map((u) => [u.id, { ...u, movesLeft: 1 }])) }, pendingDefenses: [] };
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      expect(s.regions[PK].owner).toBe(PK_ID);
      minHp = Math.min(minHp, s.regions[PK].siege?.hp ?? Infinity);
      if (s.regions[PK].siege?.hp === 0) turnsAtZero += 1;
    }
    expect(minHp).toBe(0);
    expect(turnsAtZero).toBeGreaterThan(1); // it stays at 0 and is still not taken
    expect(s.logs.some((l) => /A siege never takes a city/.test(l.message))).toBe(true);
    assertGameState(s);
  }, 60000);
});

describe('a campaign siege force on an independent (I125)', () => {
  it('besieges the city of the independent it is tagged for, by the nation id the campaign stores', () => {
    const state = { turnNumber: 5, wars: [], nations: { ind: { id: 'ind', kind: 'independent', indep: {} }, maj: { id: 'maj' } } };
    const city = { id: 'city_42', owner: 'ind', tile: 1 };
    expect(besiegesCity(state, { ownerId: 'maj', indepOp: 'ind' }, city)).toBe(true);
    expect(besiegesCity(state, { ownerId: 'maj', indepOp: 'other' }, city)).toBe(false);
    expect(besiegesCity(state, { ownerId: 'maj' }, city)).toBe(false);
  });
});
