// src/i18n/names.js
// Proper names in the current language. English shows the name as the game has it. In Hebrew every
// name is in Hebrew letters: the reviewed table (hebrewNames.js) first, else transliterate(), a
// fixed rule that turns any Latin name into Hebrew letters, so a generated or rare name is still
// Hebrew. Never random; the same name always gives the same spelling.
import { HE_PEOPLES, HE_CITIES, HE_TITLE_WORDS } from './hebrewNames';
import { HE_TITLE_FIXED, HE_GOVERNMENT_TITLES, HE_WATERS, HE_PERSONS } from './locales/data/he.names';
import { HE_COUNTRIES } from './locales/data/he.countries';
import { PEOPLES, PEOPLES_LIST } from '../data/peoples';
import { titleFor, EMPIRE_CITY_COUNT } from '../data/nationTitles';
import { INDEPENDENT_TITLE_FORMS, FREE_CITY_FORMS } from '../data/independents';
import { getLanguage, dataText } from './core';

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

const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fillName = (template, name) => template.replaceAll('{name}', name);
const ADJECTIVE_ID = new Map(PEOPLES_LIST.map((p) => [p.adjective, p.id]));

// "Kingdom of Akkad", "the Akkadian Empire": the title the game wrote for a people, in Hebrew.
const titleHe = (id, english) => {
  if (HE_TITLE_FIXED[english]) return HE_TITLE_FIXED[english];
  const people = PEOPLES[id];
  const name = HE_PEOPLES[id];
  if (!people || !name) return null;
  // "Kingdom of Israel" is a fixed title under two governments: read the words, not the government
  const lead = /^(kingdom of|empire of|republic of|league of)\s+(.*)$/i.exec(english || '');
  if (lead && lead[2] === people.stem) return `${HE_TITLE_WORDS[lead[1].toLowerCase()]} ${name}`;
  for (const gov of Object.keys(HE_GOVERNMENT_TITLES)) {
    for (const big of [false, true]) {
      if (titleFor(people, gov, big ? EMPIRE_CITY_COUNT : 1) !== english) continue;
      const f = HE_GOVERNMENT_TITLES[gov];
      const tpl = big ? ((people.plural && f.pluralEmpire) || f.empire) : ((people.plural && f.pluralRealm) || f.realm);
      return fillName(tpl, name);
    }
  }
  return null;
};

// An independent's name ("the Akkadian horde", "the free city of Kish") in Hebrew, by matching the
// English forms of data/independents.js (the people is written by its adjective there).
const INDEPENDENT_FORMS = [
  ...Object.entries(INDEPENDENT_TITLE_FORMS).flatMap(([shape, bands]) => Object.entries(bands).map(([band, tpl]) => ({ shape, band, tpl }))),
  ...Object.entries(FREE_CITY_FORMS).map(([band, tpl]) => ({ shape: 'free', band, tpl }))
];
const independentHe = (english) => {
  for (const { shape, band, tpl } of INDEPENDENT_FORMS) {
    const source = escapeRe(tpl).replace('\\{people\\}', '(?<people>.+?)').replace('\\{city\\}', '(?<city>.+?)');
    const m = new RegExp(`^${source}$`, 'i').exec(english);
    if (!m) continue;
    const key = `indep.form.${shape}.${band}`;
    const peopleId = m.groups?.people ? ADJECTIVE_ID.get(capitalise(m.groups.people)) : null;
    if (m.groups?.people && !peopleId && !m.groups?.city) continue;
    const vars = {
      people: peopleId ? HE_PEOPLES[peopleId] : (m.groups?.people ? transliterate(m.groups.people) : ''),
      city: m.groups?.city ? hebrewName('city', null, capitalise(m.groups.city)) : ''
    };
    return dataText(key, null, vars, 'he');
  }
  return null;
};

