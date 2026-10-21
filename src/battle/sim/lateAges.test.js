// Modern machine-gun suppression and Information precision (eight ages plan U50); the late commander powers (U58).
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from './world';
import { attackSquad } from './combat';
import { attackRateMult, SUPPRESSED_RATE, firePower, JAM_ORDER_DELAY } from './effects';
import { runHeadless } from './headless';
import { replayBattle } from './replay';
import { step } from './step';
import { admitOrder } from './orderSchema';
import { Q } from './constants';
import { getBattlePowers } from '../../engine/invasion';

const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const setupAt = (ageId) => buildSetupFromArmies({
  regionId: 'late-ages-test', terrain: 'plains', seed: 7,
  attackerUnits: mk('a', ['ranged', 'infantry']), defenderUnits: mk('d', ['infantry', 'ranged']),
  attackerAgeId: ageId, defenderAgeId: ageId
});
const pair = (ageId) => {
  const w = createWorld(setupAt(ageId));
  return { w, a: w.squads.find((q) => q.side === 0 && q.classId === 'ranged'), t: w.squads.find((q) => q.side === 1 && q.classId === 'infantry') };
};

describe('late-age battle rules (U50)', () => {
  it('a Modern machine gun suppresses what it hits: the target fires slower for a while', () => {
    const { w, a, t } = pair('modern');
    expect(attackRateMult(w, t)).toBe(1);
    attackSquad(w, a, t);
    expect(t.suppressedUntil).toBe(w.tick + a.stats.suppress);
    expect(attackRateMult(w, t)).toBe(SUPPRESSED_RATE);
    w.tick = t.suppressedUntil;
    expect(attackRateMult(w, t)).toBe(1);
  });

  it("an Information squad's first shot hits harder than its next", () => {
    const first = pair('information');
    const second = pair('information');
    second.a.lastStrikeTick = 0; // has fired before
    const before = [first, second].map(({ t }) => t.strength);
    attackSquad(first.w, first.a, first.t);
    attackSquad(second.w, second.a, second.t);
    expect(before[0] - first.t.strength).toBeGreaterThan(before[1] - second.t.strength);
    expect(first.t.suppressedUntil).toBe(-1); // ATGM teams do not suppress
  });

  it('Modern and Information battles replay to the same hash', () => {
    ['modern', 'information'].forEach((ageId) => {
      const one = runHeadless(setupAt(ageId), { maxTicks: 1200 });
      const two = runHeadless(setupAt(ageId), { maxTicks: 1200 });
      expect(one.chain, ageId).toBe(two.chain);
    });
  });
});

describe('Modern and Information commander powers (U58)', () => {
  const units = (p) => mk(p, ['infantry', 'ranged', 'siege', 'air']);
  const powerSetup = () => {
    const attackerUnits = units('a');
    return buildSetupFromArmies({
      regionId: 'late-powers-test', terrain: 'plains', seed: 9, attackerUnits, defenderUnits: units('d'),
      attackerAgeId: 'information', defenderAgeId: 'information',
      powers: [getBattlePowers(null, 'a', 'information', attackerUnits), getBattlePowers(null, 'd', 'information', attackerUnits)]
    });
  };

  it('Modern brings Artillery Barrage and Air Strike; Information adds Drone Strike, Cyber Jam and Drone Recon', () => {
    expect(getBattlePowers(null, 'a', 'modern', units('a')).map((p) => p.id)).toEqual(['rallyCry', 'artilleryBarrage', 'airStrike']);
    expect(getBattlePowers(null, 'a', 'information', units('a')).map((p) => p.id)).toEqual(['rallyCry', 'artilleryBarrage', 'airStrike', 'droneStrike', 'cyberJam', 'droneRecon']);
    expect(getBattlePowers(null, 'a', 'information', mk('a', ['infantry'])).map((p) => p.id)).toEqual(['rallyCry', 'cyberJam', 'droneRecon']);
  });

  it('the order schema admits the new powers', () => {
    ['droneStrike', 'cyberJam', 'droneRecon'].forEach((power) => expect(admitOrder({ type: 'power', power, x: 0, y: 0 }, 0), power).toMatchObject({ power }));
  });

  it('Cyber Jam holds the enemy\'s orders for 3 seconds, then applies them', () => {
    const w = createWorld(powerSetup());
    w.supply[1] = 1000;
    expect(firePower(w, 1, 'cyberJam', 0, 0)).toBe(true);
    const q = w.squads.find((s) => s.side === 0 && !s.isGeneral && s.onField);
    step(w, [{ tick: w.tick, seq: 0, side: 0, type: 'move', squads: [q.idx], x: q.x, y: q.y + 4 * Q }]);
    expect(q.order?.type).not.toBe('move');
    expect(w.jammedOrders).toHaveLength(1);
    while (w.tick <= JAM_ORDER_DELAY) step(w, []);
    expect(w.jammedOrders).toHaveLength(0);
    expect(['move', 'idle']).toContain(q.order?.type); // applied (it may already stand at the spot)
  });

  it('Drone Recon shows its side the whole field', () => {
    const w = createWorld(powerSetup());
    w.supply[0] = 1000;
    expect(firePower(w, 0, 'droneRecon', 0, 0)).toBe(true);
    for (let i = 0; i < 6; i++) step(w, []);
    expect(w.fog[0].every((v) => v === 2)).toBe(true);
  });

  it('a battle with each power replays to the same hash', () => {
    const w0 = createWorld(powerSetup());
    const foe = w0.squads.find((q) => q.side === 1 && !q.isGeneral);
    ['droneStrike', 'cyberJam', 'droneRecon'].forEach((power) => {
      const log = [{ tick: 200, seq: 0, type: 'power', power, x: foe.x, y: foe.y }];
      const a = replayBattle(powerSetup(), log);
      const b = replayBattle(powerSetup(), log);
      expect(a.dropped, power).toBe(0);
      expect(a.hash, power).toBe(b.hash);
    });
  });
});
