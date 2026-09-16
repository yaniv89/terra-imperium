import { describe, it, expect } from 'vitest';
import { WORLD_NATIONS } from './worldNations';
import { NATIONS_DATA } from './nations';
import countriesMeta from './geo/countries-meta.json';

const HAND_TUNED_IDS = Object.keys(NATIONS_DATA);

describe('WORLD_NATIONS', () => {
  it('has one entry per country in the geo data, plus stateless hand-tuned nations (Hamas)', () => {
    // Hamas has no territory of its own, so it can't be reached by iterating the country tier —
    // it's carried over directly instead, one entry beyond the country count.
    expect(Object.keys(WORLD_NATIONS).length).toBe(Object.keys(countriesMeta).length + 1);
  });

  it('preserves every hand-tuned nation as the exact same object (zero balance drift risk), including stateless Hamas', () => {
    HAND_TUNED_IDS.forEach((id) => {
      expect(WORLD_NATIONS[id]).toBe(NATIONS_DATA[id]);
    });
  });

  it('generates a nation for every country not in the hand-tuned campaign', () => {
    const isHandTuned = (n) => HAND_TUNED_IDS.some((id) => WORLD_NATIONS[id] === n);
    const generated = Object.values(WORLD_NATIONS).filter((n) => !isHandTuned(n));
    const handTunedCount = Object.values(WORLD_NATIONS).filter(isHandTuned).length;
    // All 16 hand-tuned nations appear in WORLD_NATIONS now (see the previous test), but only 15
    // of them (everyone except stateless Hamas) actually occupy a slot in the country tier —
    // that's the count generated countries must be short by.
    expect(handTunedCount).toBe(16);
    expect(generated.length).toBe(Object.keys(countriesMeta).length - 15);
    generated.forEach((n) => {
      expect(typeof n.name).toBe('string');
      expect(n.color).toMatch(/^hsl\(\d+, 55%, 45%\)$/);
      expect(n.startHostility).toBe(5);
      expect(n.aggression).toBe(0.1);
      expect(n.doctrine).toBe('cautious');
      expect(Number.isFinite(n.startMilitary)).toBe(true);
      expect(n.startMilitary).toBeGreaterThan(0);
      expect(n.population).toBeGreaterThan(0);
      expect(n.gdpMillions).toBeGreaterThan(0);
    });
  });

  it('assigns every generated nation a distinct color', () => {
    const generated = Object.values(WORLD_NATIONS).filter((n) => !HAND_TUNED_IDS.includes(n.id));
    const colors = new Set(generated.map((n) => n.color));
    expect(colors.size).toBe(generated.length);
  });

  it('scales military strength with population (bigger population -> bigger proxy)', () => {
    const us = WORLD_NATIONS.us;
    const smallest = Object.values(WORLD_NATIONS)
      .filter((n) => !HAND_TUNED_IDS.includes(n.id))
      .reduce((min, n) => (n.population < min.population ? n : min));
    expect(us.startMilitary).toBeGreaterThan(smallest.startMilitary);
  });

  it('does not affect the existing campaign — NATIONS_DATA is untouched', () => {
    expect(Object.keys(NATIONS_DATA).length).toBe(16); // 15 territorial nations + stateless Hamas
    expect(NATIONS_DATA.egypt.startMilitary).toBe(15000);
  });
});
