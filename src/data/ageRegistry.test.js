// src/data/ageRegistry.test.js
// The age registry's completeness check (plans/eras-origins-and-future.md, Phase 0): every table
// in the game that is keyed by age must cover every age in AGE_ORDER, and no table may name an
// age that does not exist. Adding an age to src/data/ages.js makes this test list exactly what is
// still missing, by table name and age.
import { describe, it, expect } from 'vitest';
import {
  AGE_ORDER, AGES, FIRST_AGE_ID, LAST_AGE_ID, START_YEAR, END_YEAR, REFERENCE_YEARS, GAME_SPEEDS,
  isAgeAtLeast, isAgeBefore, agesFrom, nextAgeId, formatYear, getCalendarAgeId
} from './ages';
import { RESEARCH_AGE_BASE } from '../engine/research';
import { NAVAL_MOVES_BY_AGE } from '../engine/fleets';
import { BORDER_RING_BY_AGE } from '../engine/world/cities';
import { COLONY_SLOTS_BY_AGE } from '../engine/colonies';
import { OUTPOST_SLOTS_BY_AGE } from '../engine/settlers';
import { AI_MAX_STANDING_UNITS_BY_AGE } from '../utils/aiLogic';
import { RECRUIT_STRATEGIC_RESOURCE_BY_AGE } from './actionCosts';
import { NAVAL_REACH_KM } from './navalReach';
import { UNIT_ROSTER } from './unitClasses';
import { UNIT_ICON_PATHS } from './unitIcons';
import { NAVAL_LINES } from './navalLines';
import { PLAYSTYLES } from './eraGoals';
import { TECH_TREE, getTechsForAge } from './techTree';
import { GREAT_PROJECTS } from './greatProjects';
import { GOVERNMENT_TYPES, GOVERNMENT_REFORMS } from './government';
import { BUILDING_CATEGORIES, EXTRACTION_BUILDINGS } from './buildings';
import { BUILDING_ICON_PATHS } from './buildingIcons';
import { RESOURCES } from './resources';
import { SCENARIOS } from './scenarios';
import { AGE_STYLE } from '../components/map/closeView/townModels';
import { HELMETS, MODELS } from '../battle/render/soldierFactory';
import { AGE_OVERRIDES, NAVAL_LINE_STATS } from '../battle/data/battleStats';

// Tables that must have an entry for EVERY age.
const COMPLETE_TABLES = {
  REFERENCE_YEARS,
  'GAME_SPEEDS.fast.years': GAME_SPEEDS.fast.years,
  'GAME_SPEEDS.normal.years': GAME_SPEEDS.normal.years,
  'GAME_SPEEDS.marathon.years': GAME_SPEEDS.marathon.years,
  RESEARCH_AGE_BASE,
  NAVAL_MOVES_BY_AGE,
  BORDER_RING_BY_AGE,
  COLONY_SLOTS_BY_AGE,
  OUTPOST_SLOTS_BY_AGE,
  AI_MAX_STANDING_UNITS_BY_AGE,
  RECRUIT_STRATEGIC_RESOURCE_BY_AGE,
  NAVAL_REACH_KM,
  UNIT_ROSTER,
  UNIT_ICON_PATHS,
  AGE_STYLE,
  HELMETS,
  ...Object.fromEntries(Object.entries(NAVAL_LINES).flatMap(([id, line]) => [[`NAVAL_LINES.${id}.names`, line.names], [`NAVAL_LINES.${id}.cargo`, line.cargo]])),
  ...Object.fromEntries(Object.entries(PLAYSTYLES).map(([id, p]) => [`PLAYSTYLES.${id}.targets`, p.targets]))
};

// Tables that may skip ages (they fall back or start later) but must only name real ones.
const PARTIAL_TABLES = {
  AGE_OVERRIDES,
  ...Object.fromEntries(Object.entries(MODELS).filter(([cls]) => cls !== 'naval').map(([cls, byAge]) => [`MODELS.${cls}`, byAge])),
  GOVERNMENT_REFORMS: Object.assign({}, ...Object.values(GOVERNMENT_REFORMS)),
  ...Object.fromEntries(Object.entries(BUILDING_ICON_PATHS).map(([id, byAge]) => [`BUILDING_ICON_PATHS.${id}`, byAge])),
  ...Object.fromEntries(Object.entries(NAVAL_LINE_STATS).map(([id, byAge]) => [`NAVAL_LINE_STATS.${id}`, byAge]))
};

