import { describe, it, expect } from 'vitest';
import {
  AGE_ORDER,
  AGES,
  START_YEAR,
  END_YEAR,
  getAgeIndex,
  GAME_SPEEDS,
  speedCostMult,
  speedTurnLimit,
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

describe('game speed (KTD9: a cost multiplier per age, a turn limit, no years per turn)', () => {
  it('gives the Stone Age its own multipliers (KTD9)', () => {
    expect(['fast', 'normal', 'marathon'].map((sp) => speedCostMult(sp, 'stone'))).toEqual([0.8, 1.6, 2]);
  });

  it('gives the Information Age its multipliers (KTD9)', () => {
    expect(['fast', 'normal', 'marathon'].map((sp) => speedCostMult(sp, 'information'))).toEqual([1, 2, 2]);
  });

  it('keeps the values the old calendar gave Bronze to Modern exactly', () => {
    const old = { bronze: 40, classical: 20, kingdoms: 10, gunpowder: 4, modern: 2 };
    const years = { fast: { bronze: 50, classical: 25, kingdoms: 12, gunpowder: 5, modern: 2 }, normal: { bronze: 25, classical: 12, kingdoms: 6, gunpowder: 2, modern: 1 }, marathon: { bronze: 10, classical: 5, kingdoms: 3, gunpowder: 1, modern: 1 } };
    Object.keys(years).forEach((sp) => Object.keys(old).forEach((ageId) => expect(speedCostMult(sp, ageId)).toBe(old[ageId] / years[sp][ageId])));
    expect(speedCostMult('normal', 'gunpowder')).toBe(2);
  });

  it('is slower on a slower speed at every age, and Normal is the fallback speed', () => {
    AGE_ORDER.forEach((ageId) => {
      expect(speedCostMult('fast', ageId)).toBeLessThanOrEqual(speedCostMult('normal', ageId));
      expect(speedCostMult('normal', ageId)).toBeLessThanOrEqual(speedCostMult('marathon', ageId));
    });
    expect(speedCostMult('unknown', 'bronze')).toBe(speedCostMult('normal', 'bronze'));
  });

  it('throws for an unknown age under the tests', () => {
    expect(() => speedCostMult('normal', 'atlantis')).toThrow(/unknown age/);
  });

  it('ends a game at the speed turn limit', () => {
    expect(speedTurnLimit('fast')).toBe(440);
    expect(speedTurnLimit('normal')).toBe(923);
    expect(speedTurnLimit('marathon')).toBe(1514);
    Object.values(GAME_SPEEDS).forEach((sp) => expect(sp.years).toBeUndefined());
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
    expect(AGES.stone.power).toEqual({ attack: 7, defense: 6 }); // KTD21
    expect(AGES.information.power).toEqual({ attack: 52, defense: 40 });
    AGE_ORDER.slice(getAgeIndex('bronze'), getAgeIndex('modern') + 1).forEach((id, i) => {
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
      'military_hunting_bands', 'military_copper_working', 'military_bronze_casting', 'military_composite_bow', 'military_iron_weapons', 'military_siege_engineering', 'military_feudal_levies', 'military_plate_armor', 'military_gunpowder_weapons', 'military_standing_armies', 'military_mechanized_warfare', 'military_combined_arms', 'military_precision_guidance', 'military_unmanned_systems',
      'economy_agriculture', 'economy_animal_husbandry', 'economy_bronze_trade_routes', 'economy_granary_storage', 'economy_minted_coinage', 'economy_silk_road_trade', 'economy_guild_charters', 'economy_banking_houses', 'economy_joint_stock_companies', 'economy_colonial_trade', 'economy_industrial_capital', 'economy_mass_production', 'economy_global_markets', 'economy_digital_economy',
      'infrastructure_pottery', 'infrastructure_the_wheel', 'infrastructure_irrigation_canals', 'infrastructure_mudbrick_roads', 'infrastructure_paved_roads', 'infrastructure_aqueducts', 'infrastructure_stone_bridges', 'infrastructure_postal_relay', 'infrastructure_canal_locks', 'infrastructure_turnpike_roads', 'infrastructure_rail_networks', 'infrastructure_highway_systems', 'infrastructure_telecom_networks', 'infrastructure_smart_grids',
      'governance_chiefdoms', 'governance_sacred_kingship', 'governance_code_of_laws', 'governance_scribal_bureaucracy', 'governance_civic_assemblies', 'governance_provincial_administration', 'governance_feudal_charters', 'governance_royal_chancery', 'governance_bureaucratic_reform', 'governance_constitutional_law', 'governance_civil_service', 'governance_mass_politics', 'governance_digital_administration', 'governance_global_institutions',
      'science_star_lore', 'science_proto_writing', 'science_cuneiform_records', 'science_early_astronomy', 'science_geometry', 'science_natural_philosophy', 'science_scholastic_method', 'science_optics', 'science_scientific_method', 'science_calculus', 'science_nuclear_physics', 'science_computing', 'science_genomics', 'science_artificial_intelligence'
    ]);
  });
  it('ten techs an age, two per line, the second after the first', () => {
    AGE_ORDER.forEach((age) => {
      const techs = getTechsForAge(age);
      expect(techs.length, age).toBe(10);
      const perLine = techs.reduce((acc, t) => ({ ...acc, [t.category]: [...(acc[t.category] || []), t] }), {});
      Object.values(perLine).forEach(([first, second]) => {
        expect(second.lineIndex).toBe(first.lineIndex + 1);
        expect(second.prerequisites[0]).toBe(first.id);
      });
    });
  });
});
