// src/engine/sieges.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { assertGameState } from './stateAudit';
import { allocateTiles, cityYields } from './world/cities';
import {
  wallsOf, siegeMaxHp, besiegersOf, siegeStrength, isEncircled, processSieges,
  SIEGE_HP_BASE, SIEGE_STRENGTH_OTHER, SIEGE_STRENGTH_SIEGE, WALL_REGEN, ENCIRCLE_MULT, SIEGE_HEAL
} from './sieges';

const tiles = getTiles();
const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = (() => { const s = quiet(createInitialState({ playerNationId: 'in', rngSeed: 3 })); return { ...s, units: {} }; })();
const IN = getNationCapital('in');
const PK = getNationCapital('pk');
const unit = (id, regionId, extra = {}) => ({ id, ownerId: 'in', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWar = (s, enemy) => ({ ...s, wars: [...s.wars, { id: 'w-siege', aggressor: 'in', enemy, active: true, startYear: s.year, battleScore: 0 }], nations: { ...s.nations, in: { ...s.nations.in, isAtWar: true }, [enemy]: { ...s.nations[enemy], isAtWar: true } } });
const ring1Land = (city) => tiles.neighbors[city.tile].filter((t) => tiles.land[t] === 1);

describe('walls and HP', () => {
  it('reads walls from the Defense line and scales HP by walls and size', () => {
    const city = S.regions[PK];
    expect(wallsOf(city)).toBe(0);
    expect(siegeMaxHp(city)).toBe(Math.round(SIEGE_HP_BASE * (1 + city.size / 10)));
    const walled = { ...city, buildings: { ...city.buildings, categories: { ...city.buildings.categories, defense: 1 } } };
    expect(wallsOf(walled)).toBe(2);
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
    const war = atWar(withUnits(S, [unit('a', IN, { tile: t0 }), unit('b', IN, { tile: t1, classId: 'siege' }), unit('far', IN)]), 'pk');
    const by = besiegersOf(war, city);
    expect(by.get('in').map((u) => u.id).sort()).toEqual(['a', 'b']);
    expect(siegeStrength(war, 'in', by.get('in'))).toBe(SIEGE_STRENGTH_OTHER + SIEGE_STRENGTH_SIEGE);
    expect(isEncircled(war, city, 'in')).toBe(false);
    const all = atWar(withUnits(S, ring1Land(city).map((t, i) => unit(`r${i}`, IN, { tile: t }))), 'pk');
    expect(isEncircled(all, city, 'in')).toBe(tiles.neighbors[city.tile].every((t) => tiles.land[t] === 1 || tiles.terrainOf(t) === 'lake'));
  });

  it('grinds HP turn by turn, heals when lifted, and starves an encircled city', () => {
    const city = S.regions[PK];
    const [t0] = ring1Land(city);
    const war = atWar(withUnits(S, [unit('a', IN, { tile: t0 }), unit('b', IN, { tile: t0, classId: 'siege' })]), 'pk');
    const regions = { ...war.regions };
    const r1 = processSieges(war, regions, war.units, { turn: 2 });
    expect(r1.fallen).toEqual([]);
    expect(regions[PK].siege.hp).toBe(siegeMaxHp(city) - (SIEGE_STRENGTH_OTHER + SIEGE_STRENGTH_SIEGE - WALL_REGEN * wallsOf(city)));
    expect(regions[PK].siege.by).toBe('in');
    expect(r1.logs.some((l) => l.nationId === 'pk' && /under siege/.test(l.message))).toBe(true);
    // Walls regen: a Stone Walls city takes less.
    const walledRegions = { ...war.regions, [PK]: { ...city, buildings: { ...city.buildings, categories: { ...city.buildings.categories, defense: 1 } } } };
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
    // Encircled (every land neighbour held, no water): double damage, and the city shrinks after four turns.
    const ringUnits = ring1Land(city).map((t, i) => unit(`r${i}`, IN, { tile: t }));
    const ringWar = atWar(withUnits(S, ringUnits), 'pk');
    const noWater = tiles.neighbors[city.tile].every((t) => tiles.land[t] === 1 || tiles.terrainOf(t) === 'lake');
    if (noWater) {
      const enc = { ...ringWar.regions };
      processSieges(ringWar, enc, ringWar.units, { turn: 2 });
      expect(enc[PK].siege.encircled).toBe(true);
      expect(siegeMaxHp(city) - enc[PK].siege.hp).toBe(SIEGE_STRENGTH_OTHER * ringUnits.length * ENCIRCLE_MULT);
      let st = { ...ringWar, regions: enc };
      for (let i = 0; i < 4; i++) { const r = { ...st.regions }; processSieges(st, r, st.units, { turn: 3 + i }); st = { ...st, regions: r }; }
      expect(st.regions[PK].size).toBe(Math.max(1, city.size - 1));
    }
  });

  it('a besieged city works its first ring only', () => {
    const city = S.regions[PK];
    const world = { cities: S.regions, tileOwner: S.world.tileOwner, tileState: S.world.tileState };
    const big = { ...city, size: 6, tiles: [...city.tiles, ...tiles.neighbors[city.tiles[1]].filter((t) => tiles.land[t] && !S.world.tileOwner[t]).slice(0, 3)] };
    const w2 = { ...world, tileOwner: { ...world.tileOwner, ...Object.fromEntries(big.tiles.map((t) => [t, PK])) } };
    const worked = allocateTiles(big, tiles, w2);
    const open = cityYields(big, tiles, w2, worked);
    const besieged = cityYields({ ...big, siege: { hp: 10, maxHp: 100, by: 'in' } }, tiles, w2, worked);
    expect(besieged.raw.food + besieged.raw.production + besieged.raw.gold).toBeLessThanOrEqual(open.raw.food + open.raw.production + open.raw.gold);
  });

  it('through resolveTurn: an army beside an enemy city lays siege, and the city falls to it at 0 HP', () => {
    const city = S.regions[PK];
    const stack = ring1Land(city).slice(0, 2).flatMap((t, i) => [unit(`s${i}a`, IN, { tile: t, classId: 'siege' }), unit(`s${i}b`, IN, { tile: t, classId: 'siege' })]);
    let s = atWar(withUnits(S, stack), 'pk');
    s = resolveTurn(s);
    expect(s.regions[PK].siege).toBeTruthy();
    expect(s.regions[PK].siege.by).toBe('in');
    expect(s.logs.some((l) => /lays siege to/.test(l.message))).toBe(true);
    assertGameState(s);
    for (let i = 0; i < 40 && s.regions[PK].owner === 'pk'; i++) {
      if (s.pendingPeaceOffer) s = gameReducer(s, { type: ActionTypes.REJECT_PENDING_PEACE });
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
    }
    expect(s.regions[PK].owner).toBe('in');
    expect(s.regions[PK].siege).toBe(null);
    expect(s.logs.some((l) => /surrenders to your siege/.test(l.message))).toBe(true);
    assertGameState(s);
  }, 60000);
});
