import { describe, it, expect } from 'vitest';
import {
  AGE_ORDER,
  AGES,
  START_YEAR,
  END_YEAR,
  getAgeIndex,
  getCalendarAgeId,
  getAgesBehind,
  getAgesBehindResearchCostMultiplier,
  GAME_SPEEDS,
  getYearsPerTurn,
  speedCostMult,
  gameLengthTurns,
  FIRST_AGE_ID,
  LAST_AGE_ID,
  isAgeAtLeast,
  isAgeBefore,
  agesFrom,
  nextAgeId,
  formatYear,
  artAgeFor
} from './ages';
import { TECH_TREE, getTechsForAge } from './techTree';

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


describe('getAgesBehind', () => {
  it('is zero when tech age is at or ahead of calendar', () => {
    expect(getAgesBehind('kingdoms', 'kingdoms')).toBe(0);
    expect(getAgesBehind('kingdoms', 'gunpowder')).toBe(0);
  });

  it('counts how many ages a nation has fallen behind the calendar', () => {
    expect(getAgesBehind('modern', 'classical')).toBe(3);
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

describe('game speed (the speed table, plans/playtest-1.md P3)', () => {
  it('Marathon moves the calendar slowest at every age and a full game is about 1,500 turns', () => {
    AGE_ORDER.forEach(ageId => {
      expect(getYearsPerTurn(ageId, 'fast')).toBeGreaterThanOrEqual(getYearsPerTurn(ageId, 'normal'));
      expect(getYearsPerTurn(ageId, 'normal')).toBeGreaterThanOrEqual(getYearsPerTurn(ageId, 'marathon'));
    });
    expect(getYearsPerTurn('bronze', 'marathon')).toBe(10);
    expect(getYearsPerTurn('bronze', 'normal')).toBe(25);
    expect(gameLengthTurns('fast')).toBeGreaterThan(400); expect(gameLengthTurns('fast')).toBeLessThan(500);
    expect(gameLengthTurns('normal')).toBeGreaterThan(850); expect(gameLengthTurns('normal')).toBeLessThan(1000);
    expect(gameLengthTurns('marathon')).toBeGreaterThan(1400); expect(gameLengthTurns('marathon')).toBeLessThan(1600);
    // The cost multiplier follows the turns: more turns per year, dearer techs and buildings, so
    // the pace per year of history holds at every speed and age.
    AGE_ORDER.forEach((ageId) => {
      expect(speedCostMult('fast', ageId)).toBeLessThanOrEqual(speedCostMult('normal', ageId));
      expect(speedCostMult('normal', ageId)).toBeLessThanOrEqual(speedCostMult('marathon', ageId));
      ['fast', 'normal', 'marathon'].forEach((sp) => expect(speedCostMult(sp, ageId) * getYearsPerTurn(ageId, sp)).toBeCloseTo(speedCostMult('fast', ageId) * getYearsPerTurn(ageId, 'fast'), 6));
    });
    expect(speedCostMult('unknown', 'bronze')).toBe(speedCostMult('normal', 'bronze'));
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

// The age registry (plans/2026-10-20-001-feat-eight-ages-plan.md U1, KTD12): code compares ages
// through these helpers and never names the first or last age by hand.
describe('age registry helpers', () => {
  it('names the first and the last age', () => {
    expect(FIRST_AGE_ID).toBe(AGE_ORDER[0]);
    expect(LAST_AGE_ID).toBe(AGE_ORDER[AGE_ORDER.length - 1]);
  });

  it('compares ages by rank, and an unknown age is never at least or before anything', () => {
    expect(isAgeAtLeast('modern', 'gunpowder')).toBe(true);
    expect(isAgeAtLeast('gunpowder', 'gunpowder')).toBe(true);
    expect(isAgeAtLeast('classical', 'gunpowder')).toBe(false);
    expect(isAgeAtLeast(LAST_AGE_ID, FIRST_AGE_ID)).toBe(true);
    expect(isAgeAtLeast('nonsense', FIRST_AGE_ID)).toBe(false);
    expect(isAgeAtLeast(undefined, FIRST_AGE_ID)).toBe(false);
    expect(isAgeBefore('classical', 'gunpowder')).toBe(true);
    expect(isAgeBefore('gunpowder', 'gunpowder')).toBe(false);
    expect(isAgeBefore(FIRST_AGE_ID, FIRST_AGE_ID)).toBe(false);
    expect(isAgeBefore('nonsense', LAST_AGE_ID)).toBe(false);
  });

  it('lists the ages from one onward and steps to the next', () => {
    expect(agesFrom('kingdoms')).toEqual(AGE_ORDER.slice(getAgeIndex('kingdoms')));
    expect(agesFrom(FIRST_AGE_ID)).toEqual(AGE_ORDER);
    expect(nextAgeId('bronze')).toBe('classical');
    expect(nextAgeId(LAST_AGE_ID)).toBe(null);
  });

  it('formats a year once for everyone', () => {
    expect(formatYear(-2000)).toBe('2000 BCE');
    expect(formatYear(1500)).toBe('1500 CE');
  });

  it("holds each age's unit power and cost, equal to the old position formulas", () => {
    AGE_ORDER.forEach((id, i) => {
      expect(AGES[id].power, id).toEqual({ attack: 10 + i * 8, defense: 8 + i * 6 });
      expect(AGES[id].unitCostMult, id).toBe(1 + 0.6 * i);
    });
  });
});

describe('artAgeFor (KTD14 art fallback)', () => {
  const has = (...ages) => new Set(ages);
  it('buildings: the exact age, else the nearest earlier, else the nearest later, else none', () => {
    expect(artAgeFor(has('bronze', 'kingdoms'), 'kingdoms')).toBe('kingdoms');
    expect(artAgeFor(has('bronze', 'kingdoms'), 'gunpowder')).toBe('kingdoms');
    expect(artAgeFor(has('kingdoms', 'modern'), 'classical')).toBe('kingdoms');
    expect(artAgeFor(has(), 'classical')).toBe(null);
    expect(artAgeFor(has('bronze'), 'nonsense')).toBe(null);
    expect(artAgeFor((a) => a === 'bronze', 'modern')).toBe('bronze'); // a predicate works too
  });
  it('units: the exact age, else the nearest earlier only when its file is the same kind', () => {
    expect(artAgeFor({ gunpowder: 'mounted', modern: 'machine' }, 'modern', { kind: 'machine' })).toBe('modern');
    expect(artAgeFor({ gunpowder: 'mounted' }, 'modern', { kind: 'machine' })).toBe(null); // a tank never rides a horse
    expect(artAgeFor({ kingdoms: 'foot' }, 'gunpowder', { kind: 'foot' })).toBe('kingdoms');
    expect(artAgeFor({ classical: 'foot', kingdoms: 'mounted' }, 'gunpowder', { kind: 'foot' })).toBe(null); // only the nearest
    expect(artAgeFor({ modern: 'foot' }, 'gunpowder', { kind: 'foot' })).toBe(null); // never a later age
  });
});

describe('tech tree listed by age', () => {
  it('keeps every tech id, in order', () => {
    expect(Object.keys(TECH_TREE)).toEqual([
      'military_bronze_casting', 'military_composite_bow', 'military_iron_weapons', 'military_siege_engineering', 'military_feudal_levies', 'military_plate_armor', 'military_gunpowder_weapons', 'military_standing_armies', 'military_mechanized_warfare', 'military_precision_guidance',
      'economy_bronze_trade_routes', 'economy_granary_storage', 'economy_minted_coinage', 'economy_silk_road_trade', 'economy_guild_charters', 'economy_banking_houses', 'economy_joint_stock_companies', 'economy_colonial_trade', 'economy_industrial_capital', 'economy_global_markets',
      'infrastructure_irrigation_canals', 'infrastructure_mudbrick_roads', 'infrastructure_paved_roads', 'infrastructure_aqueducts', 'infrastructure_stone_bridges', 'infrastructure_postal_relay', 'infrastructure_canal_locks', 'infrastructure_turnpike_roads', 'infrastructure_rail_networks', 'infrastructure_highway_systems',
      'governance_code_of_laws', 'governance_scribal_bureaucracy', 'governance_civic_assemblies', 'governance_provincial_administration', 'governance_feudal_charters', 'governance_royal_chancery', 'governance_bureaucratic_reform', 'governance_constitutional_law', 'governance_civil_service', 'governance_digital_administration',
      'science_cuneiform_records', 'science_early_astronomy', 'science_geometry', 'science_natural_philosophy', 'science_scholastic_method', 'science_optics', 'science_scientific_method', 'science_calculus', 'science_computing', 'science_genomics'
    ]);
  });
  it('ten techs an age, two per line, the second staggered to mid-age after the first', () => {
    AGE_ORDER.forEach((age) => {
      const techs = getTechsForAge(age);
      expect(techs.length, age).toBe(10);
      const perLine = techs.reduce((acc, t) => ({ ...acc, [t.category]: [...(acc[t.category] || []), t] }), {});
      Object.values(perLine).forEach(([first, second]) => {
        expect(first.yearAvailable).toBe(AGES[age].startYear);
        expect(second.yearAvailable).toBe(Math.round((AGES[age].startYear + AGES[age].endYear) / 2));
        expect(second.prerequisites[0]).toBe(first.id);
      });
    });
  });
});
