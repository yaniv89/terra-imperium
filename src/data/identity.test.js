import { describe, it, expect } from 'vitest';
import { getIdentityBonus, clampIdentity, IDENTITY_MAX, IDENTITY_MIN } from './identity';

describe('clampIdentity', () => {
  it('clamps to the max/min bounds', () => {
    expect(clampIdentity(150)).toBe(IDENTITY_MAX);
    expect(clampIdentity(-150)).toBe(IDENTITY_MIN);
  });

  it('passes through an in-range value unchanged', () => {
    expect(clampIdentity(42)).toBe(42);
  });
});

describe('getIdentityBonus', () => {
  it('is zero on every hook with no identity set', () => {
    expect(getIdentityBonus(undefined, 'stabilityBonus')).toBe(0);
    expect(getIdentityBonus(undefined, 'goldMult')).toBe(0);
    expect(getIdentityBonus(undefined, 'hrMult')).toBe(0);
  });

  it('Collectivist (positive collectivism) raises stabilityBonus, not goldMult', () => {
    const identity = { collectivism: IDENTITY_MAX, secularism: 0, globalism: 0 };
    expect(getIdentityBonus(identity, 'stabilityBonus')).toBeCloseTo(10);
    expect(getIdentityBonus(identity, 'goldMult')).toBe(0);
  });

  it('Individualist (negative collectivism) raises goldMult, not stabilityBonus', () => {
    const identity = { collectivism: -IDENTITY_MAX, secularism: 0, globalism: 0 };
    expect(getIdentityBonus(identity, 'goldMult')).toBeCloseTo(0.12);
    expect(getIdentityBonus(identity, 'stabilityBonus')).toBe(0);
  });

  it('Isolationist (negative globalism) raises hrMult', () => {
    const identity = { collectivism: 0, secularism: 0, globalism: -IDENTITY_MAX };
    expect(getIdentityBonus(identity, 'hrMult')).toBeCloseTo(0.15);
  });

  it('Globalist (positive globalism) raises goldMult, not hrMult', () => {
    const identity = { collectivism: 0, secularism: 0, globalism: IDENTITY_MAX };
    expect(getIdentityBonus(identity, 'goldMult')).toBeCloseTo(0.1);
    expect(getIdentityBonus(identity, 'hrMult')).toBe(0);
  });

  it('an unknown hook key returns zero', () => {
    const identity = { collectivism: IDENTITY_MAX };
    expect(getIdentityBonus(identity, 'not_a_real_hook')).toBe(0);
  });
});