// Single age ids named in data (a unit line's start, a wonder's age, a building tier's age...).
const NAMED_AGES = [
  ...Object.values(NAVAL_LINES).map((l) => [`NAVAL_LINES.${l.id}.from`, l.from]),
  ...Object.values(GREAT_PROJECTS).map((p) => [`GREAT_PROJECTS.${p.id}.ageId`, p.ageId]),
  ...Object.values(GOVERNMENT_TYPES).map((g) => [`GOVERNMENT_TYPES.${g.id}.minAgeId`, g.minAgeId]),
  ...Object.entries(BUILDING_CATEGORIES).flatMap(([id, c]) => c.tiers.map((t, i) => [`BUILDING_CATEGORIES.${id}.tiers[${i}].age`, t.age])),
  ...Object.entries(EXTRACTION_BUILDINGS).map(([id, b]) => [`EXTRACTION_BUILDINGS.${id}.age`, b.age]),
  ...Object.entries(RESOURCES).filter(([, r]) => r.unlockAge).map(([id, r]) => [`RESOURCES.${id}.unlockAge`, r.unlockAge]),
  ...Object.values(SCENARIOS).map((s) => [`SCENARIOS.${s.id}.age`, s.age]),
  ...Object.values(TECH_TREE).map((t) => [`TECH_TREE.${t.id}.ageId`, t.ageId])
];

describe('age registry', () => {
  it('lists every age once, in order, with contiguous years from START_YEAR to END_YEAR', () => {
    expect(new Set(AGE_ORDER).size).toBe(AGE_ORDER.length);
    expect(Object.keys(AGES).sort()).toEqual([...AGE_ORDER].sort());
    expect(AGES[FIRST_AGE_ID].startYear).toBe(START_YEAR);
    expect(AGES[LAST_AGE_ID].endYear).toBe(END_YEAR);
    AGE_ORDER.forEach((id, i) => {
      const age = AGES[id];
      expect(age.id).toBe(id);
      expect(age.endYear).toBeGreaterThan(age.startYear);
      if (i > 0) expect(age.startYear).toBe(AGES[AGE_ORDER[i - 1]].endYear);
      expect(getCalendarAgeId(age.startYear)).toBe(id);
      ['unitAttack', 'unitDefense', 'unitCostMult'].forEach((k) => expect(Number.isFinite(age[k]), `${id}.${k}`).toBe(true));
      if (i > 0) expect(age.unitAttack, `${id}.unitAttack grows`).toBeGreaterThan(AGES[AGE_ORDER[i - 1]].unitAttack);
    });
  });

  it('compares ages by rank', () => {
    expect(isAgeAtLeast(LAST_AGE_ID, FIRST_AGE_ID)).toBe(true);
    expect(isAgeAtLeast(FIRST_AGE_ID, FIRST_AGE_ID)).toBe(true);
    expect(isAgeBefore(FIRST_AGE_ID, FIRST_AGE_ID)).toBe(false);
    expect(isAgeAtLeast('nonsense', FIRST_AGE_ID)).toBe(false);
    expect(isAgeBefore('nonsense', LAST_AGE_ID)).toBe(false);
    expect(agesFrom(FIRST_AGE_ID)).toEqual(AGE_ORDER);
    expect(nextAgeId(LAST_AGE_ID)).toBe(null);
    expect(formatYear(-2000)).toBe('2000 BCE');
    expect(formatYear(1500)).toBe('1500 CE');
  });

  it('every per-age table covers every age', () => {
    const missing = [];
    Object.entries(COMPLETE_TABLES).forEach(([name, table]) => AGE_ORDER.forEach((age) => { if (table?.[age] === undefined) missing.push(`${name}.${age}`); }));
    expect(missing).toEqual([]);
  });

  it('no table names an age that does not exist', () => {
    const unknown = [];
    Object.entries({ ...COMPLETE_TABLES, ...PARTIAL_TABLES }).forEach(([name, table]) => Object.keys(table || {}).forEach((k) => { if (!AGES[k]) unknown.push(`${name}.${k}`); }));
    NAMED_AGES.forEach(([where, age]) => { if (!AGES[age]) unknown.push(`${where} = ${age}`); });
    expect(unknown).toEqual([]);
  });

  it('every age has ten techs, two per line', () => {
    AGE_ORDER.forEach((age) => {
      const techs = getTechsForAge(age);
      expect(techs.length, age).toBe(10);
      const perLine = techs.reduce((acc, t) => ({ ...acc, [t.category]: (acc[t.category] || 0) + 1 }), {});
      Object.values(perLine).forEach((n) => expect(n, age).toBe(2));
    });
  });

  it('every unit the roster offers in an age has a soldier model and an icon', () => {
    const missing = [];
    AGE_ORDER.forEach((age) => Object.keys(UNIT_ROSTER[age] || {}).forEach((cls) => {
      if (cls !== 'naval' && !MODELS[cls]?.[age]) missing.push(`MODELS.${cls}.${age}`);
      if (!UNIT_ICON_PATHS[age]?.[cls]) missing.push(`UNIT_ICON_PATHS.${age}.${cls}`);
    }));
    expect(missing).toEqual([]);
  });

  it('every age has wonders and a recruitable infantry unit', () => {
    AGE_ORDER.forEach((age) => {
      expect(Object.values(GREAT_PROJECTS).some((p) => p.ageId === age), `${age} wonders`).toBe(true);
      expect(UNIT_ROSTER[age]?.infantry, `${age} infantry`).toBeTruthy();
    });
  });
});
