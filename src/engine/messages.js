// src/engine/messages.js
// Log lines, news and card text as { key, vars } (plans/hebrew-support-plan.md, phase H3). The
// engine writes `msg('turn.income', { gold: 120 })`, which gives a log entry's text fields:
//   message   the English sentence (old readers, saves, tests and the summarizer read it)
//   msgKey    the key in the message tables (src/i18n/locales/msg.en.js and msg.he.js)
//   msgVars   raw values: numbers, ids and names as the game has them (refs below), never a
//             translated word, so the UI can write the line again in any language.
// Pure and deterministic: no clock, no storage, no Intl except the English plural rule. The text
// never feeds back into a game number. The engine imports only src/i18n/core.js from src/i18n.
//
// A name is a ref: { k: kind, id, en } (en is the game's own name, so a city that is gone or a
// nation that was renamed still shows the name it had). The UI turns a ref into a name in its
// language (src/i18n/messageText.js); in English a ref is its `en`.
//
// Placeholders: {name} (a value or a ref), {n:num} (1,234), {g:money} (1.2Kg), {x:pct} (35%),
// {nation:agree=demand} (the English verb that agrees with the nation's name: "demands" or, for
// "the Elamite tribes", "demand"). A var may itself be a message (`sub(key, vars)`), written in
// place. A key with `.one` / `.two` / `.other` forms is a plural and takes its form from `count`.
import { tableOf, pluralForm, isRtl, isolateSigned, inSentence } from '../i18n/core';
import { agree } from './grammar';

/** A name in a message: kind is 'people', 'city', 'person', 'place', 'tech', 'unit', 'building',
 * 'battle', 'thing' (any other game data name). */
export const ref = (k, id, en) => ({ k, ...(id != null ? { id } : {}), en: en == null ? String(id ?? '') : String(en) });
export const people = (id, en) => ref('people', id, en);
export const cityRef = (id, en) => ref('city', id, en);
export const person = (en) => ref('person', null, en);
export const place = (en) => ref('place', null, en);
export const thing = (k, id, en) => ref(k, id, en);
/** A message inside a message: written in place in the reader's language. */
export const sub = (key, vars) => ({ k: 'm', key, ...(vars ? { vars } : {}) });

const isRef = (v) => v && typeof v === 'object' && typeof v.k === 'string';

const lookup = (table, key, vars, lang) => {
  if (vars && Number.isFinite(vars.count)) {
    const form = pluralForm(vars.count, lang);
    const hit = table[`${key}.${form}`] ?? table[`${key}.other`];
    if (hit !== undefined) return hit;
  }
  return table[key];
};

const groupDigits = (n) => {
  const neg = n < 0;
  const [int, frac] = String(Math.abs(n)).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
};
// Same as utils/helpers formatMoney (kept here so the text module stays a leaf).
const shortNumber = (num) => {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Gold in Hebrew is a number and the word: "1,500 זהב", "2.5 מיליון זהב" (never the English "g").
const heMoney = (v) => {
  const n = Number(v) || 0;
  return Math.abs(n) >= 1000000 ? `${(n / 1000000).toFixed(1)} מיליון זהב` : `${groupDigits(Math.round(n))} זהב`;
};

/**
 * Write a message in `lang`. `nameOfRef(ref, lang)` writes a ref (the UI passes the Hebrew names;
 * the default is the English name). A key the tables lack writes the key, so a gap is visible.
 */
export const msgText = (key, vars, lang = 'en', nameOfRef = null) => {
  const table = tableOf(lang);
  const en = tableOf('en');
  const text = lookup(table, key, vars, lang) ?? lookup(en, key, vars, 'en');
  if (text === undefined) return key;
  const value = (v) => {
    if (v === undefined || v === null) return '';
    if (isRef(v)) {
      if (v.k === 'm') return msgText(v.key, v.vars, lang, nameOfRef);
      return nameOfRef ? nameOfRef(v, lang) : v.en;
    }
    return String(v);
  };
  const out = text.replace(/\{(\w+)(?::(\w+)(?:=([\w ]+))?)?\}/g, (m, name, fmt, arg, at, all) => {
    const v = vars ? vars[name] : undefined;
    if (v === undefined) return m;
    if (fmt === 'num') return Number.isFinite(v) ? groupDigits(v) : value(v);
    if (fmt === 'money') return lang === 'he' ? heMoney(v) : `${shortNumber(v)}g`;
    if (fmt === 'pct') return `${v}%`;
    if (fmt === 'agree') return agree(isRef(v) ? v.en : String(v), arg || '');
    if (isRef(v) && v.k !== 'm') return inSentence(value(v), all.slice(0, at)); // a name mid-sentence: "the Dacian tribes"
    return value(v);
  });
  return isRtl(lang) ? isolateSigned(out) : out;
};


/** The text fields of a log entry (or a card line): spread into the entry. */
export const msg = (key, vars) => (vars
  ? { message: msgText(key, vars, 'en'), msgKey: key, msgVars: vars }
  : { message: msgText(key, null, 'en'), msgKey: key });

/** A log entry's text fields, carried from a sub-system's line (a string or a msg() result). */
export const carry = (l) => {
  if (l == null) return { message: '' };
  if (typeof l === 'string') return { message: l };
  return l.msgKey ? { message: l.message, msgKey: l.msgKey, ...(l.msgVars ? { msgVars: l.msgVars } : {}) } : { message: l.message };
};

/** A reason (why something cannot be done): the English `reason` and its message `reasonMsg` (a sub),
 * spread into a result as `{ ok: false, ...reasonOf('m.why.x') }`. The UI writes it with reasonText
 * (src/i18n/messageText.js). */
export const reasonOf = (key, vars) => ({ reason: msgText(key, vars, 'en'), reasonMsg: sub(key, vars) });