// "Battle of Kish", "Siege of Ur", "Sea battle off the Nile": the names battleNames.js writes.
const BATTLE_FORMS = [
  [/^Battle of (.+)$/, (x) => `הקרב על ${x}`], [/^Siege of (.+)$/, (x) => `המצור על ${x}`],
  [/^Sea battle off (.+)$/, (x) => `הקרב הימי מול ${x}`], [/^Landing at (.+)$/, (x) => `הנחיתה ב${x}`],
  [/^Raid on (.+)$/, (x) => `הפשיטה על ${x}`], [/^Sack of (.+)$/, (x) => `ביזת ${x}`],
  [/^Sally from (.+)$/, (x) => `הפרצה מ${x}`], [/^Revolt in (.+)$/, (x) => `המרד ב${x}`]
];
const placeHe = (text) => {
  if (!text) return '';
  if (/^the border$/i.test(text)) return 'הגבול';
  const water = /^the\s+(.+)$/i.exec(text);
  if (water) return hebrewName('place', null, water[1]);
  return hebrewName('city', null, text);
};
const battleHe = (english) => {
  for (const [re, make] of BATTLE_FORMS) {
    const m = re.exec(english);
    if (m) return make(placeHe(m[1]));
  }
  return null;
};

const hebrewName = (kind, id, english) => {
  if (kind === 'people' || kind === 'nation') {
    if (id && HE_PEOPLES[id]) {
      const t = titleHe(id, english);
      if (t) return t;
      const ind = english ? independentHe(english) : null;
      if (ind) return ind;
      // "Kingdom of Israel" typed by the picker, or the bare name
      const m = /^(kingdom of|empire of|republic of|league of)\s/i.exec(english || '');
      return m ? `${HE_TITLE_WORDS[m[1].toLowerCase()]} ${HE_PEOPLES[id]}` : HE_PEOPLES[id];
    }
    const ind = english ? independentHe(english) : null;
    if (ind) return ind;
  }
  if (kind === 'battle') return battleHe(english) || (english ? transliterate(english) : '');
  if (!english) return '';
  if (kind === 'person') {
    if (HE_PERSONS[english]) return HE_PERSONS[english];
    const gen = /^Commander (\d+)$/.exec(english);
    if (gen) return `מפקד ${gen[1]}`;
  }
  if (kind === 'place' || kind === 'water') { if (HE_WATERS[english]) return HE_WATERS[english]; }
  if (kind === 'land' && HE_COUNTRIES[english]) return HE_COUNTRIES[english];
  if (HE_CITIES[english]) return HE_CITIES[english];
  if (HE_COUNTRIES[english]) return HE_COUNTRIES[english];
  if (HE_WATERS[english]) return HE_WATERS[english];
  if (HE_PERSONS[english]) return HE_PERSONS[english];
  const m = /^(kingdom of|empire of|republic of|league of|the)\s+(.*)$/i.exec(english);
  if (m) {
    const word = HE_TITLE_WORDS[m[1].toLowerCase()];
    const rest = hebrewName(kind, null, m[2]);
    return word ? `${word} ${rest}` : rest;
  }
  return transliterate(english);
};

/** kind: 'people' | 'city' | 'place' | 'person' | 'battle'; id: the people id when there is one; english: the game's own name. */
export const nameOf = (kind, id, english, lang) => (lang === 'he' ? hebrewName(kind, id, english) : english);

/** nameOf in the current language, for view models that are not components (they rebuild when the language changes). */
export const nameNow = (kind, id, english) => nameOf(kind, id, english, getLanguage());

/** A unit's regiment name in the current language: "3rd Akkadian Spearmen" in English; in Hebrew
 * "<unit> של <people> (גדוד 3)". `baseName` is the unit's name already in the current language. */
export const regimentLabel = (english, peopleId, baseName, regiment) => {
  if (getLanguage() !== 'he') return english;
  const people = HE_PEOPLES[peopleId];
  if (!people) return baseName;
  return `${baseName} של ${people}${regiment ? ` (גדוד ${regiment})` : ''}`;
};
