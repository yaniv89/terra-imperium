// Registry completeness (plans/2026-10-20-001-feat-eight-ages-plan.md U2, R25): every per-age table
// has a row for each age in AGE_ORDER and names no age outside it. A table may skip an age only
// through a listed reason in OPT_OUT or PARTIAL, so adding an age to AGE_ORDER fails here by table
// name until every table has its row.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AGE_ORDER, AGES, GAME_SPEEDS } from './ages';
import { TECH_TREE, getTechsForAge } from './techTree';
import { UNIT_ROSTER } from './unitClasses';
import { BUILDING_CATEGORIES } from './buildings';
import { BUILDING_ICON_PATHS } from './buildingIcons';
import { GOVERNMENT_TYPES, GOVERNMENT_REFORMS } from './government';
import { GREAT_PROJECTS } from './greatProjects';
import { RESOURCES } from './resources';
import { RESOURCE_KNOWN_FROM_AGE } from './tileYields';
import { RECRUIT_STRATEGIC_RESOURCE_BY_AGE } from './actionCosts';
import { PLAYSTYLES } from './eraGoals';
import { AGE_BAND, RAID_ERA_FACTOR } from './independents';
import { NAVAL_LINES } from './navalLines';
import { NAVAL_REACH_KM } from './navalReach';
import { RESEARCH_AGE_BASE } from '../engine/research';
import { COLONY_SLOTS_BY_AGE } from '../engine/colonies';
import { OUTPOST_SLOTS_BY_AGE } from '../engine/settlers';
import { NAVAL_KM_BY_AGE, DEEP_OK_FROM, SHELF_OK_FROM } from '../engine/fleets';
import { CONTACT_KM } from '../engine/techDiffusion';
import { STRIKE_MAX } from '../engine/warPlans';
import { BORDER_KM_BY_AGE } from '../engine/world/cities';
import { AI_MAX_STANDING_UNITS_BY_AGE } from '../utils/aiLogic';
import { AGE_OVERRIDES, NAVAL_LINE_STATS } from '../battle/data/battleStats';
import { BRIDGE_BY_AGE } from '../battle/art/artIndex';
import { PROJECTILE_TABLE } from '../battle/art/projectiles';
import { MATERIAL_BY_AGE } from '../battle/setup/cityBattle';
import { HELMETS, BODY_CLOTH, LEG_CLOTH, MODELS } from '../battle/render/soldierFactory';
import { AGE_STYLE } from '../components/map/closeView/townModels';
import enCore from '../i18n/locales/en';
import heCore from '../i18n/locales/he';
import enPnl2 from '../i18n/locales/ui/pnl2.en';
import hePnl2 from '../i18n/locales/ui/pnl2.he';

const ROSTER_CLASSES = ['infantry', 'cavalry', 'ranged', 'siege', 'naval'];

/** Problems with one table: an age it lacks (and has no opt-out reason for) or a key that is no age. */
export const tableProblems = (name, keys, optOut = {}) => {
  const have = new Set(keys);
  const missing = AGE_ORDER.filter((a) => !have.has(a) && !optOut[a]).map((a) => `${name} is missing ${a}`);
  const unknown = [...have].filter((k) => !AGE_ORDER.includes(k)).map((k) => `${name} names unknown age ${k}`);
  return [...missing, ...unknown];
};

/** Problems with a table that lists ages without having to cover all of them. */
const knownOnly = (name, keys) => [...new Set(keys)].filter((k) => !AGE_ORDER.includes(k)).map((k) => `${name} names unknown age ${k}`);

