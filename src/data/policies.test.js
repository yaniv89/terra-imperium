import { describe, it, expect } from 'vitest';
import { POLICIES, POLICY_IDS, getPolicy } from './policies';

describe('POLICIES data integrity', () => {
  it('every policy has exactly one effect hook, and it is a recognized kind', () => {
    Object.values(POLICIES).forEach((policy) => {
      const keys = Object.keys(policy.effect);
      expect(keys.length, policy.id).toBe(1);
      expect(['goldMult', 'hrMult', 'stabilityBonus']).toContain(keys[0]);
    });
  });

  it('POLICY_IDS matches the POLICIES keys', () => {
    expect(POLICY_IDS.sort()).toEqual(Object.keys(POLICIES).sort());
  });
});

describe('getPolicy', () => {
  it('returns the policy by id', () => {
    expect(getPolicy('levy_system')?.name).toBe('Levy System');
  });

  it('returns null for an unknown id', () => {
    expect(getPolicy('not_real')).toBeNull();
  });
});
