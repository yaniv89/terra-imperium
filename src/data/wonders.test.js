import { describe, it, expect } from 'vitest';
import { WONDERS, WONDER_IDS, canConstructWonder } from './wonders';
import { AGE_ORDER } from './ages';

describe('WONDERS data integrity', () => {
  it('every wonder belongs to a real age', () => {
    Object.values(WONDERS).forEach((wonder) => {
      expect(AGE_ORDER, wonder.id).toContain(wonder.age);
    });
  });

  it('covers every age with at least one wonder', () => {
    AGE_ORDER.forEach((ageId) => {
      expect(Object.values(WONDERS).some((w) => w.age === ageId)).toBe(true);
    });
  });

  it('every wonder has at least one real bonus-hook effect', () => {
    Object.values(WONDERS).forEach((wonder) => {
      expect(Object.keys(wonder.effect).length).toBeGreaterThan(0);
    });
  });
});

describe('canConstructWonder', () => {
  it('allows a wonder at its own age', () => {
    expect(canConstructWonder('pyramids', 'bronze', {})).toBe(true);
  });

  it('allows rushing one age ahead of the calendar', () => {
    expect(canConstructWonder('greatLibrary', 'bronze', {})).toBe(true);
  });

  it('rejects a wonder two or more ages ahead', () => {
    expect(canConstructWonder('grandBazaar', 'bronze', {})).toBe(false);
  });

  it('rejects an unknown wonder id', () => {
    expect(canConstructWonder('not_real', 'modern', {})).toBe(false);
  });

  it('rejects a wonder already claimed by any nation, even the caller\'s own', () => {
    expect(canConstructWonder('pyramids', 'modern', { pyramids: 'us' })).toBe(false);
    expect(canConstructWonder('pyramids', 'modern', { pyramids: 'fr' })).toBe(false);
  });

  it('has exactly WONDER_IDS.length entries in WONDERS (no orphaned key)', () => {
    expect(WONDER_IDS.length).toBe(Object.keys(WONDERS).length);
  });
});
