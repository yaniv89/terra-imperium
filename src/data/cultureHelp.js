// src/data/cultureHelp.js
// One plain explanation of culture points for the culture sheet. Culture is not a decree or a
// resource: it is a per-city bank that buys border tiles. No number is typed here: every figure
// comes from the same constants the engine reads.
import { CULTURE_BASE, CULTURE_PER_SIZE, CULTURE_PER_TIER } from '../engine/world/cities';
import { t as tNow } from '../i18n/core';

// The texts are getters: they read the current language each time they are used.
export const CULTURE_HELP = {
  get earns() { return tNow('culture.earns', { base: CULTURE_BASE, size: CULTURE_PER_SIZE, tier: CULTURE_PER_TIER }); },
  get spends() { return tNow('culture.spends'); }
};
