// Auto against a city, Civilization style (cityAssault.js; the user's rule of 14 October): the
// garrison first and never a capture; an empty city through its defences, taken when an attack
// brings its HP to 0; Command still takes a city it wins.
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNeighborIds, getTouchingIds } from '../data/regions';
import { addCity, addCities } from './testWorld';
import { syncWorldRegistry } from './world/registry';
import { applyBattleOutcome, makeBattleOutcome } from './battleOutcome';
import { pendingCapturesOf } from './capture';
import { siegeMaxHp } from './sieges';
import { createRng } from '../utils/rng';
import { auditGameState } from './stateAudit';
import { estimateInvasionOdds } from './battleOdds';
import {
  cityAttackStrength, cityDefence, cityAttackDamage, attacksToTake, garrisonOf,
  CITY_HIT_HP, MAX_RATIO, MIN_RATIO, CITY_STRIKE_CAP
} from './cityAssault';
import { neighbourWorld } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 1, age: 'bronze' });
const FR_ID = PEOPLES_WORLD.playerNationId;

const WORLD = (() => {
  const first = addCity(neighbourWorld({ seed: 1, age: 'bronze' }), FR_ID);
  const target = getTouchingIds(first.cityId).find((id) => first.state.regions[id].owner !== FR_ID) || getNeighborIds(first.cityId).find((id) => first.state.regions[id].owner !== FR_ID);
  const near = addCity(first.state, FR_ID, { near: target });
  const AGG = near.state.regions[target].owner;
  const grown = addCities(near.state, AGG, 3);
  return { state: grown.state, FR: first.cityId, T: target, AGG };
})();
const { FR, T, AGG } = WORLD;
const unit = (id, regionId, ownerId, classId = 'infantry', strength = 1000) => ({
  id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1
});
const setup = (units, cityPatch = {}) => {
  const s = syncWorldRegistry(WORLD.state);
  return {
    ...s,
    resources: { ...s.resources, gold: 99999, mil: 9999, adm: 9999, dip: 9999 },
    regions: { ...s.regions, [T]: { ...s.regions[T], ...cityPatch } },
    nations: { ...s.nations, [FR_ID]: { ...s.nations[FR_ID], isAtWar: true }, [AGG]: { ...s.nations[AGG], isAtWar: true } },
    wars: [...s.wars, { id: 'war_t', aggressor: FR_ID, enemy: AGG, active: true, startTurn: s.turnNumber, battleScore: 0 }],
    units
  };
};
const army = (n, cls = 'infantry') => Object.fromEntries(Array.from({ length: n }, (_, i) => [`a${i}`, unit(`a${i}`, FR, FR_ID, i === 0 ? 'infantry' : cls)]));
const attack = (s) => gameReducer(s, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR, targetRegionId: T } });
const city = (size, walls) => ({ id: 'c', size, buildings: { categories: { defense: walls - 1 } } });

describe('the formula', () => {
  it('damage grows with the attack over the defence, held between the ratio bounds', () => {
    expect(cityAttackDamage(1000, 1000)).toBe(CITY_HIT_HP);
    expect(cityAttackDamage(100000, 1)).toBeCloseTo(cityAttackDamage(MAX_RATIO, 1));
    expect(cityAttackDamage(1, 100000)).toBeCloseTo(cityAttackDamage(MIN_RATIO, 1));
    expect(cityAttackDamage(4000, 1000)).toBeGreaterThan(cityAttackDamage(2000, 1000));
  });

  it('walls, size and militia raise the defence; battered walls count half; siege engines hit harder', () => {
    expect(cityDefence(city(3, 1))).toBeGreaterThan(cityDefence(city(3, 0)));
    expect(cityDefence(city(6, 0))).toBeGreaterThan(cityDefence(city(3, 0)));
    expect(cityDefence(city(3, 1), { hpRatio: 0 })).toBeLessThan(cityDefence(city(3, 1)));
    expect(cityDefence(city(3, 0), { militia: [{ strength: 200 }] })).toBe(cityDefence(city(3, 0)) + 200);
    const inf = [unit('i', FR, FR_ID)]; const eng = [unit('e', FR, FR_ID, 'siege')]; const cav = [unit('c', FR, FR_ID, 'cavalry')];
    expect(cityAttackStrength(eng)).toBeGreaterThan(cityAttackStrength(inf));
    expect(cityAttackStrength(cav)).toBeLessThan(cityAttackStrength(inf));
  });

  it('a Bronze city of size 3 behind a Palisade needs a few attacks of four regiments; an open size-2 town falls to one', () => {
    const four = Object.values(army(4));
    const walled = attacksToTake({}, city(3, 1), cityAttackStrength(four));
    expect(walled).toBeGreaterThanOrEqual(3);
    expect(walled).toBeLessThanOrEqual(4);
    expect(attacksToTake({}, city(2, 0), cityAttackStrength(four))).toBe(1);
    expect(attacksToTake({}, city(2, 0), cityAttackStrength(Object.values(army(2))))).toBeGreaterThan(1);
  });

  it('the garrison is the land units in the city, never the militia or aircraft', () => {
    expect(garrisonOf([{ strength: 100, militia: true }, { strength: 100, classId: 'air' }, { strength: 0, classId: 'infantry' }])).toHaveLength(0);
    expect(garrisonOf([{ strength: 100, classId: 'infantry' }])).toHaveLength(1);
  });
});