// Tables keyed directly by age id; each must have every age unless OPT_OUT gives a reason.
const KEYED = [
  ['AGES', AGES], ['UNIT_ROSTER', UNIT_ROSTER],
  ['RESEARCH_AGE_BASE', RESEARCH_AGE_BASE],
  ['COLONY_SLOTS_BY_AGE', COLONY_SLOTS_BY_AGE], ['OUTPOST_SLOTS_BY_AGE', OUTPOST_SLOTS_BY_AGE],
  ['NAVAL_KM_BY_AGE', NAVAL_KM_BY_AGE], ['NAVAL_REACH_KM', NAVAL_REACH_KM], ['CONTACT_KM', CONTACT_KM],
  ['STRIKE_MAX', STRIKE_MAX], ['BORDER_KM_BY_AGE', BORDER_KM_BY_AGE],
  ['AI_MAX_STANDING_UNITS_BY_AGE', AI_MAX_STANDING_UNITS_BY_AGE],
  ['RECRUIT_STRATEGIC_RESOURCE_BY_AGE', RECRUIT_STRATEGIC_RESOURCE_BY_AGE],
  ['AGE_BAND', AGE_BAND], ['RAID_ERA_FACTOR', RAID_ERA_FACTOR],
  ['BRIDGE_BY_AGE', BRIDGE_BY_AGE], ['MATERIAL_BY_AGE', MATERIAL_BY_AGE],
  ['HELMETS', HELMETS], ['BODY_CLOTH', BODY_CLOTH], ['LEG_CLOTH', LEG_CLOTH],
  ...ROSTER_CLASSES.map((c) => [`MODELS.${c}`, MODELS[c]]),
  ['AGE_STYLE', AGE_STYLE],
  ...Object.values(GAME_SPEEDS).map((s) => [`GAME_SPEEDS.${s.id}.costMult`, s.costMult]),
  ...Object.entries(PLAYSTYLES).map(([id, p]) => [`PLAYSTYLES.${id}.targets`, p.targets]),
  ...Object.entries(NAVAL_LINES).flatMap(([id, l]) => [[`NAVAL_LINES.${id}.names`, l.names], [`NAVAL_LINES.${id}.cargo`, l.cargo]]),
  ...['warship', 'transport', 'raider'].map((id) => [`NAVAL_LINE_STATS.${id}`, NAVAL_LINE_STATS[id]])
];

// Opt-outs: table name -> { age: reason }.
const OPT_OUT = {
};

// Tables that cover only some ages by design: unknown keys are still rejected. [keys, reason].
const PARTIAL = {
  AGE_OVERRIDES: [Object.keys(AGE_OVERRIDES), 'only the ages that change a class (Gunpowder and Modern turn melee lines into shooters)'],
  'GOVERNMENT_TYPES.minAgeId': [Object.values(GOVERNMENT_TYPES).map((g) => g.minAgeId), 'a government is open from its minimum age, so most ages start none'],
  'BUILDING_ICON_PATHS (every category)': [Object.values(BUILDING_ICON_PATHS).flatMap((t) => Object.keys(t)), 'a category has an icon only for the ages it has a tier in (checked below)'],
  'NAVAL_LINE_STATS.carrier': [Object.keys(NAVAL_LINE_STATS.carrier), 'the carrier line starts in Modern'],
  'PROJECTILE_TABLE (every class)': [Object.values(PROJECTILE_TABLE).flatMap((t) => Object.keys(t)), 'a class with no missile in an age has no row'],
  'MODELS (support, worker, air)': [['support', 'worker', 'air'].flatMap((c) => Object.keys(MODELS[c])), 'these classes have models only from the age that fields them; the loader falls back'],
  DEEP_OK_FROM: [DEEP_OK_FROM, 'a threshold list: ages before the threshold are left out on purpose'],
  SHELF_OK_FROM: [SHELF_OK_FROM, 'a threshold list: ages before the threshold are left out on purpose'],
  RESOURCE_KNOWN_FROM_AGE: [Object.values(RESOURCE_KNOWN_FROM_AGE), 'values are the age a resource is known from; most resources have none'],
  'RESOURCES.unlockAge': [Object.values(RESOURCES).map((r) => r.unlockAge).filter((a) => a !== null), 'null means always available']
};

