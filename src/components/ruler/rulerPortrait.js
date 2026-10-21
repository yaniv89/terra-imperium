// src/components/ruler/rulerPortrait.js
// A ruler's portrait (RULER-PLAN 2.2, differentiation plan U15). Hook for the art (RU4): drop
// src/assets/peoples/rulers/<slug>.webp and it wins. Until then a bust silhouette per art theme
// (scripts/ui/build-ruler-placeholders.mjs) that the sheet tints with the people's colour.
import { PEOPLES } from '../../data/peoples';

const urls = (glob) => Object.fromEntries(Object.entries(glob).map(([path, url]) => [path.replace(/^.*\/([^/]+)\.[a-z]+$/, '$1'), url]));
const ART = urls(import.meta.glob('../../assets/peoples/rulers/*.webp', { query: '?url', import: 'default', eager: true }));
const BUSTS = urls(import.meta.glob('../../assets/peoples/rulers/placeholder/*.svg', { query: '?url', import: 'default', eager: true }));
const FALLBACK_THEME = 'europe'; // the legacy 240-country world has no art theme

/** { art } a finished portrait, else { bust } the placeholder mask; plus the initial for its plinth. */
export const rulerPortrait = (nationId, name = '') => {
  const theme = PEOPLES[nationId]?.theme;
  const art = ART[nationId] || null;
  return { art, bust: art ? null : BUSTS[theme] || BUSTS[FALLBACK_THEME], initial: String(name).trim().charAt(0).toUpperCase() };
};
