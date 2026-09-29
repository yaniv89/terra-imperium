import { describe, it, expect } from 'vitest';
import { getImpactDelay, getFramingPov, getEffectDuration } from './GlobeEffectsOverlay';
import { getNationCapital } from '../../data/regions';
import { EFFECT_REGISTRY } from '../../data/effectRegistry';

const EGYPT_CAPITAL = getNationCapital('eg');

describe('getImpactDelay', () => {
  it('lands inside the effect\'s own lifetime for every registered action', () => {
    Object.keys(EFFECT_REGISTRY).forEach((type) => {
      const d = getImpactDelay(type);
      expect(d, type).toBeGreaterThanOrEqual(0);
      expect(d, type).toBeLessThan(getEffectDuration(type));
    });
  });

  it('falls back to the default spec for an unknown action type rather than throwing', () => {
    expect(() => getImpactDelay('not_a_real_action')).not.toThrow();
  });
});

describe('getFramingPov', () => {
  it('frames a close-up on a single region when from and to are the same', () => {
    const pov = getFramingPov(EGYPT_CAPITAL, EGYPT_CAPITAL);
    expect(pov).not.toBeNull();
    expect(pov.altitude).toBeGreaterThanOrEqual(0.3);
  });

  it('returns null when the target region has no known coordinates', () => {
    expect(getFramingPov(EGYPT_CAPITAL, 'not-a-real-region')).toBeNull();
  });
});
