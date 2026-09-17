import { describe, it, expect } from 'vitest';
import { EFFECT_REGISTRY, getEffectSpec } from './effectRegistry';

const IMPLEMENTED_PRIMITIVES = ['arc', 'pulse'];
const PULSE_GLYPHS = ['circle', 'square', 'diamond', 'triangle', 'star'];

describe('EFFECT_REGISTRY', () => {
  it('every entry declares a primitive and a two-tone palette', () => {
    Object.entries(EFFECT_REGISTRY).forEach(([actionType, spec]) => {
      expect(typeof spec.primitive, `${actionType} has no primitive`).toBe('string');
      expect(spec.palette?.base, `${actionType} has no palette.base`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(spec.palette?.hot, `${actionType} has no palette.hot`).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('every `arc` entry declares a head glyph and at least one projectile', () => {
    Object.entries(EFFECT_REGISTRY).filter(([, spec]) => spec.primitive === 'arc').forEach(([actionType, spec]) => {
      expect(typeof spec.head, `${actionType} has no head`).toBe('string');
      expect(Array.isArray(spec.projectiles), `${actionType} has no projectiles array`).toBe(true);
      expect(spec.projectiles.length, `${actionType} has an empty projectiles array`).toBeGreaterThan(0);
    });
  });

  it('every `pulse` entry declares a known glyph, ring count and mote count', () => {
    Object.entries(EFFECT_REGISTRY).filter(([, spec]) => spec.primitive === 'pulse').forEach(([actionType, spec]) => {
      expect(PULSE_GLYPHS, `${actionType} has an unknown glyph "${spec.glyph}"`).toContain(spec.glyph);
      expect(typeof spec.rings, `${actionType} has no rings count`).toBe('number');
      expect(typeof spec.motes, `${actionType} has no motes count`).toBe('number');
    });
  });

  it('every registered entry uses an implemented primitive', () => {
    // Only `arc` and `pulse` have renderers today (GlobeEffectsOverlay) — a registry entry using
    // an unimplemented primitive would silently render nothing, so this guards against that until
    // more primitives ship.
    Object.entries(EFFECT_REGISTRY).forEach(([actionType, spec]) => {
      expect(IMPLEMENTED_PRIMITIVES, `${actionType} uses unimplemented primitive "${spec.primitive}"`).toContain(spec.primitive);
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