describe('Auto against a city', () => {
  it('with units in it, Auto fights them and never takes the city, however it goes', () => {
    const s = setup({ ...army(8), d1: unit('d1', T, AGG, 'infantry', 300) });
    const next = attack(s);
    expect(next.regions[T].owner).toBe(AGG);
    expect(pendingCapturesOf(next)).toHaveLength(0);
    expect(next.battleReports[0].captured).toBe(false);
    // An overwhelming win damages or destroys the garrison.
    expect(next.units.d1?.strength ?? 0).toBeLessThan(300);
    expect(auditGameState(next).filter((v) => v.kind === 'battle_ledger')).toEqual([]);
  });

  it('an empty city at full HP is battered, not taken; its HP lives on the siege record and the ledger balances', () => {
    const s = setup(army(3), { buildings: { ...WORLD.state.regions[T].buildings, categories: { ...WORLD.state.regions[T].buildings?.categories, defense: 0 } } });
    const next = attack(s);
    const c = next.regions[T];
    expect(c.owner).toBe(AGG);
    expect(c.siege.hp).toBeLessThan(siegeMaxHp(c));
    expect(c.siege.hp).toBeGreaterThan(0);
    expect(next.logs.some((l) => /its defences fall from/.test(l.message))).toBe(true);
    // The city strikes back: the attackers lose men, never more than the cap.
    const before = Object.values(s.units).reduce((a, u) => a + u.strength, 0);
    const after = Object.values(next.units).filter((u) => u.ownerId === FR_ID).reduce((a, u) => a + u.strength, 0);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThanOrEqual(Math.floor(before * (1 - CITY_STRIKE_CAP)));
    expect(auditGameState(next).filter((v) => v.kind === 'battle_ledger')).toEqual([]);
  });

  it('the attack that brings an empty city to 0 HP takes it, and the player gets the capture card', () => {
    const s = setup(army(3), { siege: { hp: 3, maxHp: 400, by: null, startedTurn: 1, encircled: false } });
    const next = attack(s);
    expect(next.regions[T].owner).toBe(FR_ID);
    expect(pendingCapturesOf(next)).toHaveLength(1);
    expect(pendingCapturesOf(next)[0]).toMatchObject({ cityId: T, source: 'battle' });
  });

  it('the odds say how Auto treats the city', () => {
    expect(estimateInvasionOdds(setup({ ...army(3), d1: unit('d1', T, AGG) }), FR, T, 10).autoRule).toBe('garrison');
    const empty = estimateInvasionOdds(setup(army(3)), FR, T, 10);
    expect(empty.autoRule).toBe('attack');
    expect(empty.city.hpAfter).toBeLessThan(empty.city.hpBefore);
  });

  it('is deterministic: the same state and seed give the same result', () => {
    const s = setup(army(3));
    expect(attack(s).regions[T].siege).toEqual(attack(s).regions[T].siege);
    expect(createRng(5).next()).toBe(createRng(5).next());
  });
});

describe('Command takes a city it wins, garrison or not', () => {
  it('a commanded win against a garrison takes the city and opens the card', () => {
    const s = setup({ ...army(3), d1: unit('d1', T, AGG) });
    const o = makeBattleOutcome({ id: 'cmd1', kind: 'invasion', mode: 'command', warId: 'war_t', attackerNationId: FR_ID, defenderNationId: AGG, fromRegionId: FR, regionId: T, tile: s.regions[T].tile, isDefended: true, decisive: true },
      { outcome: 'attacker', attackerUnits: Object.values(s.units).filter((u) => u.ownerId === FR_ID), defenderUnits: [{ ...s.units.d1, strength: 0 }], report: { tactical: { mode: 'command', decisive: true } } });
    const won = applyBattleOutcome(s, o);
    expect(won.regions[T].owner).toBe(FR_ID);
    expect(pendingCapturesOf(won)).toHaveLength(1);
  });
});
