import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EFFECT_REGISTRY, getEffectSpec } from './effectRegistry';
import { ACTION_COSTS } from './actionCosts';
import { SCENES } from '../effects/scenes';

describe('EFFECT_REGISTRY', () => {
  it('every entry names a real scene and a two-tone palette', () => {
    Object.entries(EFFECT_REGISTRY).forEach(([actionType, spec]) => {
      expect(SCENES[spec.scene], `${actionType} uses unknown scene "${spec.scene}"`).toBeDefined();
      expect(spec.palette?.base, `${actionType} has no palette.base`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(spec.palette?.hot, `${actionType} has no palette.hot`).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('every strike entry declares at least one projectile', () => {
    Object.entries(EFFECT_REGISTRY).filter(([, spec]) => spec.scene === 'strike').forEach(([actionType, spec]) => {
      expect(Array.isArray(spec.projectiles) && spec.projectiles.length > 0, `${actionType} has no projectiles`).toBe(true);
    });
  });

  it('actions are not all lumped into a couple of generic animations', () => {
    // The old registry had exactly two primitives for ~70 actions.
    expect(new Set(Object.values(EFFECT_REGISTRY).map((s) => s.scene)).size).toBeGreaterThanOrEqual(20);
  });
});

// Plan §13's "effects coverage": every action in ACTION_COSTS must have a real entry.
describe('effects coverage (plan §13)', () => {
  const IRREGULAR_EFFECT_TYPE = {
    launchInvasion: 'ground_invasion',
    declareWarJustified: 'declare_war',
    declareWarUnjustified: 'declare_war'
  };
  const toSnakeCase = (camel) => camel.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

  it('every action in ACTION_COSTS has a real EFFECT_REGISTRY entry', () => {
    const missing = Object.keys(ACTION_COSTS)
      .map((key) => IRREGULAR_EFFECT_TYPE[key] || toSnakeCase(key))
      .filter((effectType) => !EFFECT_REGISTRY[effectType]);
    expect(missing).toEqual([]);
  });

  // getEffectSpec silently falls back to a missile strike for an unknown type — which is how
  // develop_province, hire_advisor and increase_stability ended up playing a missile explosion.
  // This scans every real triggerEffect('...') call in the UI so that can't happen again.
  it('every effect type the UI actually triggers has a registry entry', () => {
    const srcDir = path.resolve(__dirname, '..');
    const files = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p); else if (/\.(jsx?|tsx?)$/.test(d.name) && !d.name.includes('.test.')) files.push(p);
    });
    walk(srcDir);
    const triggered = new Set();
    files.forEach((file) => {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/triggerEffect\(\s*'([a-z_]+)'/g)) triggered.add(m[1]);
      const map = text.match(/DIPLOMACY_EFFECT_BY_ACTION = \{([\s\S]*?)\};/);
      if (map) for (const m of map[1].matchAll(/:\s*'([a-z_]+)'/g)) triggered.add(m[1]);
    });
    expect(triggered.size).toBeGreaterThan(30);
    expect([...triggered].filter((t) => !EFFECT_REGISTRY[t])).toEqual([]);
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
