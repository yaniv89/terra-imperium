import { describe, it, expect } from 'vitest';
import { RESOURCE_DEPOSITS, hasDeposit, getDepositsFor } from './deposits';
import countriesMeta from './geo/countries-meta.json';

describe('RESOURCE_DEPOSITS', () => {
  it('every key is a real country id', () => {
    Object.keys(RESOURCE_DEPOSITS).forEach(id => {
      expect(countriesMeta[id], `${id} is not a real country id`).toBeDefined();
    });
  });

  it('only lists copper/iron/oil, never an unlocked-later resource', () => {
    Object.values(RESOURCE_DEPOSITS).forEach(list => {
      list.forEach(resourceId => {
        expect(['copper', 'iron', 'oil']).toContain(resourceId);
      });
    });
  });

  it('is not exhaustive over all 240 nations — scarcity is the point', () => {
    expect(Object.keys(RESOURCE_DEPOSITS).length).toBeLessThan(Object.keys(countriesMeta).length);
  });
});

describe('hasDeposit / getDepositsFor', () => {
  it('reports a known deposit', () => {
    expect(hasDeposit('sa', 'oil')).toBe(true);
    expect(getDepositsFor('sa')).toContain('oil');
  });

  it('reports false/empty for a nation with no listed deposits', () => {
    expect(hasDeposit('is', 'oil')).toBe(false);
    expect(getDepositsFor('is')).toEqual([]);
  });

  it('reports false for a deposit type a nation does not have', () => {
    expect(hasDeposit('sa', 'iron')).toBe(false);
  });

  it('handles an unknown country id without throwing', () => {
    expect(() => hasDeposit('not-a-real-country', 'oil')).not.toThrow();
    expect(getDepositsFor('not-a-real-country')).toEqual([]);
  });
});
