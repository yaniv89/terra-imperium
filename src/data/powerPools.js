// src/data/powerPools.js
// One plain explanation each for the three power pools and for culture (playtest audit I018 / I034,
// "explain ADM / DIP / MIL and culture points where they are shown"). Read by the resource bar
// tooltips, the ruler card, the advisor cards and the culture sheet, so the wording lives in one
// place. No number is typed here: every figure comes from the same constants the engine reads.
import { CULTURE_BASE, CULTURE_PER_SIZE, CULTURE_PER_TIER } from '../engine/world/cities';
import { t as tNow } from '../i18n/core';

// The texts are getters: they read the current language each time they are used.
const pool = (id) => ({
  get name() { return tNow(`pool.${id}.name`); },
  get short() { return tNow(`pool.${id}.short`); },
  get spends() { return tNow(`pool.${id}.spends`); }
});
export const POWER_POOL_HELP = { adm: pool('adm'), dip: pool('dip'), mil: pool('mil') };

export const powerPoolsShort = () => tNow('pool.short');

// Culture is not a power point: it is a per-city bank that buys border tiles.
export const CULTURE_HELP = {
  get earns() { return tNow('culture.earns', { base: CULTURE_BASE, size: CULTURE_PER_SIZE, tier: CULTURE_PER_TIER }); },
  get spends() { return tNow('culture.spends'); }
};
