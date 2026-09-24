import { describe, it, expect } from 'vitest';
import {
  ESTATE_IDS, ESTATE_LABELS, ESTATE_THRESHOLD_BONUS, ESTATE_THRESHOLD_MALUS, ESTATE_PRIVILEGES,
  createInitialEstate, createInitialEstates, getPrivilege, getEstatePrivileges, clampCrownLand,
  CROWN_LAND_MIN, CROWN_LAND_MAX, LABOR_ESTATE_ID, ESTATE_LOYALTY_EQUILIBRIUM
} from './estates';

const RECOGNIZED_HOOKS = [
  'goldMult', 'hrMult', 'techPointsMult', 'stabilityBonus', 'popGrowthBonus', 'apBonus', 'admBonus',
  'dipBonus', 'milBonus', 'developmentCost', 'buildingCost', 'researchCost', 'stabilityCost',
  'supplyRange', 'attrition', 'governingCapacity'
];

describe('createInitialEstate(s)', () => {
  it('starts every estate at the loyalty equilibrium with no privileges', () => {
    const estate = createInitialEstate();
    expect(estate).toEqual({ loyalty: ESTATE_LOYALTY_EQUILIBRIUM, influence: 10, privileges: [] });
  });

  it('creates exactly the 3 always-present estates (Labor is added later, at Modern age)', () => {
    expect(Object.keys(createInitialEstates()).sort()).toEqual([...ESTATE_IDS].sort());
    expect(createInitialEstates()[LABOR_ESTATE_ID]).toBeUndefined();
  });
});

describe('ESTATE_THRESHOLD_BONUS / MALUS data integrity', () => {
  it('has an entry for every estate id, including Labor', () => {
    [...ESTATE_IDS, LABOR_ESTATE_ID].forEach((id) => {
      expect(ESTATE_THRESHOLD_BONUS, id).toHaveProperty(id);
      expect(ESTATE_THRESHOLD_MALUS, id).toHaveProperty(id);
    });
  });

  it('every threshold effect key is a real, wired modifier hook', () => {
    [ESTATE_THRESHOLD_BONUS, ESTATE_THRESHOLD_MALUS].forEach((table) => {
      Object.entries(table).forEach(([id, effect]) => {
        Object.keys(effect).forEach((hook) => expect(RECOGNIZED_HOOKS, `${id}/${hook}`).toContain(hook));
      });
    });
  });

  it('the malus is the bonus with the opposite sign, halved', () => {
    Object.keys(ESTATE_THRESHOLD_BONUS).forEach((id) => {
      Object.entries(ESTATE_THRESHOLD_BONUS[id]).forEach(([hook, value]) => {
        expect(ESTATE_THRESHOLD_MALUS[id][hook]).toBeCloseTo(-value / 2);
      });
    });
  });
});

describe('ESTATE_PRIVILEGES data integrity', () => {
  it('every estate (including Labor) has exactly 2 privileges', () => {
    [...ESTATE_IDS, LABOR_ESTATE_ID].forEach((id) => expect(getEstatePrivileges(id).length, id).toBe(2));
  });

  it('every privilege effect key is a real, wired modifier hook', () => {
    Object.values(ESTATE_PRIVILEGES).forEach((privileges) => {
      privileges.forEach((privilege) => {
        Object.keys(privilege.effects || {}).forEach((hook) => expect(RECOGNIZED_HOOKS, `${privilege.id}/${hook}`).toContain(hook));
      });
    });
  });

  it('getPrivilege returns the privilege by estate/id, or null for an unknown one', () => {
    expect(getPrivilege('clergy', 'religious_tax_exemption')?.name).toBe('Religious Tax Exemption');
    expect(getPrivilege('clergy', 'not_real')).toBeNull();
    expect(getPrivilege('not_an_estate', 'not_real')).toBeNull();
  });
});

describe('ESTATE_LABELS', () => {
  it('has a label for every estate id, including Labor', () => {
    [...ESTATE_IDS, LABOR_ESTATE_ID].forEach((id) => expect(typeof ESTATE_LABELS[id]).toBe('string'));
  });
});

describe('clampCrownLand', () => {
  it('clamps to [0, 100]', () => {
    expect(clampCrownLand(150)).toBe(CROWN_LAND_MAX);
    expect(clampCrownLand(-10)).toBe(CROWN_LAND_MIN);
    expect(clampCrownLand(42)).toBe(42);
  });
});
