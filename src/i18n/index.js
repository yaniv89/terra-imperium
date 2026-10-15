// src/i18n/index.js
// Text in the player's language (plans/hebrew-support-plan.md, phase H0). No library.
//
//   t('menu.title')                         the text for a key in the current language
//   t('title.turn', { n: 12 })              {n} is replaced by the value
//   t('time.minutesAgo', { count: 3 })      a plural: the table holds `.one`, `.two` and `.other` forms
//                                           (Intl.PluralRules picks the form for the language)
//
// To add a string: put the key and the English text in locales/en.js, the Hebrew text in locales/he.js,
// then write t('your.key') in the component (useT() in a component, so it redraws on a switch).
// A key missing in Hebrew shows the English text. Open the game with ?i18nKeys to see keys instead.
//
// The language is saved per device (localStorage, read and written defensively). The first time the
// default is Hebrew when the device says Hebrew, else English. A switch applies at once, no reload:
// <html lang dir> follow it and the Hebrew fonts load the first time Hebrew is on.
import en from './locales/en';
import he from './locales/he';

export const LANGUAGES = Object.freeze({
  en: Object.freeze({ id: 'en', native: 'English', dir: 'ltr', locale: 'en' }),
  he: Object.freeze({ id: 'he', native: 'עברית', dir: 'rtl', locale: 'he-IL' })
});
export const LANGUAGE_IDS = Object.freeze(Object.keys(LANGUAGES));
export const STORAGE_KEY = 'terra-imperium.language';

const TABLES = { en, he };

// Pure: what the device asks for.
export const detectLanguage = (navigatorLanguage) => {
  const code = String(navigatorLanguage || '').toLowerCase();
  return code.startsWith('he') || code.startsWith('iw') ? 'he' : 'en';
};

const readStored = () => {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return LANGUAGES[v] ? v : null;
  } catch (e) { return null; }
};
const writeStored = (id) => { try { localStorage.setItem(STORAGE_KEY, id); } catch (e) { /* private window: the choice lasts for this visit */ } };

const showKeys = () => {
  try { return typeof location !== 'undefined' && new URLSearchParams(location.search).has('i18nKeys'); } catch (e) { return false; }
};

// Until the Hebrew text covers every screen (plans/hebrew-support-plan.md, H6), a new device starts
// in English; Hebrew only by choice in the Menu. Then: detectLanguage(navigator.language).
export const AUTO_DETECT_LANGUAGE = false;
let current = readStored() || (AUTO_DETECT_LANGUAGE ? detectLanguage(typeof navigator !== 'undefined' ? navigator.language : '') : 'en');
const listeners = new Set();

export const getLanguage = () => current;
export const isRtl = (lang = current) => LANGUAGES[lang]?.dir === 'rtl';
export const subscribeLanguage = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// <html lang dir>, and the Hebrew font stylesheet the first time Hebrew is on.
const HEBREW_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Heebo:wght@400;500;600;700&display=swap';
export const applyLanguageToDocument = (lang = current) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const def = LANGUAGES[lang] || LANGUAGES.en;
  root.setAttribute('lang', def.id);
  root.setAttribute('dir', def.dir);
  if (lang === 'he' && !document.getElementById('i18n-hebrew-fonts')) {
    const link = document.createElement('link');
    link.id = 'i18n-hebrew-fonts';
    link.rel = 'stylesheet';
    link.href = HEBREW_FONTS_HREF;
    document.head.appendChild(link);
  }
};

export const setLanguage = (id) => {
  if (!LANGUAGES[id]) return;
  const changed = id !== current;
  current = id;
  writeStored(id);
  applyLanguageToDocument(id);
  if (changed) listeners.forEach((fn) => fn(id));
};

// Run once at start: puts lang, dir and the fonts on the page for the saved or detected language.
export const initI18n = () => applyLanguageToDocument(current);

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
export const formatDate = (ms, opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }, lang = current) => {
  if (!Number.isFinite(ms)) return '';
  try { return new Date(ms).toLocaleString(localeOf(lang), opts); } catch (e) { return ''; }
};
export const formatYear = (year, lang = current) => {
  if (!Number.isFinite(year)) return '';
  return year < 0 ? translate('year.bce', { n: formatNumber(-year, { useGrouping: false }, lang) }, lang) : translate('year.ce', { n: formatNumber(year, { useGrouping: false }, lang) }, lang);
};

/** "3 minutes ago" in the language (same steps as utils/launchDecision.js playedAgo). */
export const agoText = (savedAt, now = Date.now(), lang = current) => {
  if (!Number.isFinite(savedAt)) return '';
  const ms = Math.max(0, now - savedAt);
  const MIN = 60000; const HOUR = 60 * MIN; const DAY = 24 * HOUR;
  if (ms < MIN) return translate('time.justNow', null, lang);
  if (ms < HOUR) return translate('time.minutesAgo', { count: Math.floor(ms / MIN) }, lang);
  if (ms < DAY) return translate('time.hoursAgo', { count: Math.floor(ms / HOUR) }, lang);
  if (ms < 60 * DAY) return translate('time.daysAgo', { count: Math.floor(ms / DAY) }, lang);
  return translate('time.monthsAgo', { count: Math.floor(ms / (30 * DAY)) }, lang);
};

/** The text for `key` when the table has it, else `fallback` (game data that is not translated yet). */
export const tOr = (key, fallback, vars) => (hasKey(key, 'en') ? translate(key, vars, current) : fallback);
/** An age's name ("Bronze Age") in the current language. */
export const ageName = (id, fallback) => tOr(`age.${id}`, fallback || id);
