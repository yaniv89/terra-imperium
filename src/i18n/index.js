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
// This file is the browser half: the saved choice (localStorage, read and written defensively),
// <html lang dir>, the Hebrew fonts, dates and "played ago". The pure half (tables, t(), plurals,
// numbers, years) is ./core.js, which src/engine may import; the engine must never import this file.
import { LANGUAGES, detectLanguage, getLanguage, setCurrentLanguage, translate } from './core';

export * from './core';

export const STORAGE_KEY = 'terra-imperium.language';

const readStored = () => {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return LANGUAGES[v] ? v : null;
  } catch (e) { return null; }
};
const writeStored = (id) => { try { localStorage.setItem(STORAGE_KEY, id); } catch (e) { /* private window: the choice lasts for this visit */ } };

// Until the Hebrew text covers every screen (plans/hebrew-support-plan.md, H6), a new device starts
// in English; Hebrew only by choice in the Menu. Then: detectLanguage(navigator.language).
export const AUTO_DETECT_LANGUAGE = false;
setCurrentLanguage(readStored() || (AUTO_DETECT_LANGUAGE ? detectLanguage(typeof navigator !== 'undefined' ? navigator.language : '') : 'en'));

// <html lang dir>, and the Hebrew font stylesheet the first time Hebrew is on.
const HEBREW_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Heebo:wght@400;500;600;700&display=swap';
export const applyLanguageToDocument = (lang = getLanguage()) => {
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
  writeStored(id);
  applyLanguageToDocument(id);
  setCurrentLanguage(id);
};

// Run once at start: puts lang, dir and the fonts on the page for the saved or detected language.
export const initI18n = () => applyLanguageToDocument(getLanguage());

const localeOf = (lang) => LANGUAGES[lang]?.locale || 'en';
export const formatDate = (ms, opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }, lang = getLanguage()) => {
  if (!Number.isFinite(ms)) return '';
  try { return new Date(ms).toLocaleString(localeOf(lang), opts); } catch (e) { return ''; }
};

/** "3 minutes ago" in the language (same steps as utils/launchDecision.js playedAgo). */
export const agoText = (savedAt, now = Date.now(), lang = getLanguage()) => {
  if (!Number.isFinite(savedAt)) return '';
  const ms = Math.max(0, now - savedAt);
  const MIN = 60000; const HOUR = 60 * MIN; const DAY = 24 * HOUR;
  if (ms < MIN) return translate('time.justNow', null, lang);
  if (ms < HOUR) return translate('time.minutesAgo', { count: Math.floor(ms / MIN) }, lang);
  if (ms < DAY) return translate('time.hoursAgo', { count: Math.floor(ms / HOUR) }, lang);
  if (ms < 60 * DAY) return translate('time.daysAgo', { count: Math.floor(ms / DAY) }, lang);
  return translate('time.monthsAgo', { count: Math.floor(ms / (30 * DAY)) }, lang);
};
