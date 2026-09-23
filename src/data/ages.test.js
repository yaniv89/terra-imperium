import { describe, it, expect } from 'vitest';
import {
  AGE_ORDER,
  AGES,
  START_YEAR,
  END_YEAR,
  getAgeIndex,
  getCalendarAgeId,
  getEffectiveAgeIndex,
  getEffectiveAgeId,
  getAgesBehind,
  getAgesBehindCombatMultiplier,
  getAgesBehindResearchCostMultiplier,
  GAME_SPEEDS,
  getYearsPerTurn
} from './ages';

describe('AGES calendar coverage', () => {
  it('covers the full timeline with no gaps or overlaps', () => {
    for (let i = 0; i < AGE_ORDER.length - 1; i++) {
      const current = AGES[AGE_ORDER[i]];
      const next = AGES[AGE_ORDER[i + 1]];
      expect(current.endYear).toBe(next.startYear);
    }
    expect(AGES[AGE_ORDER[0]].startYear).toBe(START_YEAR);
    expect(AGES[AGE_ORDER[AGE_ORDER.length - 1]].endYear).toBe(END_YEAR);
  });
});

describe('getCalendarAgeId', () => {
  it('returns bronze at the very start of the timeline', () => {
    expect(getCalendarAgeId(START_YEAR)).toBe('bronze');
  });

  it('returns modern at the very end of the timeline', () => {
    expect(getCalendarAgeId(END_YEAR)).toBe('modern');
  });

  it('places boundary years in the newer age (start-inclusive ranges)', () => {
    expect(getCalendarAgeId(-800)).toBe('classical');
    expect(getCalendarAgeId(500)).toBe('kingdoms');
    expect(getCalendarAgeId(1500)).toBe('gunpowder');
    expect(getCalendarAgeId(1900)).toBe('modern');
  });

  it('clamps years outside the timeline instead of throwing', () => {
    expect(getCalendarAgeId(-99999)).toBe('bronze');
    expect(getCalendarAgeId(99999)).toBe('modern');
  });
});

describe('getEffectiveAgeIndex / getEffectiveAgeId', () => {
  it('floors a nation at the calendar age even with no tech progress', () => {
    expect(getEffectiveAgeId('kingdoms', 'bronze')).toBe('kingdoms');
  });

  it('lets a nation rush exactly one age ahead of the calendar', () => {
    expect(getEffectiveAgeId('bronze', 'classical')).toBe('classical');
  });

  it('never grants more than one age of unearned rush, even if techAge claims more', () => {
    expect(getEffectiveAgeId('bronze', 'modern')).toBe('classical');
  });

  it('matches calendar exactly when tech age equals it', () => {
    expect(getEffectiveAgeIndex('gunpowder', 'gunpowder')).toBe(getAgeIndex('gunpowder'));
  });
});

describe('getAgesBehind', () => {
  it('is zero when tech age is at or ahead of calendar', () => {
    expect(getAgesBehind('kingdoms', 'kingdoms')).toBe(0);
    expect(getAgesBehind('kingdoms', 'gunpowder')).toBe(0);
  });

  it('counts how many ages a nation has fallen behind the calendar', () => {
    expect(getAgesBehind('modern', 'classical')).toBe(3);
  });
});

describe('getAgesBehindCombatMultiplier', () => {
  it('is 1 (no penalty) when not behind', () => {
    expect(getAgesBehindCombatMultiplier(0)).toBe(1);
  });

  it('drops 15% per age behind', () => {
    expect(getAgesBehindCombatMultiplier(1)).toBeCloseTo(0.85);
    expect(getAgesBehindCombatMultiplier(2)).toBeCloseTo(0.7);
  });

  it('floors at 40% so falling far behind never zeroes out combat entirely', () => {
    expect(getAgesBehindCombatMultiplier(4)).toBe(0.4);
    expect(getAgesBehindCombatMultiplier(10)).toBe(0.4);
  });
});

describe('getAgesBehindResearchCostMultiplier', () => {
  it('is 1 (no penalty) when not behind', () => {
    expect(getAgesBehindResearchCostMultiplier(0)).toBe(1);
  });

  it('rises 30% per age behind, uncapped', () => {
    expect(getAgesBehindResearchCostMultiplier(1)).toBeCloseTo(1.3);
    expect(getAgesBehindResearchCostMultiplier(4)).toBeCloseTo(2.2);
  });
});

describe('game speed', () => {
  it('Fast is exactly double Marathon at every age', () => {
    AGE_ORDER.forEach(ageId => {
      expect(getYearsPerTurn(ageId, 'fast')).toBe(getYearsPerTurn(ageId, 'marathon') * 4);
    });
  });

  it('Normal years-per-turn shrinks monotonically as ages advance', () => {
    const normalValues = AGE_ORDER.map(ageId => getYearsPerTurn(ageId, 'normal'));
    for (let i = 0; i < normalValues.length - 1; i++) {
      expect(normalValues[i]).toBeGreaterThan(normalValues[i + 1]);
    }
  });

  it('falls back to Normal speed for an unknown speed id', () => {
    expect(getYearsPerTurn('bronze', 'unknown')).toBe(getYearsPerTurn('bronze', 'normal'));
  });

  it('every speed id in GAME_SPEEDS actually resolves', () => {
    Object.keys(GAME_SPEEDS).forEach(speedId => {
      expect(getYearsPerTurn('modern', speedId)).toBeGreaterThan(0);
    });
  });
});