describe('registry completeness: every per-age table has every age', () => {
  it.each(KEYED)('%s', (name, table) => {
    expect(tableProblems(name, Object.keys(table), OPT_OUT[name])).toEqual([]);
  });

  it.each(Object.entries(PARTIAL))('%s names only known ages', (name, [keys]) => {
    expect(knownOnly(name, keys)).toEqual([]);
  });

  it('every roster age has all five classes with a unit name, power and cost', () => {
    AGE_ORDER.forEach((age) => {
      ROSTER_CLASSES.forEach((cls) => {
        expect(UNIT_ROSTER[age][cls]?.name, `UNIT_ROSTER ${age} ${cls}`).toBeTruthy();
        expect(typeof MODELS[cls][age], `procedural model ${cls} ${age}`).toBe('function');
      });
      expect(AGES[age].power.attack, `${age} power`).toBeGreaterThan(0);
      expect(AGES[age].unitCostMult, `${age} unitCostMult`).toBeGreaterThan(0);
      expect(RECRUIT_STRATEGIC_RESOURCE_BY_AGE, `recruit resource ${age}`).toHaveProperty(age); // null = no metal
    });
  });

  it('the tables that must be non-empty per age are', () => {
    AGE_ORDER.forEach((age) => {
      expect(RESEARCH_AGE_BASE[age], `RESEARCH_AGE_BASE ${age}`).toBeGreaterThan(0);
      expect(NAVAL_KM_BY_AGE[age], `NAVAL_KM_BY_AGE ${age}`).toBeGreaterThan(0);
    });
  });

  it('the Stone Age per-age macro tables hold the plan values (Appendix B, U35)', () => {
    expect(RESEARCH_AGE_BASE.stone).toBe(12);
    expect(COLONY_SLOTS_BY_AGE.stone).toBe(0);
    expect(OUTPOST_SLOTS_BY_AGE.stone).toBe(1);
    expect(NAVAL_KM_BY_AGE.stone).toBe(300);
    expect(CONTACT_KM.stone).toBe(900);
    expect(STRIKE_MAX.stone).toBe(6);
    expect(BORDER_KM_BY_AGE.stone).toBe(204);
    expect(AI_MAX_STANDING_UNITS_BY_AGE.stone).toBe(4);
    expect(RECRUIT_STRATEGIC_RESOURCE_BY_AGE.stone).toBeNull();
  });

  it('the building tiers, reform tiers and wonders each cover every age', () => {
    const tierAges = new Set(Object.values(BUILDING_CATEGORIES).flatMap((c) => c.tiers.map((t) => t.age)));
    const reformAges = new Set(Object.values(GOVERNMENT_REFORMS).flatMap((t) => Object.keys(t)));
    const wonderAges = new Set(Object.values(GREAT_PROJECTS).map((p) => p.ageId));
    expect(tableProblems('building tiers', tierAges, OPT_OUT['building tiers'])).toEqual([]);
    expect(tableProblems('government reform tiers', reformAges)).toEqual([]);
    expect(tableProblems('wonders', wonderAges)).toEqual([]);
  });

  it('every building tier has an icon for its age', () => {
    const problems = [];
    Object.entries(BUILDING_CATEGORIES).forEach(([id, c]) => c.tiers.forEach((t) => {
      if (!BUILDING_ICON_PATHS[id]?.[t.age]) problems.push(`BUILDING_ICON_PATHS.${id} is missing ${t.age}`);
    }));
    expect(problems).toEqual([]);
  });

  it('every age that unlocks resources names real ones', () => {
    Object.values(AGES).forEach((a) => a.unlocksResources.forEach((r) => expect(RESOURCES[r], `${a.id} unlocks ${r}`).toBeTruthy()));
  });

  it('every tech belongs to a known age and each age has 10 techs', () => {
    Object.values(TECH_TREE).forEach((t) => expect(AGE_ORDER, `tech ${t.id}`).toContain(t.ageId));
    AGE_ORDER.forEach((age) => expect(getTechsForAge(age), `techs in ${age}`).toHaveLength(10));
  });

  it('every age has its English and Hebrew names in i18n', () => {
    const problems = [];
    [['en', { ...enCore, ...enPnl2 }], ['he', { ...heCore, ...hePnl2 }]].forEach(([lang, dict]) => {
      AGE_ORDER.forEach((age) => {
        ['age.', 'p2.ageShort.'].forEach((prefix) => { if (!dict[`${prefix}${age}`]) problems.push(`${lang} ${prefix}${age} is missing`); });
      });
    });
    expect(problems).toEqual([]);
  });

  it('every age has an icon file', () => {
    const dir = path.resolve(__dirname, '../assets/icons/ages');
    const problems = AGE_ORDER.filter((age) => !fs.existsSync(path.join(dir, `${age}.svg`))).map((age) => `age icon ${age}.svg is missing`);
    expect(problems).toEqual([]);
  });
});

describe('registry completeness: the check itself', () => {
  it('names the table and the age when a key is removed from a local copy', () => {
    const copy = { ...BRIDGE_BY_AGE };
    delete copy[AGE_ORDER[1]];
    expect(tableProblems('BRIDGE_BY_AGE', Object.keys(copy))).toEqual([`BRIDGE_BY_AGE is missing ${AGE_ORDER[1]}`]);
  });

  it('rejects a key that is no age, and accepts an age with a listed reason', () => {
    expect(tableProblems('T', [...AGE_ORDER, 'space'])).toEqual(['T names unknown age space']);
    expect(tableProblems('T', AGE_ORDER.slice(1), { [AGE_ORDER[0]]: 'reason' })).toEqual([]);
  });

  it('every opt-out and partial table has a reason', () => {
    Object.values(OPT_OUT).forEach((byAge) => Object.entries(byAge).forEach(([age, reason]) => {
      expect(AGE_ORDER).toContain(age);
      expect(reason).toBeTruthy();
    }));
    Object.values(PARTIAL).forEach(([, reason]) => expect(reason).toBeTruthy());
  });
});
