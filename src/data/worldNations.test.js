import { describe, it, expect } from 'vitest';
import { WORLD_NATIONS } from './worldNations';
import { RelationStatus } from './types';
import countriesMeta from './geo/countries-meta.json';

describe('WORLD_NATIONS', () => {
  it('has exactly one entry per country in the geo data', () => {
    expect(Object.keys(WORLD_NATIONS).length).toBe(Object.keys(countriesMeta).length);
  });

  it('every nation is symmetric — same neutral starting stance, no scripted conflict', () => {
    Object.values(WORLD_NATIONS).forEach(n => {
      expect(n.startHostility).toBe(5);
      expect(n.aggression).toBe(0.1);
      expect(n.doctrine).toBe('cautious');
      expect(n.startRelation).toBe(RelationStatus.NEUTRAL);
      expect(Number.isFinite(n.startMilitary)).toBe(true);
      expect(n.startMilitary).toBeGreaterThan(0);
      expect(n.population).toBeGreaterThan(0);
      expect(n.gdpMillions).toBeGreaterThan(0);
    });
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
