// src/i18n/names.js
// Proper names in the current language. English shows the name as the game has it. In Hebrew every
// name is in Hebrew letters: the reviewed table (hebrewNames.js) first, else transliterate(), a
// fixed rule that turns any Latin name into Hebrew letters, so a generated or rare name is still
// Hebrew. Never random; the same name always gives the same spelling.
import { HE_PEOPLES, HE_CITIES, HE_TITLE_WORDS } from './hebrewNames';
import { getLanguage } from './core';

// Two-letter groups first, then single letters. Vowels in the middle of a word are mostly left
// out (as in unpointed Hebrew); o and u become vav, i becomes yod; a vowel that opens a word is an alef.
const DIGRAPHS = { sh: 'ש', ch: "צ'", kh: 'ח', th: 'ת', ph: 'פ', zh: "ז'", ts: 'צ', dj: "ג'", gh: 'ע', ng: 'נג', ck: 'ק', qu: 'קו', ou: 'ו', oo: 'ו', ee: 'י', ai: 'יי', ei: 'יי', au: 'או' };
const CONSONANTS = {
  b: 'ב', c: 'ק', d: 'ד', f: 'פ', g: 'ג', h: 'ה', j: "ג'", k: 'ק', l: 'ל', m: 'מ', n: 'נ', p: 'פ', q: 'ק',
  r: 'ר', s: 'ס', t: 'ט', v: 'ו', w: 'ו', x: 'קס', z: 'ז'
};
const FINAL = { 'מ': 'ם', 'נ': 'ן', 'צ': 'ץ', 'פ': 'ף', 'כ': 'ך' };
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae').replace(/ð/g, 'd').replace(/þ/g, 'th');

const transliterateWord = (raw) => {
  const w = strip(raw).toLowerCase();
  let out = '';
  for (let i = 0; i < w.length; i += 1) {
    const two = w.slice(i, i + 2);
    const atStart = out === '';
    const ch = w[i];
    if (DIGRAPHS[two]) { out += DIGRAPHS[two]; i += 1; continue; }
    if (CONSONANTS[ch]) { out += CONSONANTS[ch]; continue; }
    if ('aeiouy'.includes(ch)) {
      const last = i === w.length - 1;
      if (atStart) out += (ch === 'i' || ch === 'y') ? 'אי' : (ch === 'o' || ch === 'u') ? 'או' : 'א';
      else if (ch === 'o' || ch === 'u') out += 'ו';
      else if (ch === 'i' || ch === 'y') out += 'י';
      else if (last && ch === 'a') out += 'ה';
      // a and e in the middle of a word are not written
      continue;
    }
    // digits and apostrophes stay; any other stray character is dropped
    out += /[0-9']/.test(ch) ? ch : '';
  }
  if (!out) return '';
  const lastChar = out[out.length - 1];
  return FINAL[lastChar] ? out.slice(0, -1) + FINAL[lastChar] : out;
};

/** Any Latin text in Hebrew letters: spaces and hyphens keep the words apart. */
export const transliterate = (text) => String(text ?? '')
  .split(/([\s-]+)/)
  .map((part) => (/^[\s-]+$/.test(part) ? part : transliterateWord(part)))
  .join('')
  .replace(/[A-Za-z]/g, '');

const hebrewName = (kind, id, english) => {
  if (kind === 'people' && id && HE_PEOPLES[id]) {
    // "Kingdom of Israel": the title word stays, the people is the table's spelling
    const m = /^(kingdom of|empire of|republic of|league of)\s/i.exec(english || '');
    return m ? `${HE_TITLE_WORDS[m[1].toLowerCase()]} ${HE_PEOPLES[id]}` : HE_PEOPLES[id];
  }
  if (!english) return '';
  if (HE_CITIES[english]) return HE_CITIES[english];
  const m = /^(kingdom of|empire of|republic of|league of|the)\s+(.*)$/i.exec(english);
  if (m) {
    const word = HE_TITLE_WORDS[m[1].toLowerCase()];
    const rest = hebrewName(kind, null, m[2]);
    return word ? `${word} ${rest}` : rest;
  }
  return transliterate(english);
};

/** kind: 'people' | 'city' | 'person' | ...; id: the people id when there is one; english: the game's own name. */
export const nameOf = (kind, id, english, lang) => (lang === 'he' ? hebrewName(kind, id, english) : english);

/** nameOf in the current language, for view models that are not components (they rebuild when the language changes). */
export const nameNow = (kind, id, english) => nameOf(kind, id, english, getLanguage());
