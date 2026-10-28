// src/i18n/i18n.test.js
// The i18n core (t, plurals, fallback, numbers and years), the two tables and Hebrew names.
import { describe, it, expect } from 'vitest';
import { translate, detectLanguage, pluralForm, formatYear, formatNumber, agoText, tableOf, LANGUAGES } from './index';
import { nameOf, transliterate } from './names';
import { HE_PEOPLES, HE_CITIES } from './hebrewNames';
import { MAJOR_PEOPLES_LIST, PEOPLES_LIST } from '../data/peoples';

const LATIN = /[A-Za-zÀ-ɏ]/;

describe('t()', () => {
  it('fills {name} and keeps a missing value visible', () => {
    expect(translate('menu.turnLine', { turn: 4, nation: 'Akkad' }, 'en')).toBe('Turn 4, Akkad');
    expect(translate('menu.turnLine', { turn: 4 }, 'en')).toBe('Turn 4, {nation}');
  });
  it('keeps a signed number and its % together left to right in Hebrew only', () => {
    expect(translate('de.control', { v: '-3' }, 'he')).toBe('שליטה ⁦-3%⁩');
    expect(translate('empire.perTurn', { n: -15 }, 'he')).toContain('⁦-15⁩');
    expect(translate('empire.perTurn', { n: 15 }, 'he')).not.toContain('⁦');
    expect(translate('de.control', { v: '-3' }, 'en')).toBe('Control -3%');
  });
  it('shows the key when nobody has it, and each language its own text', () => {
    expect(translate('no.such.key', null, 'he')).toBe('no.such.key');
    expect(translate('menu.title', null, 'en')).toBe(tableOf('en')['menu.title']);
    expect(translate('menu.title', null, 'he')).toBe(tableOf('he')['menu.title']);
  });
  it('picks plural forms: English one/other, Hebrew one/two/other', () => {
    expect(pluralForm(1, 'en')).toBe('one');
    expect(pluralForm(2, 'en')).toBe('other');
    expect(pluralForm(2, 'he')).toBe('two');
    expect(translate('time.minutesAgo', { count: 1 }, 'en')).toBe('1 minute ago');
    expect(translate('time.minutesAgo', { count: 5 }, 'en')).toBe('5 minutes ago');
    expect(translate('time.minutesAgo', { count: 2 }, 'he')).toBe('לפני שתי דקות');
    expect(translate('time.minutesAgo', { count: 5 }, 'he')).toBe('לפני 5 דקות');
  });
  it('writes years, numbers and ago-times in the language', () => {
    expect(formatYear(-1850, 'en')).toBe('1850 BCE');
    expect(formatYear(1850, 'en')).toBe('1850 CE');
    expect(formatYear(-1850, 'he')).toBe('1850 לפנה״ס');
    expect(formatNumber(12345, null, 'en')).toBe('12,345');
    expect(agoText(0, 3 * 3600 * 1000, 'en')).toBe('3 hours ago');
    expect(agoText(0, 30 * 1000, 'he')).toBe('ממש עכשיו');
  });
  it('defaults to Hebrew only when the device language is Hebrew', () => {
    expect(detectLanguage('he-IL')).toBe('he');
    expect(detectLanguage('iw')).toBe('he');
    expect(detectLanguage('en-US')).toBe('en');
    expect(detectLanguage('')).toBe('en');
    expect(LANGUAGES.he.dir).toBe('rtl');
  });
});

describe('the tables', () => {
  it('Hebrew has no key English lacks, and the same {names} in each text', () => {
    const en = tableOf('en'); const he = tableOf('he');
    const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    for (const [k, v] of Object.entries(he)) {
      // Hebrew has a .two form English lacks; its base must exist in English
      expect(en[k] ?? en[k.replace(/.two$/, '.other')], `Hebrew key without English: ${k}`).toBeDefined();
      // a .one or .two form may write the number in words ("a minute"), so only .other must match
      if (!k.endsWith('.one') && !k.endsWith('.two')) expect(vars(v), `variables differ in ${k}`).toBe(vars(en[k.replace(/.(one|two)$/, '.other')] ?? en[k]));
    }
  });
  it('every key converted so far has a Hebrew text', () => {
    const he = tableOf('he');
    const missing = Object.keys(tableOf('en')).filter((k) => he[k] === undefined && !k.endsWith('.one') && !k.endsWith('.two'));
    expect(missing).toEqual([]);
  });
});

describe('Hebrew names', () => {
  it('English shows the game name as it is', () => {
    expect(nameOf('people', 'akkad', 'Akkad', 'en')).toBe('Akkad');
  });
  it('the table covers the 50 major peoples and their capitals', () => {
    for (const p of MAJOR_PEOPLES_LIST) {
      expect(HE_PEOPLES[p.id], `people ${p.id}`).toBeDefined();
      expect(HE_CITIES[p.capital.name], `capital ${p.capital.name}`).toBeDefined();
    }
  });
  it('no Latin letters in any people, capital or city name in Hebrew mode', () => {
    for (const p of PEOPLES_LIST) {
      expect(nameOf('people', p.id, p.name, 'he'), p.id).not.toMatch(LATIN);
      expect(nameOf('city', null, p.capital.name, 'he'), p.capital.name).not.toMatch(LATIN);
      for (const c of p.cities) expect(nameOf('city', null, c, 'he'), c).not.toMatch(LATIN);
    }
  });
  it('transliterates any Latin text, never with Latin left over, and is stable', () => {
    for (const s of ['Tenochtitlan', 'Ötüken', "O'Brien", 'Saint-Étienne', 'Zhengzhou', 'Ur III', 'Æthelred']) {
      const a = transliterate(s);
      expect(a).not.toMatch(LATIN);
      expect(a.length).toBeGreaterThan(0);
      expect(transliterate(s)).toBe(a);
    }
  });
  it('titles keep their word: Kingdom of Israel', () => {
    expect(nameOf('people', 'israel', 'Kingdom of Israel', 'he')).toBe('ממלכת ישראל');
  });
});
