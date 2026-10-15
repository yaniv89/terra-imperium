// src/i18n/messageText.js
// The engine's log lines, news and card lines in the reader's language (phase H3). A line with a
// `msgKey` is written again from its key and raw vars (src/engine/messages.js), names through
// nameOf (all names in Hebrew letters in Hebrew). A line without one (an old save, a line not
// converted yet) shows its English `message` as it is.
import { msgText } from '../engine/messages';
import { getLanguage, hasKey, translate } from './core';
import { nameOf } from './names';

// Proper names go through nameOf (the reviewed table, else transliteration). Every other kind is
// game data (tech, unit, building, wonder, law, mission, ...): its name comes from the data tables
// of phase H4 under `<kind>.<id>.name` when they have it, else the English name. An age is `age.<id>`.
const NAME_KINDS = new Set(['people', 'city', 'person', 'place', 'battle']);
const dataKey = (r) => (r.k === 'age' ? `age.${r.id}` : `${r.k}.${r.id}.name`);

export const refName = (r, lang) => {
  if (!r) return '';
  if (lang === 'en') return r.en;
  if (NAME_KINDS.has(r.k)) return nameOf(r.k, r.k === 'people' ? r.id : null, r.en, lang);
  if (r.id != null && hasKey(dataKey(r), 'en')) return translate(dataKey(r), null, lang);
  return r.en;
};

/** A key and vars in `lang` (default: the current language). */
export const messageOf = (key, vars, lang = getLanguage()) => msgText(key, vars, lang, refName);

/** A log entry's text (or any { message, msgKey, msgVars }) in `lang`. A folded recurring line
 * (engine/logSummary.js) keeps its count note. */
export const logText = (entry, lang = getLanguage()) => {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  if (!entry.msgKey || lang === 'en') return String(entry.message ?? '');
  const text = msgText(entry.msgKey, entry.msgVars, lang, refName);
  if (entry.count > 1 && entry.firstYear != null) return `${text} ${msgText('log.foldNote', { count: entry.count, year: entry.firstYear }, lang, refName)}`;
  return text;
};
