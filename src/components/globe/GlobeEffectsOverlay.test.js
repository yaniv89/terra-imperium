import { describe, it, expect } from 'vitest';
import { getImpactDelay, getFramingPov, ARC_EFFECT_DURATION_MS, PULSE_EFFECT_DURATION_MS } from './GlobeEffectsOverlay';

describe('getImpactDelay', () => {
  it('returns a positive delay for an arc-primitive action type', () => {
    expect(getImpactDelay('missile_strike')).toBeGreaterThan(0);
  });

  it('returns a positive delay for a pulse-primitive action type without throwing', () => {
    // pulse specs have no `projectiles` array — the arc-only calculation would throw on one.
    expect(() => getImpactDelay('recruit_unit')).not.toThrow();
    expect(getImpactDelay('recruit_unit')).toBeGreaterThan(0);
  });

  it('falls back to the default spec for an unknown action type rather than throwing', () => {
    expect(() => getImpactDelay('not_a_real_action')).not.toThrow();
  });
});

describe('getFramingPov', () => {
  it('frames a close-up on a single region when from and to are the same (a pulse effect)', () => {
    const pov = getFramingPov('eg', 'eg');
    expect(pov).not.toBeNull();
    expect(pov.altitude).toBeGreaterThanOrEqual(0.3);
  });

  it('returns null when the target region has no known coordinates', () => {
    expect(getFramingPov('eg', 'not-a-real-region')).toBeNull();
  });
});

describe('effect lifetime durations', () => {
  it('both implemented primitives report a positive total duration', () => {
    expect(ARC_EFFECT_DURATION_MS).toBeGreaterThan(0);
    expect(PULSE_EFFECT_DURATION_MS).toBeGreaterThan(0);
  });
});
