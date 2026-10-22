// Future commander powers (eight ages U68): Orbital Strike, EMP and Hijack (effects.js).
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from './world';
import { step } from './step';
import { firePower, POWERS, empTicks, isTargetedPower } from './effects';
import { replayBattle } from './replay';
import { admitOrder } from './orderSchema';
import { getBattlePowers, HIJACK_TECH } from '../../engine/invasion';

const mk = (p, cls, robot = false) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, ageId: 'future', strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land', ...(robot ? { robot: true } : {}) }));
const setup = (defRobot = true) => {
  const attackerUnits = mk('a', ['infantry', 'ranged', 'siege']);
  return buildSetupFromArmies({
    regionId: 'future-powers-test', terrain: 'plains', seed: 9, attackerUnits, defenderUnits: mk('d', ['infantry', 'cavalry', 'siege'], defRobot),
    attackerAgeId: 'future', defenderAgeId: 'future',
    powers: [[...getBattlePowers(null, 'a', 'future', attackerUnits), { id: 'hijack' }], getBattlePowers(null, 'd', 'future', attackerUnits)]
  });
};
const world = (defRobot) => { const w = createWorld(setup(defRobot)); w.supply = [5000, 5000]; return w; };
const foes = (w) => w.squads.filter((q) => q.side === 1 && !q.isGeneral && q.onField);

describe('Future powers', () => {
  it('every Future side has Orbital Strike and EMP; Hijack only with Machine Consciousness', () => {
    const ids = getBattlePowers(null, 'a', 'future', mk('a', ['infantry'])).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['orbitalStrike', 'emp']));
    expect(ids).not.toContain('hijack');
    const state = { playerNationId: 'me', techTree: { [HIJACK_TECH]: { researched: true } } };
    expect(getBattlePowers(state, 'me', 'future', []).map((p) => p.id)).toContain('hijack');
    expect(getBattlePowers(null, 'a', 'information', []).map((p) => p.id)).not.toContain('emp');
    ['orbitalStrike', 'emp', 'hijack'].forEach((power) => { expect(admitOrder({ type: 'power', power, x: 0, y: 0 }, 0), power).toMatchObject({ power }); expect(isTargetedPower(power)).toBe(true); });
  });

  it('EMP stops robots 10 seconds, vehicles 5, and soldiers not at all', () => {
    const w = world(false);
    const [inf, cav] = foes(w);
    expect(empTicks({ ...inf, original: { robot: true } }, POWERS.emp.emp)).toBe(2 * empTicks(cav, POWERS.emp.emp));
    expect(empTicks(inf, POWERS.emp.emp)).toBe(0);
    expect(empTicks(cav, POWERS.emp.emp)).toBe(POWERS.emp.emp.vehicle);
    const r = world(true);
    const robot = foes(r)[0];
    expect(firePower(r, 0, 'emp', robot.x, robot.y)).toBe(true);
    expect(robot.stunnedUntil).toBe(r.tick + POWERS.emp.emp.robot);
    const x = robot.x; const y = robot.y;
    for (let i = 0; i < 20; i++) step(r, [{ tick: r.tick, seq: i, side: 1, type: 'move', squads: [robot.idx], x: x + 40000, y }]);
    expect([robot.x, robot.y]).toEqual([x, y]); // stopped
  });

  it('Hijack turns the nearest enemy robot to the caster for 5 seconds, never a human squad', () => {
    const human = world(false);
    const h = foes(human)[0];
    expect(firePower(human, 0, 'hijack', h.x, h.y)).toBe(false);
    expect(human.supply[0]).toBe(5000); // nothing spent
    const w = world(true);
    const robot = foes(w)[0];
    expect(firePower(w, 0, 'hijack', robot.x, robot.y)).toBe(true);
    expect(robot.side).toBe(0);
    while (w.tick < POWERS.hijack.hijack.duration + 1) step(w, []);
    expect(robot.side).toBe(1);
    expect(robot.hijack).toBeNull();
  });

  it('Orbital Strike lands one big blast after a delay', () => {
    const w = world(false);
    const t = foes(w)[0];
    const before = t.strength;
    expect(firePower(w, 0, 'orbitalStrike', t.x, t.y)).toBe(true);
    while (w.tick <= POWERS.orbitalStrike.delay) step(w, []);
    expect(before - t.strength).toBeGreaterThanOrEqual(Math.round(POWERS.orbitalStrike.damage * 0.9) - 1);
  });

  it('a battle with each power replays to the same hash', () => {
    const foe = foes(createWorld(setup(true)))[0];
    ['orbitalStrike', 'emp', 'hijack'].forEach((power) => {
      const log = [{ tick: 200, seq: 0, type: 'power', power, x: foe.x, y: foe.y }];
      const a = replayBattle(setup(true), log);
      const b = replayBattle(setup(true), log);
      expect(a.dropped, power).toBe(0);
      expect(a.hash, power).toBe(b.hash);
    });
  });
});
