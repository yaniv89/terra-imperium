// src/engine/describeEffects.js
// Plan §M17: "One shared describeEffects(effects) -> [{ text, sign, tooltip }] used by the event
// option tooltips ... and the log" — this REPLACES EventModal.jsx's own local formatEffectItem/
// parseEffects, so every effect key applyEventEffects.js actually understands gets one canonical,
// tested description instead of a second hand-maintained label table that can silently drift out of
// sync with it (which is exactly what had happened here: formatEffectItem never knew about
// stability/legitimacy/prestige/victory even though applyEventEffects.js already applied them).
//
// Scope trim: ActionButton.jsx has its OWN local `formatEffect`, but for a completely different,
// non-overlapping vocabulary (`control`/`infrastructure`/`defense`/`unrest`/`hostilityReduction`/
// `custom` — domestic-action button subtext, not event options; note even "control" there and
// "controlBonus" here name conceptually similar but differently-keyed things). Folding that in too
// would mean either forking this function into two incompatible key sets or renaming every
// ActionButton call site's effect-hint keys across ~10 panel files for a purely cosmetic change —
// not an M17-sized edit, so it's deferred rather than force-fit here.
import { WORLD_NATIONS as NATIONS_DATA } from '../../data/worldNations';
import { PEOPLES } from '../../data/peoples';
import { REGIONS_DATA } from '../../data/regions';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { getLaw } from '../../data/laws';
import { formatMoney, formatNumber } from '../../utils/helpers';
import { t as tNow, getLanguage, isolateLtr, formatNumber as localNumber } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { buildingCategoryLabel, lawName } from '../../i18n/gameText';

// Display only (EventModal): it is rebuilt on a language change and never saved, so it lives with the
// components and may use the names helpers (src/engine may import only i18n/core.js).
const nationName = (id) => nameNow('nation', id, NATIONS_DATA[id]?.name || PEOPLES[id]?.name || id);
const regionName = (id) => nameNow('city', null, REGIONS_DATA[id]?.name || id);
const joinNations = (value) => (Array.isArray(value) ? value : [value]).map(nationName).join(', ');
const signed = (n) => isolateLtr(`${n >= 0 ? '+' : ''}${n}`);
// English keeps the game's compact numbers ("7.0K", "80g"); Hebrew writes plain grouped numbers.
const num = (v) => (getLanguage() === 'he' ? localNumber(v) : formatNumber(v));
const money = (v) => (getLanguage() === 'he' ? localNumber(v) : formatMoney(v));
const pm = (v, shown) => isolateLtr(`${v >= 0 ? '+' : '-'}${shown}`);
const t = (key, vars) => tNow(`de.${key}`, vars);
const sg = (v) => (v >= 0 ? 'positive' : 'negative');

