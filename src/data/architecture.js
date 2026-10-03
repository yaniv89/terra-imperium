// src/data/architecture.js
// The architecture regions of the art spec (plans/art-image-spec.md, section 3b.2): every city is
// drawn in the building style of the land it stands on (the tile's modern country), whoever owns
// it, so a conquered city keeps its roofs and streets. Each style has a kit per age; until a kit
// is built the age's base towns stand in.
export const STYLE_NATIONS = {
  nile: ['dj', 'eg', 'er', 'et', 'sd', 'so', 'ss', 'xs'], // Nile and Horn
  levant: ['ae', 'af', 'am', 'az', 'bh', 'cy', 'ge', 'il', 'iq', 'ir', 'jo', 'kw', 'lb', 'om', 'ps', 'qa', 'sa', 'sy', 'tr', 'xn', 'ye'], // Levant, Mesopotamia, Arabia, Persia
  maghreb: ['bf', 'dz', 'eh', 'gm', 'gw', 'ly', 'ma', 'ml', 'mr', 'ne', 'sn', 'td', 'tn'], // Maghreb and the Sahel
  westafrica: ['ao', 'bj', 'cd', 'cf', 'cg', 'ci', 'cm', 'cv', 'ga', 'gh', 'gn', 'gq', 'lr', 'ng', 'sl', 'st', 'tg'], // West and Central African forest and savanna
  eastafrica: ['bi', 'bw', 'ke', 'km', 'ls', 'mg', 'mu', 'mw', 'mz', 'na', 'rw', 'sc', 'sh', 'sz', 'tz', 'ug', 'za', 'zm', 'zw'], // East and Southern Africa
  europe: ['ad', 'al', 'at', 'au', 'ax', 'ba', 'be', 'bg', 'bm', 'by', 'ca', 'ch', 'cz', 'de', 'dk', 'ee', 'es', 'fi', 'fk', 'fo', 'fr', 'gb', 'gg', 'gi', 'gl', 'gr', 'gs', 'hm', 'hr', 'hu', 'ie', 'im', 'is', 'it', 'je', 'li', 'lt', 'lu', 'lv', 'mc', 'md', 'me', 'mk', 'mt', 'nf', 'nl', 'no', 'nz', 'pl', 'pm', 'pn', 'pt', 'ro', 'rs', 'ru', 'se', 'si', 'sk', 'sm', 'tf', 'ua', 'us', 'va', 'xk'], // Europe, Russia, the Caucasus north, the Americas of European settlement
  steppe: ['bt', 'kg', 'kz', 'mn', 'np', 'tj', 'tm', 'uz'], // Central Asian steppe and plateau
  indic: ['bd', 'in', 'lk', 'mv', 'pk'], // South Asia
  sinic: ['cn', 'hk', 'jp', 'kp', 'kr', 'mo', 'tw'], // East Asia
  monsoon: ['as', 'bn', 'ck', 'fj', 'fm', 'gu', 'id', 'kh', 'ki', 'la', 'mh', 'mm', 'mp', 'my', 'nc', 'nr', 'nu', 'pf', 'pg', 'ph', 'pw', 'sb', 'sg', 'th', 'tl', 'to', 'tv', 'vn', 'vu', 'wf', 'ws'], // Southeast Asia and the Pacific
  americas: ['ag', 'ai', 'ar', 'aw', 'bb', 'bl', 'bo', 'br', 'bs', 'bz', 'cl', 'co', 'cr', 'cu', 'cw', 'dm', 'do', 'ec', 'gd', 'gt', 'gy', 'hn', 'ht', 'jm', 'kn', 'ky', 'lc', 'mf', 'ms', 'mx', 'ni', 'pa', 'pe', 'pr', 'py', 'sr', 'sv', 'sx', 'tc', 'tt', 'uy', 'vc', 've', 'vg', 'vi'], // Mesoamerica, the Andes, the Caribbean, Amazonia
};

const BY_NATION = {};
Object.entries(STYLE_NATIONS).forEach(([style, ids]) => ids.forEach((id) => { BY_NATION[id] ||= style; }));

/** The architecture style of a nation's land ('europe', 'nile', ...), or null. */
export const styleOfNation = (nationId) => (nationId && BY_NATION[nationId]) || null;

// The lands of European settlement build in the European manner only from the Gunpowder Age on;
// before that they show the land's own kit (section 3b.2).
const BEFORE_SETTLEMENT = { us: 'americas', ca: 'americas', bm: 'americas', pm: 'americas', gl: 'americas', fk: 'americas', gs: 'americas', au: 'monsoon', nz: 'monsoon', nf: 'monsoon', pn: 'monsoon', hm: 'monsoon', tf: 'monsoon' };
const EARLY_AGES = new Set(['bronze', 'classical', 'kingdoms']);
// From the Kingdoms Age the Orthodox east of Europe builds its own churches (onion domes): a
// sub-style that falls back to 'europe' wherever it has no model of its own.
const EAST_EUROPE = new Set(['ru', 'ua', 'by', 'md', 'ro', 'bg', 'rs', 'mk', 'me']);
const BEFORE_EAST = new Set(['bronze', 'classical']);
// From the Gunpowder Age the lands of European settlement build the colonial variant of the
// European kit (a clapboard church), falling back to Europe as well.
const COLONIES = new Set(['us', 'ca', 'au', 'nz', 'bm', 'pm', 'gl', 'fk', 'gs', 'nf', 'pn', 'hm', 'tf']);
export const STYLE_FALLBACK = { easteurope: 'europe', colonies: 'europe' };
/** The style a city on this nation's land is drawn in, in this age. */
export const styleOfLand = (nationId, ageId) => {
  if (EARLY_AGES.has(ageId) && BEFORE_SETTLEMENT[nationId]) return BEFORE_SETTLEMENT[nationId];
  if (EAST_EUROPE.has(nationId) && !BEFORE_EAST.has(ageId)) return 'easteurope';
  if (COLONIES.has(nationId)) return 'colonies';
  return styleOfNation(nationId);
};
/** A style and the styles it falls back to, most specific first: ['easteurope', 'europe']. */
export const styleChain = (style) => {
  const out = [];
  for (let s = style; s && !out.includes(s); s = STYLE_FALLBACK[s]) out.push(s);
  return out;
};
