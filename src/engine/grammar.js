// src/engine/grammar.js
// Shared wording helpers for log lines, news and sheets (playtest audit I224): one place for
// "1 unit / 2 units", for a plural people ("the Elamite tribes descend") and for place names that
// already carry a battle word ("Sack of Kish" must not become "sacks Sack of Kish"). Pure.

/** "1 unit", "2 units". `many` is for irregular plurals. */
export const countOf = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

// Last words of a people's or independent's shown name that read as a plural group
// (src/data/independents.js forms: "the Colchian tribes", "Norse sea raiders", "Rus militias").
const PLURAL_LAST_WORDS = new Set(['tribes', 'raiders', 'militias', 'pirates', 'corsairs', 'peoples', 'nomads', 'clans', 'horsemen']);

/** True when a nation name names a group that takes plural verbs ("the Elamite tribes"). */
export const isPluralName = (name) => {
  const last = String(name || '').trim().split(/\s+/).pop().toLowerCase();
  return PLURAL_LAST_WORDS.has(last);
};

/** The verb that agrees with `name`: `agree('the Mariote horde', 'demand')` = "demands",
 * `agree('the Elamite tribes', 'demand')` = "demand". Regular verbs only (add s / es / ies). */
export const agree = (name, base) => {
  if (isPluralName(name)) return base;
  if (/(s|sh|ch|x|z)$/.test(base)) return `${base}es`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ies`;
  return `${base}s`;
};

/** A subject and its verb: "the Mariote horde pillages the land". */
export const subjectVerb = (name, base, rest = '') => `${name} ${agree(name, base)}${rest ? ` ${rest}` : ''}`;

// Battle names (src/engine/battleNames.js) start with a battle word; the place is what follows.
const BATTLE_WORD = /^(Battle of|Battle near|Siege of|Siege near|Sea battle off|Landing at|Raid on|Sack of|Sally from|Revolt in)\s+/i;

/** The place inside a battle name: "Sack of Kish" gives "Kish". Other text comes back unchanged. */
export const plainPlace = (name) => String(name || '').replace(BATTLE_WORD, '');
