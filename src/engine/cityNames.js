// src/engine/cityNames.js
// A name for a city a settler founds.
//
// A people of the pool (src/data/peoples.js, phase W0; plans/peoples-and-world-setup.md 4.6):
//   1. the next unused name of the founder's own 20 real city names (Akkad founds Agade, then
//      Sippar; the Kingdom of Israel founds Samaria, Megiddo, Hazor...);
//   2. when that list is used up: a real ancient name of the place, from the lists of the peoples
//      not in this world whose capitals are nearest the tile (CITY_NAME_NEIGHBOURS of them, nearest
//      first; the plan's Pleiades gazetteer would come first here, but no list of it exists yet);
//   3. last, a name made from the syllables of the founder's own names (a Sumerian-sounding name
//      for Akkad, never a Slavic one).
// A legacy nation (the 240-country world, plans/playtest-1.md P5.1): the tile's own name first (a
// real town stood there), then the nearest named tile within CITY_NAME_RINGS not yet used by a
// city, then a name made from the founder's culture group: two halves of two given names of the
// group (names.js), joined, so a Greek settler founds "Alexos" and a Slavic one "Bogoslav".
// Conquest never renames a city. Deterministic: made names come from a hash of the nation and the
// tile, no RNG.
import { ringsAround } from './world/cities';
import { generateGivenName } from '../data/names';
import { PEOPLES, PEOPLES_LIST } from '../data/peoples';
import { createRng } from '../utils/rng';
import { ringsForKm } from '../data/geo/gridScale';
import { distanceKm } from '../data/geo/geodesic';

export const CITY_NAME_KM = 306; // km (3 rings at frequency 75)
export const CITY_NAME_RINGS = ringsForKm(CITY_NAME_KM);
export const CITY_NAME_NEIGHBOURS = 3;

const hash = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const half = (name, first) => { const n = name.length; const cut = Math.max(2, Math.round(n / 2)); return first ? name.slice(0, cut) : name.slice(n - cut).toLowerCase(); };
const tidy = (name) => name.charAt(0).toUpperCase() + name.slice(1).replace(/(.)\1\1/g, '$1$1');

/** A made-up name in the nation's culture (deterministic in the seed). */
export const generateCityName = (nationId, seed) => {
  const rng = createRng(hash(`${nationId}|city|${seed}`));
  const a = generateGivenName(nationId, rng); const b = generateGivenName(nationId, rng);
  return tidy(half(a, true) + half(b, false));
};

// The first word of a real name, letters only ("Dur-Untash" -> "Dur", "Qal'at al-Bahrain" -> "Qalat").
const stemOf = (name) => name.normalize('NFC').split(/[\s-]/)[0].replace(/[^\p{L}]/gu, '');
/** A made-up name from a people's own city names: the first half of one, the second of another
 * (`long`: with the middle of a third between them, for when the short ones are all taken). */
export const generatePeopleCityName = (peopleId, seed, long = false) => {
  const list = (PEOPLES[peopleId]?.cities || []).map(stemOf).filter((s) => s.length >= 3);
  if (list.length < 2) return generateCityName(peopleId, seed);
  const rng = createRng(hash(`${peopleId}|city|${seed}`));
  const a = list[Math.floor(rng.next() * list.length)];
  let b = list[Math.floor(rng.next() * list.length)];
  if (b === a) b = list[(list.indexOf(a) + 1) % list.length];
  const c = list[Math.floor(rng.next() * list.length)].toLowerCase();
  const mid = long ? c.slice(Math.floor(c.length / 3), Math.max(Math.floor(c.length / 3) + 2, Math.ceil((2 * c.length) / 3))) : '';
  return tidy(half(a, true) + mid + half(b, false));
};

const peopleCityName = (regions, tiles, tile, peopleId, used) => {
  const own = PEOPLES[peopleId].cities.find((n) => !used.has(n));
  if (own) return own;
  const inWorld = new Set();
  Object.values(regions || {}).forEach((c) => { if (c?.owner) inWorld.add(c.owner); if (c?.founderId) inWorld.add(c.founderId); });
  const at = tiles.centres[tile];
  // On a generated world a people's real capital means nothing here: its own names, then made-up
  // ones from them (city names stay with the people, plans/MAP-VARIATIONS-PLAN.md 6.5).
  const neighbours = tiles.world?.kind === 'generated' ? [] : PEOPLES_LIST.filter((p) => !inWorld.has(p.id) && p.tile != null)
    .map((p) => ({ p, km: distanceKm(at, tiles.centres[p.tile]) }))
    .sort((a, b) => a.km - b.km || (a.p.id < b.p.id ? -1 : 1))
    .slice(0, CITY_NAME_NEIGHBOURS);
  for (const { p } of neighbours) { const name = p.cities.find((n) => !used.has(n)); if (name) return name; }
  for (let k = 0; k < 400; k++) { const made = generatePeopleCityName(peopleId, `${tile}|${k}`, k >= 40); if (!used.has(made)) return made; }
  return `${generatePeopleCityName(peopleId, tile)} ${tile % 97}`;
};

/** The name a new city on `tile` takes. `regions` is the cities map (names in use). */
export const pickCityName = (regions, tiles, tile, nationId) => {
  const used = new Set(Object.values(regions || {}).map((c) => c?.name).filter(Boolean));
  if (PEOPLES[nationId]) return peopleCityName(regions, tiles, tile, nationId, used);
  const own = tiles.names[tile];
  if (own && !used.has(own)) return own;
  const rings = ringsAround(tiles, tile, CITY_NAME_RINGS);
  const near = [...rings.entries()].filter(([t, d]) => d > 0 && tiles.names[t] && !used.has(tiles.names[t])).sort((x, y) => x[1] - y[1] || x[0] - y[0]);
  if (near.length) return tiles.names[near[0][0]];
  for (let k = 0; k < 20; k++) { const made = generateCityName(nationId, `${tile}|${k}`); if (!used.has(made)) return made; }
  return `${generateCityName(nationId, tile)} ${tile % 97}`;
};
