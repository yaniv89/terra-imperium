import { describe, it, expect } from 'vitest';
import { createRng } from '../utils/rng';
import {
  rulerStyleFor, reignLengthTurns, generateRuler, processReignEnd,
  getAdvisorHireCost, getAdvisorSalary, generateAdvisorCandidates
} from './rulers';

describe('rulerStyleFor', () => {
  it('biases a Theocracy toward ADM and a Dictatorship toward MIL, nothing else', () => {
    expect(rulerStyleFor({ type: 'theocracy' })).toBe('theocratic');
    expect(rulerStyleFor({ type: 'dictatorship' })).toBe('autocratic');
    expect(rulerStyleFor({ type: 'monarchy' })).toBe(null);
    expect(rulerStyleFor(null)).toBe(null);
  });
});

describe('reignLengthTurns', () => {
  it('is always within the clamped [3, 25] turn range regardless of age/speed', () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const length = reignLengthTurns(rng, 'bronze', 'normal');
      expect(length).toBeGreaterThanOrEqual(3);
      expect(length).toBeLessThanOrEqual(25);
    }
  });

  it('produces shorter turn-spans in a later age (fewer years per turn) than Bronze, for the same rng draws', () => {
    const bronze = reignLengthTurns(createRng(42), 'bronze', 'normal');
    const modern = reignLengthTurns(createRng(42), 'modern', 'normal');
    expect(modern).toBeGreaterThanOrEqual(bronze);
  });
});

describe('generateRuler', () => {
  it('is fully deterministic from (nationId, turnNumber) given the same rng draws', () => {
    const a = generateRuler('fr', createRng(7), { turnNumber: 5, age: 'bronze', gameSpeed: 'normal' });
    const b = generateRuler('fr', createRng(7), { turnNumber: 5, age: 'bronze', gameSpeed: 'normal' });
    expect(a).toEqual(b);
  });

  it('ids are derived from nationId and turnNumber, never a mutable counter', () => {
    const ruler = generateRuler('de', createRng(3), { turnNumber: 12, age: 'bronze', gameSpeed: 'normal' });
    expect(ruler.id).toBe('ruler_de_12');
  });

  it('rolls adm/dip/mil skill within 0-6', () => {
    const rng = createRng(99);
    for (let i = 0; i < 50; i++) {
      const ruler = generateRuler('fr', rng, { turnNumber: i, age: 'bronze', gameSpeed: 'normal' });
      ['adm', 'dip', 'mil'].forEach((k) => {
        expect(ruler[k]).toBeGreaterThanOrEqual(0);
        expect(ruler[k]).toBeLessThanOrEqual(6);
      });
    }
  });

  it('rolls 0-2 traits, all valid trait ids, with no duplicates', () => {
    const rng = createRng(55);
    for (let i = 0; i < 50; i++) {
      const ruler = generateRuler('fr', rng, { turnNumber: i, age: 'bronze', gameSpeed: 'normal' });
      expect(ruler.traits.length).toBeLessThanOrEqual(2);
      expect(new Set(ruler.traits).size).toBe(ruler.traits.length);
    }
  });

  it('sets reignEndsTurn to reignStartTurn plus a positive reign length', () => {
    const ruler = generateRuler('fr', createRng(1), { turnNumber: 10, age: 'bronze', gameSpeed: 'normal' });
    expect(ruler.reignStartTurn).toBe(10);
    expect(ruler.reignEndsTurn).toBeGreaterThan(10);
  });

  it('theocratic style biases ADM upward (rolls twice, keeps the higher)', () => {
    const rng = createRng(3);
    let theocraticTotal = 0;
    let plainTotal = 0;
    for (let i = 0; i < 100; i++) {
      theocraticTotal += generateRuler('fr', rng, { turnNumber: i, age: 'bronze', gameSpeed: 'normal', style: 'theocratic' }).adm;
    }
    for (let i = 0; i < 100; i++) {
      plainTotal += generateRuler('fr', rng, { turnNumber: i, age: 'bronze', gameSpeed: 'normal' }).adm;
    }
    expect(theocraticTotal).toBeGreaterThan(plainTotal);
  });

  it('autocratic style floors MIL at 3', () => {
    const rng = createRng(11);
    for (let i = 0; i < 50; i++) {
      expect(generateRuler('fr', rng, { turnNumber: i, age: 'bronze', gameSpeed: 'normal', style: 'autocratic' }).mil).toBeGreaterThanOrEqual(3);
    }
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

describe('processReignEnd', () => {
  const ctx = { turnNumber: 20, age: 'bronze', gameSpeed: 'normal' };
  const ruler = generateRuler('fr', createRng(1), { dynasty: 'Capet', turnNumber: 1, age: 'bronze', gameSpeed: 'normal' });

  it('returns null while the reign has not ended, or with no ruler at all', () => {
    expect(processReignEnd({ id: 'fr', ruler: { ...ruler, reignEndsTurn: 21 } }, createRng(1), ctx)).toBe(null);
    expect(processReignEnd({ id: 'fr', ruler: null }, createRng(1), ctx)).toBe(null);
  });

  it('a monarchy keeps its royal house; a new ruler starts reigning this turn', () => {
    const next = processReignEnd({ id: 'fr', government: { type: 'monarchy' }, ruler: { ...ruler, reignEndsTurn: 20 } }, createRng(2), ctx);
    expect(next.dynasty).toBe('Capet');
    expect(next.id).toBe('ruler_fr_20');
    expect(next.reignStartTurn).toBe(20);
    expect(next.reignEndsTurn).toBeGreaterThan(20);
  });

  it('any other government rolls a new house name and carries no heir or claim', () => {
    const next = processReignEnd({ id: 'fr', government: { type: 'republic' }, ruler: { ...ruler, reignEndsTurn: 20 } }, createRng(2), ctx);
    expect(typeof next.dynasty).toBe('string');
    expect(next).not.toHaveProperty('claim');
    expect(next).not.toHaveProperty('consort');
  });
});
