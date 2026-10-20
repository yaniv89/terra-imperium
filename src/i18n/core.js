// src/i18n/core.js
// The pure half of the translator (plans/hebrew-support-plan.md): the tables, the current language,
// t(), plurals, numbers and years. No clock, no storage, no DOM, so src/engine may import it and stay
// deterministic (determinismGuard.test.js, enginePurity.test.js). src/i18n/index.js adds the browser half.
import enBase from './locales/en';
import heBase from './locales/he';
import enMsg from './locales/msg.en';
import heMsg from './locales/msg.he';
import enUi from './locales/ui.en';
import heUi from './locales/ui.he';
import dataHe from './locales/data.he';

// The shell tables and the engine's message tables (log lines, news, cards: phase H3) as one.
const en = { ...enBase, ...enMsg, ...enUi };
const he = { ...heBase, ...heMsg, ...heUi };

export const LANGUAGES = Object.freeze({
  en: Object.freeze({ id: 'en', native: 'English', dir: 'ltr', locale: 'en' }),
  he: Object.freeze({ id: 'he', native: 'עברית', dir: 'rtl', locale: 'he-IL' })
});
export const LANGUAGE_IDS = Object.freeze(Object.keys(LANGUAGES));

const TABLES = { en, he };

// Pure: what the device asks for.
export const detectLanguage = (navigatorLanguage) => {
  const code = String(navigatorLanguage || '').toLowerCase();
  return code.startsWith('he') || code.startsWith('iw') ? 'he' : 'en';
};

const showKeys = () => {
  try { return typeof location !== 'undefined' && new URLSearchParams(location.search).has('i18nKeys'); } catch (e) { return false; }
};

let current = 'en';
const listeners = new Set();

export const getLanguage = () => current;
export const isRtl = (lang = current) => LANGUAGES[lang]?.dir === 'rtl';
export const subscribeLanguage = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
/** Used by index.js only: changes the language and tells the listeners. */
export const setCurrentLanguage = (id) => {
  if (!LANGUAGES[id]) return false;
  const changed = id !== current;
  current = id;
  if (changed) listeners.forEach((fn) => fn(id));
  return changed;
};

// {name} -> value. A name with no value is left as written, so a gap is visible.
const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k]))) : text);

const pluralRules = {};
export const pluralForm = (n, lang = current) => {
  try {
    pluralRules[lang] = pluralRules[lang] || new Intl.PluralRules(LANGUAGES[lang]?.locale || 'en');
    return pluralRules[lang].select(n); // en: one/other. he: one/two/other (and many in some versions)
  } catch (e) { return n === 1 ? 'one' : 'other'; }
};

const lookup = (key, lang, vars) => {
  const table = TABLES[lang] || {};
  if (vars && Number.isFinite(vars.count)) {
    const form = pluralForm(vars.count, lang);
    const hit = table[`${key}.${form}`] ?? table[`${key}.other`];
    if (hit !== undefined) return hit;
  }
  return table[key];
};

/** The text for `key` in `lang` (default: the current language). English is the fallback. */
export const translate = (key, vars, lang = current) => {
  if (showKeys()) return key;
  const text = lookup(key, lang, vars) ?? lookup(key, 'en', vars);
  return text === undefined ? key : fill(text, vars);
};
export const t = (key, vars) => translate(key, vars, current);
export const hasKey = (key, lang) => lookup(key, lang, null) !== undefined || lookup(key, lang, { count: 1 }) !== undefined;
export const tableOf = (lang) => TABLES[lang] || {};

// Numbers and dates in the language's own habits (Hebrew keeps ASCII digits; the order and the
// separators follow the locale). Years are written by us: 1850 BCE, 1850 לפנה"ס.
const localeOf = (lang) => LANGUAGES[lang]?.locale || 'en';
export const formatNumber = (n, opts, lang = current) => {
  try { return new Intl.NumberFormat(localeOf(lang), opts || undefined).format(n); } catch (e) { return String(n); }
};
export const formatYear = (year, lang = current) => {
  if (!Number.isFinite(year)) return '';
  // Before 2000 BCE a date is an estimate: "c. 4200 BCE" (eight-ages plan U22).
  if (year < -2000) return translate('year.bceCirca', { n: formatNumber(-year, { useGrouping: false }, lang) }, lang);
  return year < 0 ? translate('year.bce', { n: formatNumber(-year, { useGrouping: false }, lang) }, lang) : translate('year.ce', { n: formatNumber(year, { useGrouping: false }, lang) }, lang);
};

/** Game data text (names, descriptions) by id. English: the data's own `english` text, always. Hebrew:
 * the data table (locales/data.he.js) when it has `key`, else the English text. {name} in the Hebrew
 * text is filled from `vars`. */
export const dataText = (key, english, vars, lang = current) => {
  if (lang !== 'he') return english;
  const hit = dataHe[key];
  return hit === undefined ? english : fill(hit, vars);
};
export const hasDataText = (key, lang = 'he') => lang === 'he' && dataHe[key] !== undefined;
export const dataTable = (lang = 'he') => (lang === 'he' ? dataHe : {});

/** The text for `key` when a table has it, else `fallback` (game data that is not translated yet). */
export const tOr = (key, fallback, vars) => (hasKey(key, 'en') ? translate(key, vars, current) : dataText(key, fallback, vars, current));
/** An age's name ("Bronze Age") in the current language. */
export const ageName = (id, fallback) => tOr(`age.${id}`, fallback || id);

/** A number with a sign ("+10", "-3") inside running text, kept left to right in Hebrew (the sign would flip to the wrong side). */
export const isolateLtr = (text) => (isRtl() ? `\u2066${text}\u2069` : String(text));
