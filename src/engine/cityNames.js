// src/engine/cityNames.js
// A name for a city a settler founds (plans/playtest-1.md P5.1). The tile's own name first (a
// real town stood there), then the nearest named tile within CITY_NAME_RINGS not yet used by a
// city, then a name made from the founder's culture group: two halves of two given names of the
// group (names.js), joined, so a Greek settler founds "Alexos" and a Slavic one "Bogoslav".
// Deterministic: the made name comes from a hash of the nation and the tile, no RNG.
import { ringsAround } from './world/cities';
import { generateGivenName } from '../data/names';
import { createRng } from '../utils/rng';

export const CITY_NAME_RINGS = 3;

const hash = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const half = (name, first) => { const n = name.length; const cut = Math.max(2, Math.round(n / 2)); return first ? name.slice(0, cut) : name.slice(n - cut).toLowerCase(); };

/** A made-up name in the nation's culture (deterministic in the seed). */
export const generateCityName = (nationId, seed) => {
  const rng = createRng(hash(`${nationId}|city|${seed}`));
  const a = generateGivenName(nationId, rng); const b = generateGivenName(nationId, rng);
  const name = half(a, true) + half(b, false);
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/(.)\1\1/g, '$1$1');
};

/** The name a new city on `tile` takes. `regions` is the cities map (names in use). */
export const pickCityName = (regions, tiles, tile, nationId) => {
  const used = new Set(Object.values(regions || {}).map((c) => c?.name).filter(Boolean));
  const own = tiles.names[tile];
  if (own && !used.has(own)) return own;
  const rings = ringsAround(tiles, tile, CITY_NAME_RINGS);
  const near = [...rings.entries()].filter(([t, d]) => d > 0 && tiles.names[t] && !used.has(tiles.names[t])).sort((x, y) => x[1] - y[1] || x[0] - y[0]);
  if (near.length) return tiles.names[near[0][0]];
  for (let k = 0; k < 20; k++) { const made = generateCityName(nationId, `${tile}|${k}`); if (!used.has(made)) return made; }
  return `${generateCityName(nationId, tile)} ${tile % 97}`;
};
