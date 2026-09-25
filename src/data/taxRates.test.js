import { describe, it, expect } from 'vitest';
import { TAX_RATES, TAX_RATE_IDS, DEFAULT_TAX_RATE, TAX_RATE_CHANGE_COOLDOWN_TURNS } from './taxRates';

describe('TAX_RATES (plan §M11 convex curve)', () => {
  it('has exactly the plan\'s 4 tiers, low to extortionate', () => {
    expect(TAX_RATE_IDS).toEqual(['low', 'normal', 'high', 'extortionate']);
  });

  it('goldMult and unrestDeltaPerTurn both increase monotonically from low to extortionate', () => {
    const ordered = TAX_RATE_IDS.map((id) => TAX_RATES[id]);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].goldMult).toBeGreaterThan(ordered[i - 1].goldMult);
      expect(ordered[i].unrestDeltaPerTurn).toBeGreaterThan(ordered[i - 1].unrestDeltaPerTurn);
    }
  });

  it('normal is a true no-op', () => {
    expect(TAX_RATES.normal.goldMult).toBe(0);
    expect(TAX_RATES.normal.unrestDeltaPerTurn).toBe(0);
  });

  it('only extortionate carries the periodic stability-penalty field', () => {
    expect(TAX_RATES.extortionate.extortionateStabilityPenaltyTurns).toBeGreaterThan(0);
    ['low', 'normal', 'high'].forEach((id) => expect(TAX_RATES[id].extortionateStabilityPenaltyTurns).toBeUndefined());
  });

  it('defaults to normal', () => {
    expect(DEFAULT_TAX_RATE).toBe('normal');
  });

  it('has a positive change cooldown', () => {
    expect(TAX_RATE_CHANGE_COOLDOWN_TURNS).toBeGreaterThan(0);
  });
});
