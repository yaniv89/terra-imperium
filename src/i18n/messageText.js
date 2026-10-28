// src/i18n/messageText.js
// The engine's log lines, news and card lines in the reader's language (phase H3). A line with a
// `msgKey` is written again from its key and raw vars (src/engine/messages.js), names through
// nameOf (all names in Hebrew letters in Hebrew). A line without one (an old save, a line not
// converted yet) shows its English `message` as it is.
import { msgText } from '../engine/messages';
import { getLanguage, hasKey, translate, hasDataText, dataText } from './core';
import { nameOf } from './names';

// Proper names go through nameOf (the reviewed table, else transliteration). Every other kind is
// game data (tech, unit, building, wonder, law, mission, ...): its name comes from the data tables
// of phase H4 under `<kind>.<id>.name` when they have it, else the English name. An age is `age.<id>`.
const NAME_KINDS = new Set(['people', 'city', 'person', 'place', 'battle']);
const dataKey = (r) => (r.k === 'age' ? `age.${r.id}` : `${r.k}.${r.id}.name`);

// Events: evt.<id>.title and evt.<id>.opt<N> (data/he.events.js); an option's id is "<eventId>.<index>".
// A drawn event's id is `p:<templateId>`: its texts are pevt.<templateId>.*.
const eventBase = (id) => (String(id).startsWith('p:') ? `pevt.${String(id).slice(2)}` : `evt.${id}`);
const eventKey = (r) => {
  if (r.k === 'event') return `${eventBase(r.id)}.title`;
  if (r.k === 'eventOption') { const i = String(r.id).lastIndexOf('.'); return i > 0 ? `${eventBase(String(r.id).slice(0, i))}.opt${String(r.id).slice(i + 1)}` : null; }
  return null;
};

// Kinds whose names live under another prefix in the tables (the same keys as gameText.js reads):
// a building is `btier.<category>.<tier>`, an improvement `impr.<id>`, a wonder `gp.<id>`, ...
const ALIAS = { building: 'btier', improvement: 'impr', wonder: 'gp', government: 'gov', taxRate: 'tax', cityStateType: 'cstype', district: 'district', resource: 'res', unit: 'uclass', techCategory: 'tc', devType: 'sw.dev', identityPole: 'ident' };
const aliasKey = (r) => (ALIAS[r.k] && r.id != null ? `${ALIAS[r.k]}.${r.k === 'techCategory' ? String(r.id).toLowerCase() : r.id}` : null);

export const refName = (r, lang) => {
  if (!r) return '';
  if (lang === 'en') return r.en;
  if (NAME_KINDS.has(r.k)) return nameOf(r.k, r.k === 'people' ? r.id : null, r.en, lang);
  if (r.id != null && hasKey(dataKey(r), 'en')) return translate(dataKey(r), null, lang);
  const ak = aliasKey(r);
  if (ak && hasKey(ak, 'en')) return translate(ak, null, lang);
  if (ak && hasDataText(ak)) return dataText(ak, r.en, null, lang);
  const ek = eventKey(r);
  if (ek && hasDataText(ek)) return dataText(ek, r.en, null, lang);
  const dk = `${r.k === 'unitClass' ? 'uclass' : r.k}.${r.id}`; // a unit class is `uclass.<id>` in the data tables
  if (r.id != null && hasDataText(dk)) return dataText(dk, r.en, null, lang);
  return r.en;
};

// A signed number ("+11g", "-5g", "-4700") in a right-to-left line: the sign is a neutral and
// lands on the far side ("11g+", playtest issue 17). Each one is isolated left to right (LRI ... PDI).
// A sign right after a letter or digit ("5-10") is a dash, not a sign, and stays.
const SIGNED = /(^|[^\p{L}\p{N}\u2066])([+\-\u2212]\d[\d,.]*(?:[a-z]{1,2}\b|%)?)/gu;
export const isolateSigned = (text, lang = getLanguage()) => (lang === 'he' ? String(text).replace(SIGNED, (m, pre, num) => `${pre}\u2066${num}\u2069`) : String(text));

/** A key and vars in `lang` (default: the current language). */
export const messageOf = (key, vars, lang = getLanguage()) => isolateSigned(msgText(key, vars, lang, refName), lang);

/** A log entry's text (or any { message, msgKey, msgVars }) in `lang`. A folded recurring line
 * (engine/logSummary.js) keeps its count note. */
export const logText = (entry, lang = getLanguage()) => {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  if (!entry.msgKey || lang === 'en') return String(entry.message ?? '');
  const text = msgText(entry.msgKey, entry.msgVars, lang, refName);
  if (entry.count > 1 && entry.firstYear != null) return isolateSigned(`${text} ${msgText('log.foldNote', { count: entry.count, year: entry.firstYear }, lang, refName)}`, lang);
  return isolateSigned(text, lang);
};

/** The reason of a refusal ({ reason, reasonMsg }, engine/messages.js reasonOf) in `lang`; an old or unconverted one shows its English. */
export const reasonText = (r, lang = getLanguage()) => {
  if (!r) return '';
  if (typeof r === 'string') return r;
  return r.reasonMsg && lang !== 'en' ? msgText(r.reasonMsg.key, r.reasonMsg.vars, lang, refName) : String(r.reason ?? '');
};
