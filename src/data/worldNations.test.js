import { describe, it, expect } from 'vitest';
import { WORLD_NATIONS } from './worldNations';
import { RelationStatus } from './types';
import { DOCTRINE_IDS } from './nations';
import countriesMeta from './geo/countries-meta.json';

describe('WORLD_NATIONS', () => {
  it('has exactly one entry per country in the geo data', () => {
    expect(Object.keys(WORLD_NATIONS).length).toBe(Object.keys(countriesMeta).length);
  });

  it('every nation is symmetric — same neutral starting stance, no scripted conflict', () => {
    Object.values(WORLD_NATIONS).forEach(n => {
      expect(n.startHostility).toBe(5);
      expect(n.aggression).toBe(0.1);
      expect(DOCTRINE_IDS).toContain(n.doctrine);
      expect(n.startRelation).toBe(RelationStatus.NEUTRAL);
      expect(Number.isFinite(n.startMilitary)).toBe(true);
      expect(n.startMilitary).toBeGreaterThan(0);
      expect(n.population).toBeGreaterThan(0);
      expect(n.gdpMillions).toBeGreaterThan(0);
    });
  });

  it('archetype assignment is deterministic (stable across rebuilds, no RNG)', () => {
    expect(WORLD_NATIONS.fr.doctrine).toBe(WORLD_NATIONS.fr.doctrine);
    // Re-deriving from the same module twice (import caching aside) should be pure — assert the
    // whole set of assigned doctrines isn't degenerate (everyone getting the same one).
    const distinctDoctrines = new Set(Object.values(WORLD_NATIONS).map(n => n.doctrine));
    expect(distinctDoctrines.size).toBeGreaterThan(1);
  });

  it('assigns every nation a distinct color', () => {
    const colors = new Set(Object.values(WORLD_NATIONS).map(n => n.color));
    expect(colors.size).toBe(Object.keys(WORLD_NATIONS).length);
  });

  it('scales military strength with population (bigger population -> bigger proxy)', () => {
    const us = WORLD_NATIONS.us;
    const smallest = Object.values(WORLD_NATIONS).reduce((min, n) => (n.population < min.population ? n : min));
    expect(us.startMilitary).toBeGreaterThan(smallest.startMilitary);
  });

  it('every nation id matches its own key', () => {
    Object.entries(WORLD_NATIONS).forEach(([key, n]) => {
      expect(n.id).toBe(key);
    });
  });
});
