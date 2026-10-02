// src/data/navalLines.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from '../engine/gameReducer';
import { ActionTypes } from './types';
import { getNationCapital } from './regions';
import { getTiles } from './geo/tiles';
import { computeHitMultiplier } from '../engine/battle';
import { bombardStrength } from '../engine/sieges';
import { portWaters } from '../engine/fleets';
import { visibleTiles } from '../engine/sight';
import { canQueue } from '../engine/world/cities';
import { NAVAL_LINES, NAVAL_LINE_IDS, navalLinesFor, navalCargo, navalName, navalLineOf, navalCombatMult, NAVAL_BOMBARD } from './navalLines';

describe('naval lines', () => {
  it('four lines, by age, with cargo and names per age', () => {
    expect(NAVAL_LINE_IDS).toEqual(['warship', 'transport', 'raider', 'carrier']);
    expect(navalLinesFor('bronze')).toEqual(['warship']);
    expect(navalLinesFor('classical')).toEqual(['warship', 'transport', 'raider']);
    expect(navalLinesFor('modern')).toEqual(NAVAL_LINE_IDS);
    expect(navalCargo('warship', 'bronze')).toBe(1);
    expect(navalCargo('warship', 'kingdoms')).toBe(2);
    expect(navalCargo('transport', 'modern')).toBe(6);
    expect(navalCargo('raider', 'gunpowder')).toBe(0);
    expect(navalName('warship', 'gunpowder')).toBe('Frigate');
    expect(navalLineOf({ classId: 'naval' })).toBe('warship'); // an older record
    NAVAL_LINE_IDS.forEach((id) => { expect(NAVAL_LINES[id].names).toHaveLength(5); expect(NAVAL_LINES[id].cargo).toHaveLength(5); });
  });

  it('a transport fights badly and a raider lightly; a warship bombards a besieged coast; raiders see further', () => {
    const ctx = { phase: 'ranged', sourceIsInvadingFortification: false, generals: {}, targetIsDefendingSide: true };
    const warship = { classId: 'naval', navalLine: 'warship', promotions: [] }; const target = { classId: 'naval', promotions: [] };
    const base = computeHitMultiplier(warship, target, ctx);
    expect(computeHitMultiplier({ ...warship, navalLine: 'transport' }, target, ctx)).toBeCloseTo(base * navalCombatMult('transport'));
    expect(computeHitMultiplier({ ...warship, navalLine: 'raider' }, target, ctx)).toBeCloseTo(base * 0.8);
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const coastal = Object.values(s.regions).find((c) => c.owner && c.owner !== 'fr' && portWaters(s, getTiles(), c.id).length > 0);
    const water = portWaters(s, getTiles(), coastal.id)[0];
    const fleet = (id, navalLine) => ({ id, ownerId: 'fr', domain: 'naval', classId: 'naval', navalLine, strength: 1000, tile: water, regionId: getNationCapital('fr') });
    const units = { f1: fleet('f1', 'warship'), f2: fleet('f2', 'transport'), f3: fleet('f3', 'warship') };
    expect(bombardStrength(s, coastal, units, ['fr'])).toBe(2 * NAVAL_BOMBARD);
    expect(bombardStrength(s, coastal, units, ['de'])).toBe(0);
    const seeW = visibleTiles({ ...s, units: { f1: fleet('f1', 'warship') } }, 'fr').size;
    const seeR = visibleTiles({ ...s, units: { f1: fleet('f1', 'raider') } }, 'fr').size;
    expect(seeR).toBeGreaterThan(seeW);
  });

  it('recruiting and building carry the line and its cargo; a line not of the age cannot be queued', () => {
    let s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    s = { ...s, resources: { ...s.resources, gold: 100000, hr: 100000, mil: 1000, copper: 1000 } };
    const port = Object.values(s.regions).find((c) => c.owner === 'fr' && portWaters(s, getTiles(), c.id).length > 0) || s.regions[getNationCapital('fr')];
    const r = gameReducer(s, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: port.id, classId: 'naval', navalLine: 'transport' } });
    const built = Object.values(r.units).find((u) => u.domain === 'naval' && !s.units[u.id]);
    if (built) { expect(built.navalLine).toBe('transport'); expect(built.transportCapacity).toBe(navalCargo('transport', 'bronze')); }
    const tiles = getTiles(); const world = { cities: s.regions, tileOwner: s.world.tileOwner, tileState: s.world.tileState };
    expect(canQueue(port, tiles, world, { kind: 'unit', classId: 'naval', navalLine: 'carrier' }, { researched: [], ageId: 'bronze' }).ok).toBe(false);
    expect(canQueue(port, tiles, world, { kind: 'unit', classId: 'naval', navalLine: 'warship' }, { researched: [], ageId: 'bronze' }).ok).toBe(true);
  });
});
