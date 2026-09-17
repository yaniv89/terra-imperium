import { describe, it, expect } from 'vitest';
import { GOVERNMENT_TYPES, getGovernment, getAvailableGovernments, canAdoptGovernment } from './government';
import { AGE_ORDER } from './ages';

describe('GOVERNMENT_TYPES data integrity', () => {
  it('every government belongs to a real age', () => {
    Object.values(GOVERNMENT_TYPES).forEach((gov) => {
      expect(AGE_ORDER, gov.id).toContain(gov.ageId);
    });
  });

  it('slot counts never decrease age over age', () => {
    const maxSlotsByAgeIndex = AGE_ORDER.map((ageId) =>
      Math.max(...getAvailableGovernments(ageId).map((g) => g.slots), 0)
    );
    for (let i = 1; i < maxSlotsByAgeIndex.length; i++) {
      expect(maxSlotsByAgeIndex[i]).toBeGreaterThanOrEqual(maxSlotsByAgeIndex[i - 1]);
    }
  });

  it('bronze offers only Tribal Council (no choice yet)', () => {
    expect(getAvailableGovernments('bronze').map((g) => g.id)).toEqual(['tribal']);
  });

  it('later ages offer more than one government choice', () => {
    ['classical', 'kingdoms', 'gunpowder', 'modern'].forEach((ageId) => {
      expect(getAvailableGovernments(ageId).length).toBeGreaterThan(1);
    });
  });
});

describe('getGovernment', () => {
  it('returns the government by id', () => {
    expect(getGovernment('monarchy')?.name).toBe('Monarchy');
  });

  it('returns null for an unknown id', () => {
    expect(getGovernment('not_real')).toBeNull();
  });
});

describe('canAdoptGovernment', () => {
  it('allows a government at the current calendar age', () => {
    expect(canAdoptGovernment('tribal', 'bronze')).toBe(true);
  });

  it('allows rushing one age ahead of the calendar', () => {
    expect(canAdoptGovernment('monarchy', 'bronze')).toBe(true);
  });

  it('rejects a government two or more ages ahead', () => {
    expect(canAdoptGovernment('feudal', 'bronze')).toBe(false);
  });

  it('rejects an unknown government id', () => {
    expect(canAdoptGovernment('not_real', 'bronze')).toBe(false);
  });
});
