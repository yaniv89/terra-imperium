import { describe, it, expect } from 'vitest';
import { createRng } from '../utils/rng';
import { createRuler, attributeCap, getAdvisorHireCost, getAdvisorSalary, generateAdvisorCandidates } from './rulers';
import { RULER_START, attributeCapAt } from '../data/rulers';
import { AGE_ORDER, FIRST_AGE_ID, LAST_AGE_ID, nextAgeId } from '../data/ages';
import { createInitialState } from './gameReducer';

describe('createRuler (differentiation plan U5)', () => {
  it('is fixed: the same ruler for the same nation, no rolls, reign or house', () => {
    expect(createRuler('akkad')).toEqual({ id: 'ruler_akkad', name: 'Sargon', ...RULER_START, renown: 0, traits: [] });
    expect(createRuler('fr')).toEqual(createRuler('fr'));
    expect(typeof createRuler('fr').name).toBe('string');
  });

  it('every major of a Standard peoples world starts 3/3/3/0/0/0', () => {
    const state = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
    const majors = Object.values(state.nations).filter((n) => n.kind !== 'independent');
    expect(majors.length).toBeGreaterThan(5);
    majors.forEach((n) => expect(n.ruler).toEqual({ id: `ruler_${n.id}`, name: n.ruler.name, adm: 3, dip: 3, mil: 3, cmd: 0, lrn: 0, maj: 0, renown: 0, traits: [] }));
    Object.values(state.nations).filter((n) => n.kind === 'independent').forEach((n) => expect(n.ruler).toBeNull());
  });
});

describe('attribute caps by research age (KTD1)', () => {
  it('rise from 4 in the first age to 8 in the last, never falling', () => {
    expect(attributeCapAt(0, AGE_ORDER.length)).toBe(4);
    expect(attributeCapAt(AGE_ORDER.length - 1, AGE_ORDER.length)).toBe(8);
    for (let i = 1; i < AGE_ORDER.length; i++) expect(attributeCapAt(i, AGE_ORDER.length)).toBeGreaterThanOrEqual(attributeCapAt(i - 1, AGE_ORDER.length));
    expect(attributeCapAt(1, 5)).toBe(5);
    expect(attributeCapAt(1, 8)).toBe(5);
  });

  it("follow each nation's own age: the one that researches ahead gets the next cap, its neighbour does not", () => {
    const state = { playerNationId: 'p', techAgeId: FIRST_AGE_ID, nations: { a: { tech: { ageId: nextAgeId(FIRST_AGE_ID) } }, b: { tech: { ageId: FIRST_AGE_ID } }, c: { tech: { ageId: LAST_AGE_ID } } } };
    expect(attributeCap(state, 'b')).toBe(4);
    expect(attributeCap(state, 'p')).toBe(4);
    expect(attributeCap(state, 'a')).toBe(attributeCapAt(1, AGE_ORDER.length));
    expect(attributeCap(state, 'a')).toBeGreaterThan(attributeCap(state, 'b'));
    expect(attributeCap(state, 'c')).toBe(8);
  });
});

describe('advisor cost formulas', () => {
  it('hire cost is 50g times level squared', () => {
    expect(getAdvisorHireCost(1)).toBe(50);
    expect(getAdvisorHireCost(2)).toBe(200);
    expect(getAdvisorHireCost(3)).toBe(450);
  });

  it('salary is 2g times level squared', () => {
    expect(getAdvisorSalary(1)).toBe(2);
    expect(getAdvisorSalary(2)).toBe(8);
    expect(getAdvisorSalary(3)).toBe(18);
  });
});

describe('generateAdvisorCandidates', () => {
  it('produces 3 candidates for each of the three pools', () => {
    const pool = generateAdvisorCandidates('fr', createRng(1));
    expect(pool.adm).toHaveLength(3);
    expect(pool.dip).toHaveLength(3);
    expect(pool.mil).toHaveLength(3);
  });

  it('every candidate has a level between 1 and 3', () => {
    const pool = generateAdvisorCandidates('fr', createRng(4));
    [...pool.adm, ...pool.dip, ...pool.mil].forEach((c) => {
      expect(c.level).toBeGreaterThanOrEqual(1);
      expect(c.level).toBeLessThanOrEqual(3);
    });
  });
});

describe('generateAdvisorCandidates names', () => {
  it('never repeats a name within a court, for every seed', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const all = Object.values(generateAdvisorCandidates('akkad', createRng(seed), ['Ruler Name'])).flat().map((a) => a.name);
      expect(new Set(all).size).toBe(all.length);
    }
  });
  it('is deterministic and survives a court that has taken most of the list', async () => {
    const { givenNamePool } = await import('../data/names');
    const pool = givenNamePool('akkad');
    const avoid = pool.slice(0, pool.length - 3);
    const a = generateAdvisorCandidates('akkad', createRng(7), avoid);
    const b = generateAdvisorCandidates('akkad', createRng(7), avoid);
    expect(a).toEqual(b);
    const names = Object.values(a).flat().map((x) => x.name);
    expect(new Set(names).size).toBe(9);
    names.forEach((n) => expect(avoid).not.toContain(n));
  });
  it('keeps the rng stream when the first roll is free', () => {
    const r1 = createRng(3); const r2 = createRng(3);
    generateAdvisorCandidates('akkad', r1, []);
    expect(r1.next()).not.toBeNaN();
    expect(r2.next()).not.toBeNaN();
  });
});
