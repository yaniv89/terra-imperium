import { describe, it, expect } from 'vitest';
import {
  MISSILE_TIERS, MISSILE_TIER_IDS, MAX_ABM_LEVEL, getAbmReductionMult, isMissileInRange,
  NUCLEAR_GLOBAL_HOSTILITY
} from './missiles';

describe('MISSILE_TIERS data integrity', () => {
  it('covers all four tiers', () => {
    expect(MISSILE_TIER_IDS.sort()).toEqual(['icbm', 'nuclear', 'tactical', 'theatre']);
  });

  it('damage increases with tier (tactical < theatre < icbm < nuclear)', () => {
    expect(MISSILE_TIERS.theatre.controlDamage).toBeGreaterThan(MISSILE_TIERS.tactical.controlDamage);
    expect(MISSILE_TIERS.icbm.controlDamage).toBeGreaterThan(MISSILE_TIERS.theatre.controlDamage);
    expect(MISSILE_TIERS.nuclear.controlDamage).toBeGreaterThan(MISSILE_TIERS.icbm.controlDamage);
  });

  it('icbm and nuclear have unlimited (global) range; tactical/theatre are finite', () => {
    expect(MISSILE_TIERS.icbm.range).toBe(Infinity);
    expect(MISSILE_TIERS.nuclear.range).toBe(Infinity);
    expect(Number.isFinite(MISSILE_TIERS.tactical.range)).toBe(true);
    expect(Number.isFinite(MISSILE_TIERS.theatre.range)).toBe(true);
  });
});

describe('getAbmReductionMult', () => {
  it('is 1 (no reduction) with no ABM defense', () => {
    expect(getAbmReductionMult(0)).toBe(1);
    expect(getAbmReductionMult(undefined)).toBe(1);
  });

  it('reduces damage by 15% per level', () => {
    expect(getAbmReductionMult(1)).toBeCloseTo(0.85);
    expect(getAbmReductionMult(2)).toBeCloseTo(0.7);
  });

  it('never intercepts fully, even at the maximum level', () => {
    expect(getAbmReductionMult(MAX_ABM_LEVEL)).toBeGreaterThan(0);
    expect(getAbmReductionMult(MAX_ABM_LEVEL)).toBeCloseTo(1 - MAX_ABM_LEVEL * 0.15);
  });

  it('caps at the maximum level rather than going negative beyond it', () => {
    expect(getAbmReductionMult(99)).toBe(getAbmReductionMult(MAX_ABM_LEVEL));
  });
});

describe('isMissileInRange', () => {
  const fakeDistance = (anchors, target) => (target === 'far' ? 10 : target === 'near' ? 2 : null);

  it('tactical (range 3) reaches a near target but not a far one', () => {
    expect(isMissileInRange('tactical', ['home'], 'near', fakeDistance)).toBe(true);
    expect(isMissileInRange('tactical', ['home'], 'far', fakeDistance)).toBe(false);
  });

  it('icbm and nuclear reach any target, including one the distance function calls unreachable', () => {
    expect(isMissileInRange('icbm', ['home'], 'far', fakeDistance)).toBe(true);
    expect(isMissileInRange('nuclear', ['home'], 'unreachable', fakeDistance)).toBe(true);
  });

  it('is false for an unknown tier', () => {
    expect(isMissileInRange('not_real', ['home'], 'near', fakeDistance)).toBe(false);
  });

  it('is false when the distance function reports the target unreachable at all', () => {
    const alwaysNull = () => null;
    expect(isMissileInRange('tactical', ['home'], 'anywhere', alwaysNull)).toBe(false);
  });
});

describe('NUCLEAR_GLOBAL_HOSTILITY', () => {
  it('is a real, positive hostility bump', () => {
    expect(NUCLEAR_GLOBAL_HOSTILITY).toBeGreaterThan(0);
  });
});
