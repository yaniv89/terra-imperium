import { describe, it, expect } from 'vitest';
import { createRng } from '../utils/rng';
import { generateGeneral, PERSONALITIES, getGeneralDamageMultiplier, getGeneralDefenseMultiplier, getGeneralXpMultiplier } from './generals';

describe('generateGeneral', () => {
  it('produces traits within the 1-5 range and a valid personality', () => {
    const general = generateGeneral(createRng(1), 'gen_1', 'fr');
    ['martial', 'shock', 'fire', 'maneuver'].forEach((axis) => {
      expect(general[axis]).toBeGreaterThanOrEqual(1);
      expect(general[axis]).toBeLessThanOrEqual(5);
    });
    expect(PERSONALITIES).toContain(general.personality);
    expect(general.assignedUnitId).toBeNull();
    expect(general.nationId).toBe('fr');
  });

  it('is deterministic for a given seed', () => {
    const a = generateGeneral(createRng(99), 'gen_1', 'fr');
    const b = generateGeneral(createRng(99), 'gen_1', 'fr');
    expect(a).toEqual(b);
  });
});

describe('getGeneralDamageMultiplier', () => {
  it('is neutral when there is no assigned general', () => {
    expect(getGeneralDamageMultiplier(null, 'shock', 'infantry')).toBe(1);
  });

  it('a high-martial general boosts damage in every phase', () => {
    const strong = { martial: 5, shock: 3, fire: 3, maneuver: 3, personality: 'cautious' };
    const weak = { martial: 1, shock: 3, fire: 3, maneuver: 3, personality: 'cautious' };
    expect(getGeneralDamageMultiplier(strong, 'shock', 'infantry')).toBeGreaterThan(getGeneralDamageMultiplier(weak, 'shock', 'infantry'));
  });

  it('the shock axis only boosts the shock phase, not ranged', () => {
    const general = { martial: 3, shock: 5, fire: 3, maneuver: 3, personality: 'cautious' };
    const neutralGeneral = { martial: 3, shock: 3, fire: 3, maneuver: 3, personality: 'cautious' };
    expect(getGeneralDamageMultiplier(general, 'shock', 'infantry')).toBeGreaterThan(getGeneralDamageMultiplier(neutralGeneral, 'shock', 'infantry'));
    expect(getGeneralDamageMultiplier(general, 'ranged', 'infantry')).toBe(getGeneralDamageMultiplier(neutralGeneral, 'ranged', 'infantry'));
  });

  it('a siegemaster general only boosts siege units', () => {
    const general = { martial: 3, shock: 3, fire: 3, maneuver: 3, personality: 'siegemaster' };
    expect(getGeneralDamageMultiplier(general, 'ranged', 'siege')).toBeGreaterThan(getGeneralDamageMultiplier(general, 'ranged', 'infantry'));
  });

  it('reckless boosts damage and cautious reduces it', () => {
    const base = { martial: 3, shock: 3, fire: 3, maneuver: 3 };
    const reckless = getGeneralDamageMultiplier({ ...base, personality: 'reckless' }, 'shock', 'infantry');
    const cautious = getGeneralDamageMultiplier({ ...base, personality: 'cautious' }, 'shock', 'infantry');
    expect(reckless).toBeGreaterThan(1);
    expect(cautious).toBeLessThan(1);
  });
});

describe('getGeneralDefenseMultiplier / getGeneralXpMultiplier', () => {
  it('cautious generals reduce incoming damage; others do not', () => {
    expect(getGeneralDefenseMultiplier({ personality: 'cautious' })).toBeLessThan(1);
    expect(getGeneralDefenseMultiplier({ personality: 'reckless' })).toBe(1);
    expect(getGeneralDefenseMultiplier(null)).toBe(1);
  });

  it('logistician generals boost XP gain; others do not', () => {
    expect(getGeneralXpMultiplier({ personality: 'logistician' })).toBeGreaterThan(1);
    expect(getGeneralXpMultiplier({ personality: 'reckless' })).toBe(1);
    expect(getGeneralXpMultiplier(null)).toBe(1);
  });
});
