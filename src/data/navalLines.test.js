// src/data/navalLines.test.js
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../engine/gameReducer';
import { ActionTypes } from './types';
import { getNationCapital } from './regions';
import { getTiles } from './geo/tiles';
import { computeHitMultiplier } from '../engine/battle';
import { bombardStrength } from '../engine/sieges';
import { portWaters } from '../engine/fleets';
import { visibleTiles } from '../engine/sight';
import { canQueue } from '../engine/world/cities';
import { NAVAL_LINES, NAVAL_LINE_IDS, navalLinesFor, navalCargo, navalName, navalLineOf, navalCombatMult, NAVAL_BOMBARD } from './navalLines';
import { peoplesWorld, rivalOf } from '../engine/testWorld';
import { AGE_ORDER } from './ages';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 7 });
const FR = WORLD.playerNationId;
const DE = rivalOf(WORLD, 0);

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
    NAVAL_LINE_IDS.forEach((id) => { expect(Object.keys(NAVAL_LINES[id].names)).toEqual(AGE_ORDER); expect(Object.keys(NAVAL_LINES[id].cargo)).toEqual(AGE_ORDER); });
  });

  it('a transport fights badly and a raider lightly; a warship bombards a besieged coast; raiders see further', () => {
    const ctx = { phase: 'ranged', sourceIsInvadingFortification: false, generals: {}, targetIsDefendingSide: true };
    const warship = { classId: 'naval', navalLine: 'warship', promotions: [] }; const target = { classId: 'naval', promotions: [] };
    const base = computeHitMultiplier(warship, target, ctx);
    expect(computeHitMultiplier({ ...warship, navalLine: 'transport' }, target, ctx)).toBeCloseTo(base * navalCombatMult('transport'));
    expect(computeHitMultiplier({ ...warship, navalLine: 'raider' }, target, ctx)).toBeCloseTo(base * 0.8);
    const s = peoplesWorld({ seed: 7 });
    const coastal = Object.values(s.regions).find((c) => c.owner && c.owner !== FR && portWaters(s, getTiles(), c.id).length > 0);
    const water = portWaters(s, getTiles(), coastal.id)[0];
    const fleet = (id, navalLine) => ({ id, ownerId: FR, domain: 'naval', classId: 'naval', navalLine, strength: 1000, tile: water, regionId: getNationCapital(FR) });
    const units = { f1: fleet('f1', 'warship'), f2: fleet('f2', 'transport'), f3: fleet('f3', 'warship') };
    expect(bombardStrength(s, coastal, units, [FR])).toBe(2 * NAVAL_BOMBARD);
    expect(bombardStrength(s, coastal, units, [DE])).toBe(0);
    const seeW = visibleTiles({ ...s, units: { f1: fleet('f1', 'warship') } }, FR).size;
    const seeR = visibleTiles({ ...s, units: { f1: fleet('f1', 'raider') } }, FR).size;
    expect(seeR).toBeGreaterThan(seeW);
  });

  it('recruiting and building carry the line and its cargo; a line not of the age cannot be queued', () => {
    let s = peoplesWorld({ seed: 7 });
    s = { ...s, resources: { ...s.resources, gold: 100000, hr: 100000, mil: 1000, copper: 1000 } };
    const port = Object.values(s.regions).find((c) => c.owner === FR && portWaters(s, getTiles(), c.id).length > 0) || s.regions[getNationCapital(FR)];
    const r = gameReducer(s, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: port.id, classId: 'naval', navalLine: 'transport' } });
    const built = Object.values(r.units).find((u) => u.domain === 'naval' && !s.units[u.id]);
    if (built) { expect(built.navalLine).toBe('transport'); expect(built.transportCapacity).toBe(navalCargo('transport', 'bronze')); }
    const tiles = getTiles(); const world = { cities: s.regions, tileOwner: s.world.tileOwner, tileState: s.world.tileState };
    // Ships are queued only in a city on the sea (cities.js hasSeaCoast, playtest audits I039).
    const harbour = Object.values(s.regions).find((c) => c.tile != null && tiles.coastal[c.tile] === 1);
    expect(canQueue(harbour, tiles, world, { kind: 'unit', classId: 'naval', navalLine: 'carrier' }, { researched: [], ageId: 'bronze' }).ok).toBe(false);
    expect(canQueue(harbour, tiles, world, { kind: 'unit', classId: 'naval', navalLine: 'warship' }, { researched: [], ageId: 'bronze' }).ok).toBe(true);
    const inland = Object.values(s.regions).find((c) => c.tile != null && tiles.coastal[c.tile] !== 1);
    expect(canQueue(inland, tiles, world, { kind: 'unit', classId: 'naval', navalLine: 'warship' }, { researched: [], ageId: 'bronze' }).ok).toBe(false);
  });
});
