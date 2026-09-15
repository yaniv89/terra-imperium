import { describe, it, expect } from 'vitest';
import { PERSONAS, getPersonaBonus } from './personas';

describe('getPersonaBonus (Phase 8: commander bonuses)', () => {
  it('returns the bonus value for a known persona and key', () => {
    expect(getPersonaBonus('rafael_katz', 'armorMult')).toBe(1.15);
    expect(getPersonaBonus('yael_ronen', 'supplyDecayMult')).toBe(0.6);
  });

  it('defaults to 1 (neutral) for a key the persona does not have', () => {
    expect(getPersonaBonus('rafael_katz', 'supplyDecayMult')).toBe(1);
  });

  it('defaults to 1 for no commander assigned (null/undefined persona id)', () => {
    expect(getPersonaBonus(null, 'armorMult')).toBe(1);
    expect(getPersonaBonus(undefined, 'armorMult')).toBe(1);
  });

  it('defaults to 1 for an unknown persona id rather than throwing', () => {
    expect(() => getPersonaBonus('not_a_real_persona', 'armorMult')).not.toThrow();
    expect(getPersonaBonus('not_a_real_persona', 'armorMult')).toBe(1);
  });

  it('every persona has a unique id matching its key, a name, and at least one bonus', () => {
    Object.entries(PERSONAS).forEach(([key, persona]) => {
      expect(persona.id).toBe(key);
      expect(typeof persona.name).toBe('string');
      expect(Object.keys(persona.bonus).length).toBeGreaterThan(0);
    });
  });
});
