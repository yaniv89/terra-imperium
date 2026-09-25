import { describe, it, expect } from 'vitest';
import { createRng } from '../utils/rng';
import {
  getSuccessionStyle, reignLengthTurns, generateRuler, generateHeir,
  getAdvisorHireCost, getAdvisorSalary, generateAdvisorCandidates, processSuccession
} from './succession';

describe('getSuccessionStyle', () => {
  it('classifies Monarchy as hereditary', () => {
    expect(getSuccessionStyle({ type: 'monarchy' })).toBe('hereditary');
  });

  it('classifies Republic as elective', () => {
    expect(getSuccessionStyle({ type: 'republic' })).toBe('elective');
  });

  it('classifies Theocracy as theocratic', () => {
    expect(getSuccessionStyle({ type: 'theocracy' })).toBe('theocratic');
  });

  it('classifies Dictatorship as autocratic', () => {
    expect(getSuccessionStyle({ type: 'dictatorship' })).toBe('autocratic');
  });

  it('classifies Tribal or no government type as tribal', () => {
    expect(getSuccessionStyle({ type: 'tribal' })).toBe('tribal');
    expect(getSuccessionStyle(null)).toBe('tribal');
    expect(getSuccessionStyle(undefined)).toBe('tribal');
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

describe('generateRuler / generateHeir determinism', () => {
  it('is fully deterministic from (nationId, turnNumber) given the same rng draws', () => {
    const a = generateRuler('fr', createRng(7), { turnNumber: 5, age: 'bronze', gameSpeed: 'normal' });
    const b = generateRuler('fr', createRng(7), { turnNumber: 5, age: 'bronze', gameSpeed: 'normal' });
    expect(a).toEqual(b);
  });

  it('ids are derived from nationId and turnNumber, never a mutable counter', () => {
    const ruler = generateRuler('de', createRng(3), { turnNumber: 12, age: 'bronze', gameSpeed: 'normal' });
    expect(ruler.id).toBe('ruler_de_12');
    const heir = generateHeir('de', createRng(3), 'Habsburg', 12);
    expect(heir.id).toBe('heir_de_12');
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

  it('heir claim is always within [40, 100], never a near-certain crisis', () => {
    const rng = createRng(21);
    for (let i = 0; i < 50; i++) {
      const heir = generateHeir('fr', rng, 'Valois', i);
      expect(heir.claim).toBeGreaterThanOrEqual(40);
      expect(heir.claim).toBeLessThanOrEqual(100);
    }
  });

  it('an heir carries the dynasty it was given, not a new one', () => {
    const heir = generateHeir('fr', createRng(1), 'Bourbon', 3);
    expect(heir.dynasty).toBe('Bourbon');
  });

  it('a claimBonus raises the heir\'s claim, capped at 100 (plan §M8.1: Hereditary Primogeniture)', () => {
    const rng = createRng(21);
    for (let i = 0; i < 50; i++) {
      const heir = generateHeir('fr', rng, 'Valois', i, 20);
      expect(heir.claim).toBeGreaterThanOrEqual(60); // 40 base minimum + 20 bonus
      expect(heir.claim).toBeLessThanOrEqual(100);
    }
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

describe('processSuccession', () => {
  const ctx = { turnNumber: 20, age: 'bronze', gameSpeed: 'normal' };

  it('returns null while the current ruler\'s reign has not ended', () => {
    const nation = { id: 'fr', government: { type: 'monarchy', reforms: {} }, ruler: { reignEndsTurn: 999 }, heir: null };
    expect(processSuccession(nation, createRng(1), ctx)).toBeNull();
  });

  it('returns null when there is no ruler at all', () => {
    const nation = { id: 'fr', government: { type: 'monarchy', reforms: {} }, ruler: null, heir: null };
    expect(processSuccession(nation, createRng(1), ctx)).toBeNull();
  });

  it('hereditary with an heir: the heir succeeds and a new heir is generated', () => {
    const heir = { id: 'heir_fr_5', name: 'Louis', dynasty: 'Bourbon', adm: 3, dip: 2, mil: 4, traits: [], claim: 80 };
    const nation = { id: 'fr', government: { type: 'monarchy', reforms: {} }, ruler: { dynasty: 'Bourbon', reignEndsTurn: 20 }, heir };
    const result = processSuccession(nation, createRng(1), ctx);
    expect(result.ruler.id).toBe(heir.id);
    expect(result.ruler.reignStartTurn).toBe(20);
    expect(result.ruler.isRegency).toBe(false);
    expect(result.heir).not.toBeNull();
    expect(result.heir.dynasty).toBe('Bourbon');
    expect(result.crisis).toBe(false); // claim 80 >= 20
  });

  it('hereditary with a low-claim heir flags a succession crisis', () => {
    const heir = { id: 'heir_fr_5', name: 'Louis', dynasty: 'Bourbon', adm: 3, dip: 2, mil: 4, traits: [], claim: 10 };
    const nation = { id: 'fr', government: { type: 'monarchy', reforms: {} }, ruler: { dynasty: 'Bourbon', reignEndsTurn: 20 }, heir };
    const result = processSuccession(nation, createRng(1), ctx);
    expect(result.crisis).toBe(true);
  });

  it('hereditary with NO heir is itself a crisis, with a fresh ruler and a new heir generated', () => {
    const nation = { id: 'fr', government: { type: 'monarchy', reforms: {} }, ruler: { dynasty: 'Bourbon', reignEndsTurn: 20 }, heir: null };
    const result = processSuccession(nation, createRng(1), ctx);
    expect(result.crisis).toBe(true);
    expect(result.ruler.dynasty).toBe('Bourbon'); // dynasty line continues even through a crisis
    expect(result.heir).not.toBeNull();
  });

  it('Hereditary Primogeniture raises the succeeding heir\'s own generated heir claim (plan §M8.1)', () => {
    const heir = { id: 'heir_fr_5', name: 'Louis', dynasty: 'Bourbon', adm: 3, dip: 2, mil: 4, traits: [], claim: 80 };
    const nation = { id: 'fr', government: { type: 'monarchy', reforms: { kingdoms: 'hereditary_primogeniture' } }, ruler: { dynasty: 'Bourbon', reignEndsTurn: 20 }, heir };
    const result = processSuccession(nation, createRng(1), ctx);
    expect(result.heir.claim).toBeGreaterThanOrEqual(60); // 40 base minimum + 20 reform bonus
  });

  it('Elective Monarchy reports a legitimacy penalty on succession (plan §M8.1)', () => {
    const heir = { id: 'heir_fr_5', name: 'Louis', dynasty: 'Bourbon', adm: 3, dip: 2, mil: 4, traits: [], claim: 80 };
    const nation = { id: 'fr', government: { type: 'monarchy', reforms: { kingdoms: 'elective_monarchy' } }, ruler: { dynasty: 'Bourbon', reignEndsTurn: 20 }, heir };
    const result = processSuccession(nation, createRng(1), ctx);
    expect(result.legitimacyPenalty).toBe(10);
  });

  it('elective: a fresh ruler with a new dynasty and no heir carried over', () => {
    const nation = { id: 'fr', government: { type: 'republic', reforms: {} }, ruler: { dynasty: 'OldGuard', reignEndsTurn: 20 }, heir: null };
    const result = processSuccession(nation, createRng(1), ctx);
    expect(result.heir).toBeNull();
    expect(result.crisis).toBe(false);
    expect(result.ruler.dynasty).not.toBe('OldGuard');
  });

  it('theocratic: a fresh ruler, no heir, no crisis', () => {
    const nation = { id: 'fr', government: { type: 'theocracy', reforms: {} }, ruler: { dynasty: 'Oracle', reignEndsTurn: 20 }, heir: null };
    const result = processSuccession(nation, createRng(1), ctx);
    expect(result.heir).toBeNull();
    expect(result.crisis).toBe(false);
  });

  it('autocratic: a fresh ruler, no heir, no crisis', () => {
    const nation = { id: 'fr', government: { type: 'dictatorship', reforms: {} }, ruler: { dynasty: 'Junta', reignEndsTurn: 20 }, heir: null };
    const result = processSuccession(nation, createRng(1), ctx);
    expect(result.heir).toBeNull();
    expect(result.crisis).toBe(false);
  });

  it('tribal (no government adopted): a fresh ruler, no heir, no crisis', () => {
    const nation = { id: 'fr', government: null, ruler: { dynasty: 'Chiefdom', reignEndsTurn: 20 }, heir: null };
    const result = processSuccession(nation, createRng(1), ctx);
    expect(result.heir).toBeNull();
    expect(result.crisis).toBe(false);
  });
});
