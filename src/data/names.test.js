import { describe, it, expect } from 'vitest';
import { createRng } from '../utils/rng';
import { getCultureGroup, generateGivenName, nameGroupOf } from './names';

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

describe('generateGivenName', () => {
  it('is deterministic for the same nation and rng seed', () => {
    expect(generateGivenName('fr', createRng(1))).toBe(generateGivenName('fr', createRng(1)));
  });

  it('always returns a non-empty string, even for an unmapped nation', () => {
    const rng = createRng(2);
    expect(typeof generateGivenName('zz-not-a-real-nation', rng)).toBe('string');
    expect(generateGivenName('zz-not-a-real-nation', rng).length).toBeGreaterThan(0);
  });
});

describe('peoples take names of their own culture (manual playtest 29 Oct)', () => {
  it('maps every people of the pool to an ancient group', async () => {
    const { PEOPLES_LIST } = await import('./peoples');
    const modern = ['western_european', 'southern_european', 'slavic_eastern_european', 'mena', 'east_asian', 'south_asian', 'sub_saharan_african', 'latin_american', 'generic'];
    PEOPLES_LIST.forEach((p) => expect(modern, p.id).not.toContain(nameGroupOf(p.id)));
  });
  it('gives the Mycenaeans Greek names, never Spanish ones', () => {
    const rng = createRng(7);
    const names = Array.from({ length: 40 }, () => generateGivenName('ahhiyawa', rng));
    expect(names).not.toContain('Beatriz');
    expect(nameGroupOf('ahhiyawa')).toBe('aegean');
  });
});
