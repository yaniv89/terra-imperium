// Modern machine-gun suppression and Information precision (eight ages plan U50).
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from './world';
import { attackSquad } from './combat';
import { attackRateMult, SUPPRESSED_RATE } from './effects';
import { runHeadless } from './headless';

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
