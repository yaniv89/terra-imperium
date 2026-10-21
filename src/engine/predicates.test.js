import { describe, it, expect } from 'vitest';
import { FACTS, factContext, predicateMet, gainBase, factsUsed } from './predicates';

// A context whose facts are fixed numbers (no map reads).
const ctxOf = (values) => ({ ...factContext({}, 'x'), memo: { ...values } });

describe('predicates', () => {
  it('a leaf is met at min (default 1); booleans count as 1', () => {
    expect(predicateMet({ fact: 'cities', min: 3 }, ctxOf({ cities: 2 }))).toBe(false);
    expect(predicateMet({ fact: 'cities', min: 3 }, ctxOf({ cities: 3 }))).toBe(true);
    expect(predicateMet({ fact: 'river' }, ctxOf({ river: 1 }))).toBe(true);
    expect(predicateMet({ fact: 'river' }, ctxOf({ river: 0 }))).toBe(false);
  });

  it('all, any and not combine leaves', () => {
    const c = ctxOf({ coastal: 1, harbour: 0, cities: 4 });
    expect(predicateMet({ all: [{ fact: 'coastal' }, { fact: 'harbour' }] }, c)).toBe(false);
    expect(predicateMet({ any: [{ fact: 'coastal' }, { fact: 'harbour' }] }, c)).toBe(true);
    expect(predicateMet({ not: { fact: 'harbour' } }, c)).toBe(true);
  });

  it('a gain counts only what came after the base', () => {
    const p = { fact: 'battlesWon', min: 2, gain: true };
    const base = gainBase(p, ctxOf({ battlesWon: 5 }));
    expect(base).toEqual({ battlesWon: 5 });
    expect(predicateMet(p, ctxOf({ battlesWon: 6 }), base)).toBe(false);
    expect(predicateMet(p, ctxOf({ battlesWon: 7 }), base)).toBe(true);
  });

  it('an unknown fact throws (a data bug), and factsUsed lists every leaf', () => {
    expect(() => predicateMet({ fact: 'nope' }, factContext({}, 'x'))).toThrow(/nope/);
    expect(factsUsed({ all: [{ fact: 'cities' }, { any: [{ fact: 'river' }, { not: { fact: 'trade' } }] }] })).toEqual(['cities', 'river', 'trade']);
    expect(Object.keys(FACTS)).toEqual(expect.arrayContaining(['cities', 'battlesWon', 'citiesTaken', 'techs', 'wonders']));
  });
});
