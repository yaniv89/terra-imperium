// src/battle/setup/battleType.test.js
import { describe, it, expect } from 'vitest';
import { battleTypeOf, BATTLE_TYPES, AMBUSH_SECONDS, LANDING_HOLD_SECONDS, SALLY_ENGINES } from './battleType';
import { buildSetupFromArmies } from './buildBattleSetup';
import { createWorld } from '../sim/world';
import { step } from '../sim/step';
import { razeBuilding } from '../sim/buildings';
import { SIDE_ATTACKER, SIDE_DEFENDER, Q, secondsToTicks, FIELD_BATTLE_TICKS, SIEGE_BATTLE_TICKS } from '../sim/constants';

const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const setup = (extra = {}) => buildSetupFromArmies({ regionId: 'bt', terrain: 'plains', seed: 3, attackerUnits: mk('a', ['infantry', 'infantry', 'ranged']), defenderUnits: mk('d', ['infantry', 'infantry', 'ranged']), controllers: ['ai', 'ai'], deposits: [], powers: [[], []], ...extra });
const ctx = (terrain, { river = false, road = false } = {}) => ({ tile: 1, terrain, attackerBearing: 180, sectors: [{ tile: 2, bearing: 180, terrain: 'plains', water: false, lake: false, river, road }], coastal: false, walls: 0, hpRatio: 1, roads: road ? 1 : 0 });

describe('battle types', () => {
  it('the map decides the type', () => {
    expect(battleTypeOf({})).toBe('field');
    expect(battleTypeOf({ landing: true })).toBe('landing');
    expect(battleTypeOf({ sally: true })).toBe('sally');
    expect(battleTypeOf({ city: true, fortLevel: 2 })).toBe('assault');
    expect(battleTypeOf({ city: true, fortLevel: 0 })).toBe('field');
    expect(battleTypeOf({ tileContext: ctx('plains', { river: true }), fromTile: 2 })).toBe('river');
    expect(battleTypeOf({ tileContext: ctx('forest') })).toBe('ambush');
    expect(battleTypeOf({ tileContext: ctx('forest', { road: true }) })).toBe('field');
    expect(battleTypeOf({ tileContext: ctx('forest'), city: true })).toBe('field');
    Object.values(BATTLE_TYPES).forEach((t) => { expect(t.label && t.attacker && t.defender).toBeTruthy(); expect(t.limitTicks).toBeGreaterThan(0); });
  });

  it('the setup carries the type, its clock, a camp for a sally and a beachhead for a landing', () => {
    expect(setup().battleType).toBe('field');
    expect(setup().limitTicks).toBe(FIELD_BATTLE_TICKS);
    expect(setup({ fortLevel: 2 }).battleType).toBe('assault');
    expect(setup({ fortLevel: 2 }).limitTicks).toBe(SIEGE_BATTLE_TICKS);
    const sally = setup({ sally: true });
    expect(sally.battleType).toBe('sally');
    expect(sally.structures.filter((s) => s.category === 'engine')).toHaveLength(3);
    expect(sally.structures.filter((s) => s.category === 'camp')).toHaveLength(1);
    const landing = setup({ landing: true });
    expect(landing.battleType).toBe('landing');
    expect(landing.points.some((p) => p.kind === 'beachhead')).toBe(true);
    expect(setup({ battleType: 'river' }).battleType).toBe('river');
  });

  it('an ambush ends when the attacker is bled early; a sally when the engines burn; a landing when the beachhead is held; a river crossing by the far bank at the clock', () => {
    const w1 = createWorld(setup({ battleType: 'ambush' }));
    w1.squads.forEach((q) => { if (q.side === SIDE_ATTACKER) q.strength = Math.round(q.strength * 0.5); });
    step(w1, []);
    expect(w1.ended).toMatchObject({ outcome: 'defender', reason: 'ambushed' });
    const w1b = createWorld(setup({ battleType: 'ambush' }));
    w1b.tick = secondsToTicks(AMBUSH_SECONDS) + 1;
    w1b.squads.forEach((q) => { if (q.side === SIDE_ATTACKER) q.strength = Math.round(q.strength * 0.5); });
    step(w1b, []);
    expect(w1b.ended).toBeNull(); // after the first minutes the ambush is an ordinary fight

    const w2 = createWorld(setup({ sally: true }));
    w2.structures.filter((s) => s.category === 'engine').slice(0, SALLY_ENGINES).forEach((s) => razeBuilding(w2, s, SIDE_ATTACKER));
    step(w2, []);
    expect(w2.ended).toMatchObject({ outcome: 'attacker', reason: 'campBurned' });

    const w3 = createWorld(setup({ landing: true }));
    const beach = w3.points.find((p) => p.kind === 'beachhead');
    beach.owner = SIDE_ATTACKER;
    w3.beachhead = secondsToTicks(LANDING_HOLD_SECONDS) - 1;
    step(w3, []);
    expect(w3.ended).toMatchObject({ outcome: 'attacker', reason: 'beachheadHeld' });

    const w4 = createWorld(setup({ battleType: 'river' }));
    w4.tick = w4.setup.limitTicks;
    const midX = Math.floor(w4.map.w / 2) * Q;
    w4.squads.forEach((q) => { if (q.side === SIDE_ATTACKER) { q.x = midX + 4 * Q; q.onField = true; } });
    step(w4, []);
    expect(w4.ended).toMatchObject({ outcome: 'attacker', reason: 'farBankHeld' });
    const w5 = createWorld(setup({ battleType: 'river' }));
    w5.tick = w5.setup.limitTicks;
    w5.squads.forEach((q) => { if (q.side === SIDE_ATTACKER) { q.x = Q; q.onField = true; } });
    step(w5, []);
    expect(w5.ended).toMatchObject({ outcome: 'defender', reason: 'timeLimit' });
    expect(w5.squads.some((q) => q.side === SIDE_DEFENDER)).toBe(true);
  });
});
