// Rank 14 of the AoE and Civ report: the attacker's infantry builds a siege engine in the field.
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from './world';
import { step } from './step';
import { admitOrder } from './orderSchema';
import { canFieldBuild } from './economy';
import { FIELD_BUILD, fieldBuildTicks, MILLI, RES_INDEX } from '../data/economy';
import { buildTownManifest } from '../../data/townLayout';

const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const manifest = buildTownManifest({ cityId: 'fb-city', ageId: 'bronze', tierId: 'medium', style: 'levant', seed: 5, capital: false, defenseTier: 1, buildings: {} });
const assault = (opts = {}) => createWorld(buildSetupFromArmies({
  regionId: 'fb-test', terrain: 'mixed', seed: 11, attackerUnits: mk('a', ['infantry', 'infantry', 'ranged']), defenderUnits: mk('d', ['infantry']),
  controllers: ['player', 'ai'], intel: { attackerSeesDefender: true }, economy: true, cityManifest: manifest, fortLevel: 2, ...opts
}));
const run = (w, ticks, orders = []) => { step(w, orders); for (let i = 1; i < ticks && !w.ended; i++) step(w, []); };
const gold = (w) => w.eco.stock[0][RES_INDEX.gold];
const sieges = (w) => w.squads.filter((q) => q.side === 0 && q.classId === 'siege' && q.alive).length;

describe('field-built siege engines', () => {
  it('the order passes the schema', () => {
    expect(admitOrder({ type: 'fieldBuild', squads: [1, 2] }, 0)).toEqual({ type: 'fieldBuild', side: 0, squads: [1, 2] });
  });

  it('one infantry squad holding still builds one in FIELD_BUILD.time, paid at the order', () => {
    const w = assault();
    expect(canFieldBuild(w, 0)).toBe(true);
    expect(canFieldBuild(w, 1)).toBe(false); // the defender has its walls
    run(w, 5);
    const inf = w.squads.find((q) => q.side === 0 && q.classId === 'infantry' && q.onField);
    w.eco.stock[0][RES_INDEX.wood] += 500 * MILLI; w.eco.stock[0][RES_INDEX.gold] += 500 * MILLI;
    const before = gold(w); const engines = sieges(w);
    run(w, 1, [{ type: 'fieldBuild', side: 0, squads: [inf.idx] }]);
    expect(before - gold(w)).toBe(FIELD_BUILD.cost.gold * MILLI);
    run(w, fieldBuildTicks() + 2);
    expect(sieges(w)).toBe(engines + 1);
    expect(inf.fieldBuild).toBe(-1);
  });

  it('another order stops it and gives most of the price back', () => {
    const w = assault();
    run(w, 5);
    const inf = w.squads.find((q) => q.side === 0 && q.classId === 'infantry' && q.onField);
    w.eco.stock[0][RES_INDEX.wood] += 500 * MILLI; w.eco.stock[0][RES_INDEX.gold] += 500 * MILLI;
    const before = gold(w); const engines = sieges(w);
    run(w, 1, [{ type: 'fieldBuild', side: 0, squads: [inf.idx] }]);
    run(w, 2, [{ type: 'stop', side: 0, squads: [inf.idx] }]);
    expect(inf.fieldBuild).toBe(-1);
    expect(before - gold(w)).toBeLessThan(FIELD_BUILD.cost.gold * MILLI * 0.3);
    run(w, fieldBuildTicks());
    expect(sieges(w)).toBe(engines);
  });

  it('nothing once no works stand (nothing left to breach)', () => {
    const w = assault();
    w.structures.forEach((s) => { s.alive = false; });
    expect(canFieldBuild(w, 0)).toBe(false);
  });
});
