// src/i18n/sweep.test.js
// The i18n sweep (lane i18n-sweep, 27 Oct): signed numbers keep their sign in Hebrew, gold reads as
// Hebrew words, a plural key never shows as a bare key, regiment names read natively, and the
// lines and labels converted in the sweep come out in Hebrew.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { translate, setCurrentLanguage, isolateSigned, tableOf, dataTable } from './core';
import { msgText } from '../engine/messages';
import { logText, refName } from './messageText';
import { regimentLabel } from './names';
import { HE_PEOPLES } from './hebrewNames';
import { LIST_SORTS, LIST_FILTERS, kmLabel } from '../components/independents/independentsListModel';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { IMPROVEMENTS } from '../data/tileYields';
import { GREAT_PROJECTS } from '../data/greatProjects';
import { GOVERNMENT_TYPES } from '../data/government';
import { TAX_RATES } from '../data/taxRates';
import { CITY_STATE_TYPES } from '../data/cityStates';
import { DISTRICTS } from '../engine/districts';
import { IDENTITY_AXES } from '../data/identity';
import { RESOURCE_IDS } from '../data/resources';

const LRI = '⁦';
const PDI = '⁩';
const LATIN = /[A-Za-z]/;

afterEach(() => setCurrentLanguage('en'));

describe('signed numbers in Hebrew', () => {
  it('isolates a leading sign so bidi cannot move it ("+50", never "50+")', () => {
    expect(isolateSigned('אספקה 90/100, +50 בתור')).toBe(`אספקה 90/100, ${LRI}+50${PDI} בתור`);
    expect(isolateSigned('הכנסה: +1,500 זהב')).toContain(`${LRI}+1,500${PDI}`);
    expect(isolateSigned('טווח 2-3 אריחים')).toBe('טווח 2-3 אריחים'); // a range is not a sign
  });
  it('UI text from t() is isolated in Hebrew and left alone in English', () => {
    const vars = { supply: 90, max: 100, change: '+50', until: '', hint: '' };
    expect(translate('mx.sup.line', vars, 'he')).toContain(`${LRI}+50${PDI}`);
    expect(translate('mx.sup.line', vars, 'en')).not.toContain(LRI);
  });
});

describe('gold in Hebrew', () => {
  it('the income line has no year and no English "g"', () => {
    const he = msgText('m.turn.income', { year: -4700, gold: 11 }, 'he');
    expect(he).toBe(`הכנסה: ${LRI}+11${PDI} זהב`);
    expect(msgText('m.turn.income', { year: -4700, gold: 11 }, 'en')).toBe('Income: +11g');
  });
  it('big sums group their digits, millions read as a word', () => {
    expect(msgText('m.act.loanTaken', { gold: 1500 }, 'he')).toContain('1,500 זהב');
    expect(msgText('m.act.loanTaken', { gold: 1500 }, 'he')).not.toMatch(/זהב זהב|\dg\b|K/);
    expect(msgText('m.turn.autoLoan', { gold: 2500000 }, 'he')).toContain('2.5 מיליון זהב');
  });
  it('the upkeep line has no Latin letters', () => {
    const line = msgText('m.turn.upkeep', { total: 10, army: 5, marching: '', navy: 0, forts: 0, buildings: 0, advisors: 5, interest: 0 }, 'he');
    expect(line).not.toMatch(LATIN);
  });
});

describe('no bare keys', () => {
  it('a plural key without a usable count reads its general form', () => {
    expect(translate('research.turnsCount', { count: Infinity }, 'he')).not.toContain('research.');
    expect(translate('research.turnsCount', null, 'en')).not.toContain('research.');
  });
});

describe('refusals and lines converted in the sweep', () => {
  it('a rush, scout or wonder refusal in the log is Hebrew', () => {
    const keys = ['m.why.rush.enemy', 'm.why.scout.peace', 'm.why.builtElsewhere', 'm.why.tpl.empty', 'm.why.cantClaim'];
    keys.forEach((k) => expect(logText({ message: 'x', msgKey: k }, 'he'), k).not.toMatch(LATIN));
    expect(logText({ message: 'x', msgKey: 'm.why.needsAge', msgVars: { age: { k: 'age', id: 'classical', en: 'classical' } } }, 'he')).toContain('התקופה הקלאסית');
  });
  it('the independents list labels follow the language', () => {
    setCurrentLanguage('he');
    [...LIST_SORTS, ...LIST_FILTERS].forEach((x) => expect(x.label, x.id).not.toMatch(LATIN));
    expect(kmLabel(120)).toBe('120 ק"מ');
    setCurrentLanguage('en');
    expect(LIST_SORTS[0].label).toBe('Nearest');
  });
});

describe('regiment names', () => {
  it('a one-word plural joins the people in the construct state', () => {
    setCurrentLanguage('he');
    const akkad = HE_PEOPLES.akkad;
    expect(regimentLabel('1st Akkadian Hunters', 'akkad', 'ציידים', 1)).toBe(`ציידי ${akkad} (גדוד 1)`);
    expect(regimentLabel('x', 'akkad', 'חיל רגלים', 2)).toBe(`חיל רגלים של ${akkad} (גדוד 2)`);
  });
});

describe('every name a log line can carry is Hebrew', () => {
  const english = (k, ids) => ids.map((id) => ({ k, id, en: String(id) })).filter((r) => LATIN.test(refName(r, 'he'))).map((r) => `${r.k}:${r.id}`);
  it('buildings, improvements, wonders, governments, taxes, city-states, districts, identity, resources', () => {
    const missing = [
      ...english('building', Object.entries(BUILDING_CATEGORIES).flatMap(([c, d]) => (d.tiers || []).map((_, i) => `${c}.${i}`))),
      ...english('improvement', Object.keys(IMPROVEMENTS)),
      ...english('wonder', Object.keys(GREAT_PROJECTS)),
      ...english('government', Object.keys(GOVERNMENT_TYPES)),
      ...english('taxRate', Object.keys(TAX_RATES)),
      ...english('cityStateType', Object.keys(CITY_STATE_TYPES)),
      ...english('district', Object.keys(DISTRICTS)),
      ...english('identityPole', Object.keys(IDENTITY_AXES).flatMap((a) => [`${a}.pos`, `${a}.neg`])),
      ...english('resource', RESOURCE_IDS),
      ...english('devType', ['tax', 'production', 'manpower'])
    ];
    expect(missing).toEqual([]);
  });
});

describe('every literal key in the code exists', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : /\.(js|jsx)$/.test(e.name) && !e.name.includes('.test.') ? [join(d, e.name)] : []));
  it("t('a.b') never shows a bare key (plural keys count by their forms)", () => {
    const en = tableOf('en'); const dh = dataTable('he');
    const has = (k) => en[k] !== undefined || en[`${k}.other`] !== undefined || en[`${k}.one`] !== undefined || dh[k] !== undefined;
    const missing = [];
    walk('src').filter((f) => !f.replace(/\\/g, '/').includes('/i18n/locales/')).forEach((f) => {
      readFileSync(f, 'utf8').split('\n').forEach((line) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        for (const m of line.matchAll(/\b(?:t|tNow|tr|translate|tOr|tx)\(\s*'([a-zA-Z]\w*(?:\.\w+)+)'/g)) if (!has(m[1])) missing.push(`${f}: ${m[1]}`);
      });
    });
    expect(missing).toEqual([]);
  });
});
