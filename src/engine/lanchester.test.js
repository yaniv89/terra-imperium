import { describe, it, expect } from 'vitest';
import { powQuarter, estimateBattle, matchupMult, lanchesterPower, oddsFromPower, strengthOdds } from './lanchester';

const army = (n, classId = 'infantry', strength = 1000) => Array.from({ length: n }, (_, i) => ({ id: `${classId}${i}`, classId, strength }));

describe('powQuarter', () => {
  it('matches Math.pow for quarter exponents and is exact for whole ones', () => {
    [0.25, 0.5, 1.25, 2, 4.5, -1.5].forEach((q) => [0.3, 1, 2.7, 9].forEach((x) => expect(powQuarter(x, q)).toBeCloseTo(x ** q, 10)));
    expect(powQuarter(3, 2)).toBe(9);
    expect(powQuarter(0, 2)).toBe(0);
  });
});

describe('estimateBattle', () => {
  it('even armies on open ground are close to a coin flip, the defender slightly ahead', () => {
    const e = estimateBattle({ attackerUnits: army(4), defenderUnits: army(4) });
    expect(e.pWin).toBeGreaterThan(0.4);
    expect(e.pWin).toBeLessThan(0.5);
  });
  it('numbers count squared: twice the army wins almost surely', () => {
    expect(estimateBattle({ attackerUnits: army(8), defenderUnits: army(4) }).pWin).toBeGreaterThan(0.95);
    expect(estimateBattle({ attackerUnits: army(4), defenderUnits: army(8) }).pWin).toBeLessThan(0.05);
  });
  it('walls, hard terrain, a river and a later enemy age all lower the odds', () => {
    const base = { attackerUnits: army(5), defenderUnits: army(4) };
    const p = estimateBattle(base).pWin;
    expect(estimateBattle({ ...base, defenderDamageReductionMultiplier: 0.7, isAttackingFortification: true, battleType: 'assault' }).pWin).toBeLessThan(p);
    expect(estimateBattle({ ...base, terrain: 'mountains' }).pWin).toBeLessThan(p);
    expect(estimateBattle({ ...base, battleType: 'river' }).pWin).toBeLessThan(p);
    expect(estimateBattle({ ...base, defenderAgeId: 'classical' }).pWin).toBeLessThan(p);
  });
  it('knows the counters: spearmen beat horse, siege cracks walls and fails in the field', () => {
    expect(matchupMult(army(2, 'infantry'), army(2, 'cavalry'))).toBeGreaterThan(1);
    expect(matchupMult(army(2, 'cavalry'), army(2, 'infantry'))).toBeLessThan(1);
    expect(matchupMult(army(2, 'siege'), army(2, 'infantry'), true)).toBeGreaterThan(matchupMult(army(2, 'siege'), army(2, 'infantry'), false));
  });
  it('an empty defender is a sure win and an empty attacker a sure loss', () => {
    expect(estimateBattle({ attackerUnits: army(1), defenderUnits: [] }).pWin).toBe(1);
    expect(estimateBattle({ attackerUnits: [], defenderUnits: army(1) }).pWin).toBe(0);
  });
  it('the loser is expected to lose the bigger share', () => {
    const e = oddsFromPower(lanchesterPower(3000, 1000));
    expect(e.defenderLossShare).toBeGreaterThan(e.attackerLossShare);
    expect(strengthOdds(1000, 1000).pWin).toBeCloseTo(oddsFromPower(1).pWin, 12);
  });
});
