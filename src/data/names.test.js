import { describe, it, expect } from 'vitest';
import { createRng } from '../utils/rng';
import { getCultureGroup, generateGivenName, generateDynastyName } from './names';

describe('getCultureGroup', () => {
  it('maps a curated country to its named group', () => {
    expect(getCultureGroup('fr')).toBe('western_european');
    expect(getCultureGroup('cn')).toBe('east_asian');
    expect(getCultureGroup('eg')).toBe('mena');
  });

  it('falls back to generic for an unlisted nation id', () => {
    expect(getCultureGroup('zz-not-a-real-nation')).toBe('generic');
  });
});

describe('generateGivenName / generateDynastyName', () => {
  it('is deterministic for the same nation and rng seed', () => {
    expect(generateGivenName('fr', createRng(1))).toBe(generateGivenName('fr', createRng(1)));
    expect(generateDynastyName('fr', createRng(1))).toBe(generateDynastyName('fr', createRng(1)));
  });

  it('always returns a non-empty string, even for an unmapped nation', () => {
    const rng = createRng(2);
    expect(typeof generateGivenName('zz-not-a-real-nation', rng)).toBe('string');
    expect(generateGivenName('zz-not-a-real-nation', rng).length).toBeGreaterThan(0);
  });
});