// One entry describer per effect key. Each returns { text, sign, tooltip } or null to skip
// (used by the falsy-value guard in describeEffects below, and by keys with no player-facing
// meaning at all, like spawnFollowUp, an internal scheduling detail, not a consequence to preview).
const DESCRIBERS = {
  gold: (v) => ({ text: t('gold', { v: pm(v, money(Math.abs(v))) }), sign: sg(v) }),
  hr: (v) => ({ text: t('hr', { v: pm(v, num(Math.abs(v))) }), sign: sg(v) }),
  copper: (v) => ({ text: t('copper', { v: signed(v) }), sign: sg(v) }),
  iron: (v) => ({ text: t('iron', { v: signed(v) }), sign: sg(v) }),
  oil: (v) => ({ text: t('oil', { v: signed(v) }), sign: sg(v) }),
  rareMetals: (v) => ({ text: t('rareMetals', { v: signed(v) }), sign: sg(v) }),
  dip: (v) => ({ text: t('dip', { v: signed(v) }), sign: sg(v) }),
  techPoints: (v) => ({ text: t('techPoints', { v: signed(v) }), sign: sg(v) }),
  militaryStrengthBonus: (v) => ({ text: t('military', { v: signed(v) }), sign: sg(v) }),
  controlBonus: (v) => ({ text: t('control', { v: signed(v) }), sign: 'positive', tooltip: t('controlTip') }),
  cityUnrest: (v) => ({ text: t('cityUnrest', { v: signed(v) }), sign: v > 0 ? 'negative' : 'positive' }),
  cityFood: (v) => ({ text: t('cityFood', { v: signed(v) }), sign: sg(v) }),
  citySize: (v) => ({ text: t('citySize', { v: signed(v) }), sign: sg(v) }),
  cityLoyalty: (v) => ({ text: t('cityLoyalty', { v: signed(v) }), sign: sg(v) }),
  controlPenalty: (v) => ({ text: t('controlMinus', { v: isolateLtr(`-${v}`) }), sign: 'negative', tooltip: t('controlMinusTip') }),
  defenseBonus: (v) => ({ text: t('fort', { v: isolateLtr(`+${Math.max(1, Math.round(v * 20))}`) }), sign: 'positive', tooltip: t('fortTip') }),
  captureRegions: (v) => ({ text: t('capture', { places: v.map(regionName).join(', ') }), sign: 'positive' }),
  returnRegion: (v) => ({ text: t('return', { place: regionName(v) }), sign: 'negative' }),
  peaceWith: (v) => ({ text: t('peace', { who: joinNations(v) }), sign: 'positive' }),
  tradeWith: (v) => ({ text: t('trade', { who: joinNations(v) }), sign: 'positive' }),
  warWith: (v) => ({ text: t('war', { who: joinNations(v) }), sign: 'negative' }),
  nationHostility: (v) => {
    // Hostility itself is bad-when-high, so a POSITIVE delta (more hostile) is the negative outcome.
    const [nId, delta] = Object.entries(v)[0] || [];
    return { text: t('relations', { who: nationName(nId), v: signed(delta) }), sign: delta <= 0 ? 'positive' : 'negative' };
  },
  stability: (v) => ({ text: t('stability', { v: signed(v) }), sign: sg(v) }),
  legitimacy: (v) => ({ text: t('legitimacy', { v: signed(v) }), sign: sg(v) }),
  prestige: (v) => ({ text: t('prestige', { v: signed(v) }), sign: sg(v) }),
  victory: () => ({ text: t('victory'), sign: 'positive' }),
  addModifier: (v) => ({ text: t('modifier', { label: v.label || t('modifierDefault'), turns: v.duration }), sign: 'neutral' }),
  addClaim: (v) => ({ text: t('claim', { who: nationName(v) }), sign: 'neutral' }),
  spawnRebels: (v) => ({ text: t('unrestIn', { place: regionName(v.regionId) }), sign: 'negative' }),
  dev: (v) => ({ text: t('dev', { place: regionName(v.regionId), type: t(`dev.${v.type}`), v: signed(v.delta) }), sign: sg(v.delta) }),
  construct: (v) => ({ text: t('construct', { category: buildingCategoryLabel(v.category, BUILDING_CATEGORIES[v.category]?.label || v.category) }), sign: 'positive', tooltip: regionName(v.regionId) }),
  law: (v) => {
    const law = getLaw(v.category, v.lawId);
    return law ? { text: t('law', { law: lawName(law.id, law.name) }), sign: 'neutral' } : null;
  }
};

// Keys with no player-facing preview: internal scheduling (spawnFollowUp) or nothing meaningful
// to show. Listed explicitly so a future key that's forgotten here falls through to the generic
// String(value) fallback below instead of silently vanishing. estateLoyalty, crownLand and heir
// belonged to the removed estates and succession (master plan decision 37): an event saved before
// then may still carry them, and they now do nothing, so they show nothing.
const SILENT_KEYS = new Set(['spawnFollowUp', 'estateLoyalty', 'crownLand', 'heir']);

export const describeEffects = (effects) => {
  if (!effects) return [];
  const out = [];
  Object.entries(effects).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (SILENT_KEYS.has(key)) return;
    const describer = DESCRIBERS[key];
    const entry = describer ? describer(value) : { text: `${key}: ${String(value)}`, sign: 'neutral' };
    if (entry) out.push({ tooltip: null, ...entry });
  });
  return out;
};
