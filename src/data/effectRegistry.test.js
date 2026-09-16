import { describe, it, expect } from 'vitest';
import { EFFECT_REGISTRY, getEffectSpec } from './effectRegistry';

describe('EFFECT_REGISTRY', () => {
  it('every entry declares a primitive, a two-tone palette, a glyph, and at least one projectile', () => {
    Object.entries(EFFECT_REGISTRY).forEach(([actionType, spec]) => {
      expect(typeof spec.primitive, `${actionType} has no primitive`).toBe('string');
      expect(spec.palette?.base, `${actionType} has no palette.base`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(spec.palette?.hot, `${actionType} has no palette.hot`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(typeof spec.head).toBe('string');
      expect(Array.isArray(spec.projectiles)).toBe(true);
      expect(spec.projectiles.length).toBeGreaterThan(0);
    });
  });

  it('every registered entry currently uses the implemented arc primitive', () => {
    // Only `arc` has a renderer today (GlobeEffectsOverlay) — a registry entry using an
    // unimplemented primitive would silently render nothing, so this guards against that until
    // more primitives ship.
    Object.values(EFFECT_REGISTRY).forEach(spec => {
      expect(spec.primitive).toBe('arc');
    });
  });
});

describe('getEffectSpec', () => {
  it('returns the exact registered spec for a known action type', () => {
    expect(getEffectSpec('air_strike')).toBe(EFFECT_REGISTRY.air_strike);
  });

  it('falls back to a default spec for an unknown action type rather than throwing', () => {
    expect(() => getEffectSpec('not_a_real_action')).not.toThrow();
    expect(getEffectSpec('not_a_real_action')).toBe(EFFECT_REGISTRY.missile_strike);
  });
});
