import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { cap } from './testWorld';
import { cityManifestOf, cityManifestInput, carryBattleDamage, applyCityBattleDamage, repairCityDamage, cityHousingCap, manifestStates, REPAIR_TURNS, RUIN_TURNS } from './cityManifest';
import { buildTownManifest, TOWNHALL_HOUSING } from '../data/townLayout';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';

const manifest = buildTownManifest({ cityId: 'c', ageId: 'bronze', tierId: 'medium', seed: 3, defenseTier: 1, buildings: { culture: 1, economy: 0, food: 0, science: 0 } });
const houses = manifest.structures.filter((s) => s.kind === 'house').map((s) => s.id);

describe('carryBattleDamage: conquest keeps half the city (master plan 6.8)', () => {
  it('ruins at most half the houses; the rest are only damaged', () => {
    const out = carryBattleDamage({ manifest, report: { destroyed: houses, damaged: [] }, size: 8 });
    const ruined = Object.keys(out.damage.ruined);
    expect(ruined).toHaveLength(Math.floor(houses.length / 2));
    expect(Object.keys(out.damage.damaged)).toHaveLength(houses.length - ruined.length);
    Object.values(out.damage.damaged).forEach((t) => expect(t).toBe(REPAIR_TURNS));
    expect(out.damage.ruined[ruined[0]]).toBe(RUIN_TURNS);
  });

  it('keeps at least half the size, rounded up', () => {
    const out = carryBattleDamage({ manifest, report: { destroyed: houses }, size: 7 });
    expect(7 - out.sizeLoss).toBeGreaterThanOrEqual(4);
    expect(carryBattleDamage({ manifest, report: { destroyed: houses }, size: 1 }).sizeLoss).toBe(0);
    expect(carryBattleDamage({ manifest, report: { destroyed: [houses[0]] }, size: 10 }).sizeLoss).toBe(Math.round(10 / houses.length));
  });

  it('at most half the buildings lose one tier; walls and landmarks are never lost', () => {
    const out = carryBattleDamage({ manifest, report: { destroyed: ['bld-culture', 'bld-economy', 'bld-food', 'bld-science', 'gate', 'wall-0', 'townhall'] }, size: 5 });
    expect(out.lostBuildings).toHaveLength(2);
    expect(Object.keys(out.damage.damaged)).toEqual(expect.arrayContaining(['gate', 'wall-0', 'townhall']));
    expect(out.damage.ruined.gate).toBeUndefined();
  });

  it('counts houses ruined before toward the half', () => {
    const prior = { ruined: Object.fromEntries(houses.slice(0, Math.floor(houses.length / 2)).map((id) => [id, 4])), damaged: {} };
    const out = carryBattleDamage({ manifest, prior, report: { destroyed: houses.slice(-2) }, size: 6 });
    expect(Object.keys(out.damage.ruined)).toHaveLength(Math.floor(houses.length / 2));
    expect(out.sizeLoss).toBe(0);
  });

  it('an occupation repairs half the damage at once; unknown ids are ignored', () => {
    const out = carryBattleDamage({ manifest, report: { damaged: ['gate', 'wall-0', 'wall-1', 'house-0', 'nonsense'] }, size: 5, occupation: true });
    expect(out.repairedAtOnce).toBe(2);
    expect(Object.keys(out.damage.damaged)).toHaveLength(2);
  });

  it('no damage, no record', () => {
    expect(carryBattleDamage({ manifest, report: { destroyed: [], damaged: [] } }).damage).toBeUndefined();
  });
});

describe('repairCityDamage', () => {
  it('counts down and drops the record when whole; a besieged city waits', () => {
    let r = { id: 'c', cityDamage: { ruined: { 'house-1': 2 }, damaged: { gate: 1 } } };
    r = repairCityDamage(r);
    expect(r.cityDamage).toEqual({ ruined: { 'house-1': 1 }, damaged: {} });
    const besieged = { ...r, siege: { by: 'x', hp: 10 } };
    expect(repairCityDamage(besieged)).toBe(besieged);
    r = repairCityDamage(r);
    expect(r.cityDamage).toBeUndefined();
    const whole = { id: 'c' };
    expect(repairCityDamage(whole)).toBe(whole);
  });
});

describe('a city in the game', () => {
  const base = createInitialState({ playerNationId: 'fr', rngSeed: 11 });
  const id = cap('fr');

  it('derives the same manifest from the same city (saves store only damage)', () => {
    const a = cityManifestOf(base, id);
    const b = cityManifestOf(JSON.parse(JSON.stringify(base)), id);
    expect(a).toEqual(b);
    expect(a.structures[0].id).toBe('townhall');
    expect(cityManifestInput(base, id).capital).toBe(true);
    expect(a.structures.some((s) => s.kind === 'palace')).toBe(true);
  });

  it('housing cap: houses plus the town hall, less the ruined', () => {
    const m = cityManifestOf(base, id);
    const full = cityHousingCap(base, id, m);
    expect(full).toBeGreaterThan(TOWNHALL_HOUSING);
    const { state } = applyCityBattleDamage(base, id, { destroyed: ['house-0'] }, { manifest: m });
    expect(cityHousingCap(state, id)).toBe(full - m.structures.find((s) => s.id === 'house-0').housing);
    expect(manifestStates(m, state.regions[id].cityDamage).find((s) => s.id === 'house-0').state).toBe('ruined');
  });

  it('a building lost in battle drops one tier; the damage repairs over the turns', () => {
    const s0 = { ...base, regions: { ...base.regions, [id]: { ...base.regions[id], buildings: { ...base.regions[id].buildings, categories: { ...base.regions[id].buildings.categories, economy: 1, culture: 0 } } } } };
    const m = cityManifestOf(s0, id);
    const { state, log } = applyCityBattleDamage(s0, id, { destroyed: ['bld-economy'], damaged: ['townhall'] }, { manifest: m });
    expect(state.regions[id].buildings.categories.economy).toBe(0);
    expect(state.regions[id].cityDamage.damaged.townhall).toBe(REPAIR_TURNS);
    expect(log).toMatch(/lost a tier/);
    let s = { ...state, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((e) => [e, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    for (let t = 0; t < REPAIR_TURNS; t++) s = resolveTurn(s);
    expect(s.turnNumber).toBe(state.turnNumber + REPAIR_TURNS);
    expect(s.regions[id].cityDamage?.damaged?.townhall).toBeUndefined();
  });
});
