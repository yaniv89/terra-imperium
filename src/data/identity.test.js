import { describe, it, expect } from 'vitest';
import { clampIdentity, leansPositive, leansNegative, IDENTITY_MAX, IDENTITY_MIN, IDENTITY_GATE_THRESHOLD } from './identity';

describe('clampIdentity', () => {
  it('clamps to the max/min bounds', () => {
    expect(clampIdentity(150)).toBe(IDENTITY_MAX);
    expect(clampIdentity(-150)).toBe(IDENTITY_MIN);
  });

  it('passes through an in-range value unchanged', () => {
    expect(clampIdentity(42)).toBe(42);
  });
});

// Plan §M8.3: identity no longer grants a flat gold/stability multiplier (getIdentityBonus is
// gone) — leansPositive/leansNegative is the one check every gate/discount in government.js and
// laws.js is built from.
describe('leansPositive / leansNegative', () => {
  it('is false for an axis at or below the gate threshold', () => {
    expect(leansPositive({ secularism: IDENTITY_GATE_THRESHOLD }, 'secularism')).toBe(false);
    expect(leansPositive(undefined, 'secularism')).toBe(false);
  });

  it('is true once an axis leans past the threshold', () => {
    expect(leansPositive({ secularism: IDENTITY_GATE_THRESHOLD + 1 }, 'secularism')).toBe(true);
  });

  it('leansNegative mirrors leansPositive on the opposite pole', () => {
    expect(leansNegative({ collectivism: -(IDENTITY_GATE_THRESHOLD + 1) }, 'collectivism')).toBe(true);
    expect(leansNegative({ collectivism: -IDENTITY_GATE_THRESHOLD }, 'collectivism')).toBe(false);
    expect(leansPositive({ collectivism: -(IDENTITY_GATE_THRESHOLD + 1) }, 'collectivism')).toBe(false);
  });
});
