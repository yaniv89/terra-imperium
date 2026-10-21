// Writes the ruler bust silhouettes (one white SVG per art theme) to src/assets/peoples/rulers/placeholder/.
// They are masks: rulerPortrait.js tints them with the people's colour. Real portraits (RU4) go to
// src/assets/peoples/rulers/<slug>.webp and win over these. Run: node scripts/ui/build-ruler-placeholders.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const BUST = 'M32 30c-7 0-12-5-12-12S25 6 32 6s12 5 12 12-5 12-12 12zm-24 34c0-14 10-24 24-24s24 10 24 24z';
// Headgear per theme, drawn above the head (y 0 to 12).
const HEAD = {
  nile: 'M22 14l10-14 10 14z', levant: 'M21 12h22l-3-8H24z', israelite: 'M21 12l4-8 7 5 7-5 4 8z',
  mesopotamia: 'M23 12V3h18v9h-4V6h-10v6z', maghreb: 'M19 14c0-8 6-12 13-12s13 4 13 12z', westafrica: 'M22 12c0-6 4-9 10-9s10 3 10 9z',
  eastafrica: 'M24 12V2h4v10zm12 0V2h4v10z', europe: 'M20 12l3-9 4 5 5-6 5 6 4-5 3 9z', steppe: 'M22 12c2-6 6-10 10-10s8 4 10 10z',
  indic: 'M32 0l5 12H27z', sinic: 'M18 9h28v3H18zm6-6h16v6H24z', korea: 'M20 10h24l-2-6H22z', japan: 'M24 12l8-10 8 10z',
  monsoon: 'M20 12c0-7 5-10 12-10s12 3 12 10z', pacific: 'M22 12l3-10 7 6 7-6 3 10z', americas: 'M20 12l4-10 4 6 4-8 4 8 4-6 4 10z'
};
const dir = new URL('../../src/assets/peoples/rulers/placeholder/', import.meta.url);
mkdirSync(dir, { recursive: true });
Object.entries(HEAD).forEach(([theme, hat]) => {
  writeFileSync(new URL(`${theme}.svg`, dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="#fff"><path d="${BUST}"/><path d="${hat}"/></g></svg>\n`);
});
