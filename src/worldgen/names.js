// src/worldgen/names.js
// Generated place names for a generated world (plans/MAP-VARIATIONS-PLAN.md 6.5): eight built-in
// phonologies (syllable sets), one per landmass by seed, so a continent's rivers, ranges and places
// sound alike. Names depend on the map only (hash rolls of seed and id), never on the game.
// A small blocklist keeps unlucky syllable joins out.
import { hash1 } from './v1/noise';

export const PHONOLOGIES = [
  { name: 'river valley', onset: ['k', 'n', 'm', 'r', 's', 't', 'sh', 'h', 'b', 'd'], vowel: ['a', 'a', 'i', 'u', 'e'], coda: ['', '', 'n', 'r', 'sh', 'm'], ends: ['', 'u', 'ash', 'ir'] },
  { name: 'highland', onset: ['th', 'k', 'v', 'r', 'l', 'g', 'm', 'dr', 'br'], vowel: ['o', 'a', 'e', 'y', 'ae'], coda: ['', 'n', 'l', 'th', 'rn', 'g'], ends: ['', 'or', 'en', 'wy'] },
  { name: 'island', onset: ['k', 'l', 'm', 'n', 'p', 't', 'w', 'h', ''], vowel: ['a', 'e', 'i', 'o', 'u', 'a'], coda: ['', '', '', 'n'], ends: ['', 'a', 'i', 'o'] },
  { name: 'steppe', onset: ['q', 'k', 'b', 't', 's', 'z', 'ch', 'y', 'ar'], vowel: ['a', 'u', 'o', 'e', 'i'], coda: ['', 'r', 'n', 'k', 'z', 'q', 'l'], ends: ['', 'an', 'ul', 'ai'] },
  { name: 'forest', onset: ['v', 's', 'r', 'h', 'f', 'g', 'kv', 'st', 'br'], vowel: ['a', 'e', 'i', 'o', 'ei', 'au'], coda: ['', 'n', 'rd', 'lk', 's', 'nd'], ends: ['', 'a', 'heim', 'vik', 'ung'] },
  { name: 'jungle', onset: ['m', 'b', 'k', 't', 'ng', 'w', 'z', 'l', 'nd'], vowel: ['a', 'o', 'u', 'i', 'e'], coda: ['', '', 'm', 'n'], ends: ['', 'a', 'we', 'ko', 'ni'] },
  { name: 'coastal', onset: ['p', 't', 'l', 'm', 'n', 'kr', 'th', 's', 'ph'], vowel: ['a', 'e', 'i', 'o', 'y'], coda: ['', 's', 'n', 'r', 'x'], ends: ['', 'os', 'is', 'ene', 'ia'] },
  { name: 'desert', onset: ['z', 'q', 'kh', 'h', 's', 'm', 'r', 'd', 'j'], vowel: ['a', 'a', 'u', 'i', 'aa'], coda: ['', 'r', 'b', 'd', 'm', 'q'], ends: ['', 'ar', 'im', 'un'] }
];

const BLOCKLIST = ['fuk', 'fuc', 'shit', 'cunt', 'nig', 'fag', 'rape', 'kkk', 'dick', 'cock', 'puss', 'twat', 'anus', 'arse', 'piss', 'slut', 'whor', 'nazi'];
const bad = (s) => BLOCKLIST.some((b) => s.includes(b));

const pick = (list, h) => list[h % list.length];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** A word in phonology `phon` from the roll (key, salt): two or three syllables and an ending. */
export const makeWord = (phon, key, salt) => {
  const P = PHONOLOGIES[phon % PHONOLOGIES.length];
  for (let attempt = 0; attempt < 8; attempt++) {
    const s = (salt + attempt * 0x9e37) | 0;
    const syll = 2 + (hash1(key, s) % 3 === 0 ? 1 : 0);
    let w = '';
    for (let k = 0; k < syll; k++) {
      w += pick(P.onset, hash1(key * 7 + k, s ^ 0x1234)) + pick(P.vowel, hash1(key * 13 + k, s ^ 0x5678));
      if (k === syll - 1 || hash1(key * 17 + k, s ^ 0x9abc) % 3 === 0) w += pick(P.coda, hash1(key * 19 + k, s ^ 0xdef0));
    }
    w += pick(P.ends, hash1(key, s ^ 0x2468));
    w = w.replace(/(.)\1\1+/g, '$1$1');
    if (w.length >= 3 && w.length <= 12 && !bad(w)) return cap(w);
  }
  return cap(`${pick(P.onset, key) || 'a'}${pick(P.vowel, key >> 3)}n`);
};

const RANGE_FORMS = [(w) => `${w} Mountains`, (w) => `${w} Range`, (w) => `The ${w} Heights`, (w) => `${w} Mountains`];
export const rangeName = (phon, key, salt) => RANGE_FORMS[hash1(key, salt ^ 0x77) % RANGE_FORMS.length](makeWord(phon, key, salt));
export const riverName = (phon, key, salt) => makeWord(phon, key, salt ^ 0x3c3c);
export const placeName = (phon, key, salt) => makeWord(phon, key, salt ^ 0x5a5a);
