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
import { WORLD_NATIONS as NATIONS_DATA } from '../data/worldNations';
import { REGIONS_DATA } from '../data/regions';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { getLaw } from '../data/laws';
import { TRAITS } from '../data/traits';
import { ESTATE_LABELS } from '../data/estates';
import { formatMoney, formatNumber } from '../utils/helpers';

const nationName = (id) => NATIONS_DATA[id]?.name || id;
const regionName = (id) => REGIONS_DATA[id]?.name || id;
const joinNations = (value) => (Array.isArray(value) ? value : [value]).map(nationName).join(', ');
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;

const DEV_TYPE_LABELS = { tax: 'Tax', production: 'Production', manpower: 'Manpower' };

// One entry describer per effect key. Each returns `{ text, sign, tooltip }` or null to skip
// (used by the falsy-value guard in describeEffects below, and by keys with no player-facing
// meaning at all, like spawnFollowUp — an internal scheduling detail, not a consequence to preview).
const DESCRIBERS = {
  gold: (v) => ({ text: `Gold ${v >= 0 ? '+' : '-'}${formatMoney(Math.abs(v))}`, sign: v >= 0 ? 'positive' : 'negative' }),
  hr: (v) => ({ text: `Manpower ${v >= 0 ? '+' : '-'}${formatNumber(Math.abs(v))}`, sign: v >= 0 ? 'positive' : 'negative' }),
  copper: (v) => ({ text: `Copper ${signed(v)}`, sign: v >= 0 ? 'positive' : 'negative' }),
  iron: (v) => ({ text: `Iron ${signed(v)}`, sign: v >= 0 ? 'positive' : 'negative' }),
  oil: (v) => ({ text: `Oil ${signed(v)}`, sign: v >= 0 ? 'positive' : 'negative' }),
  rareMetals: (v) => ({ text: `Rare Metals ${signed(v)}`, sign: v >= 0 ? 'positive' : 'negative' }),
  helium3: (v) => ({ text: `Helium-3 ${signed(v)}`, sign: v >= 0 ? 'positive' : 'negative' }),
  dip: (v) => ({ text: `DIP ${signed(v)}`, sign: v >= 0 ? 'positive' : 'negative' }),
  techPoints: (v) => ({ text: `Tech Points ${signed(v)}`, sign: v >= 0 ? 'positive' : 'negative' }),
  militaryStrengthBonus: (v) => ({ text: `Military ${signed(v)}`, sign: v >= 0 ? 'positive' : 'negative' }),
  controlBonus: (v) => ({ text: `Control ${signed(v)}%`, sign: 'positive', tooltip: 'Applies to every region you own' }),
  controlPenalty: (v) => ({ text: `Control -${v}%`, sign: 'negative', tooltip: 'Applies only to regions currently occupied by someone else' }),
  defenseBonus: (v) => ({ text: `Fort Level +${Math.max(1, Math.round(v * 20))}`, sign: 'positive', tooltip: 'A timed modifier on every region you own' }),
  captureRegions: (v) => ({ text: `Capture: ${v.map(regionName).join(', ')}`, sign: 'positive' }),
  returnRegion: (v) => ({ text: `Return: ${regionName(v)}`, sign: 'negative' }),
  peaceWith: (v) => ({ text: `Peace: ${joinNations(v)}`, sign: 'positive' }),
  tradeWith: (v) => ({ text: `Trade Pact: ${joinNations(v)}`, sign: 'positive' }),
  warWith: (v) => ({ text: `War: ${joinNations(v)}`, sign: 'negative' }),
  nationHostility: (v) => {
    // Hostility itself is bad-when-high, so a POSITIVE delta (more hostile) is the negative outcome.
    const [nId, delta] = Object.entries(v)[0] || [];
    return { text: `Relations (${nationName(nId)}) ${signed(delta)}`, sign: delta <= 0 ? 'positive' : 'negative' };
  },
  stability: (v) => ({ text: `Stability ${signed(v)}`, sign: v >= 0 ? 'positive' : 'negative' }),
  legitimacy: (v) => ({ text: `Legitimacy ${signed(v)}`, sign: v >= 0 ? 'positive' : 'negative' }),
  prestige: (v) => ({ text: `Prestige ${signed(v)}`, sign: v >= 0 ? 'positive' : 'negative' }),
  victory: () => ({ text: 'VICTORY', sign: 'positive' }),
  addModifier: (v) => ({ text: `${v.label || 'Modifier'} (${v.duration} turns)`, sign: 'neutral' }),
  estateLoyalty: (v) => {
    const [estateId, delta] = Object.entries(v)[0] || [];
    return { text: `${ESTATE_LABELS[estateId] || estateId} Loyalty ${signed(delta)}`, sign: delta >= 0 ? 'positive' : 'negative' };
  },
  addClaim: (v) => ({ text: `Claim: ${nationName(v)}`, sign: 'neutral' }),
  spawnRebels: (v) => ({ text: `Unrest in ${regionName(v.regionId)}`, sign: 'negative' }),
  ruler: (v) => {
    if (v.addTrait) return { text: `Ruler gains ${TRAITS[v.addTrait]?.name || v.addTrait}`, sign: 'positive' };
    if (v.removeTrait) return { text: `Ruler loses ${TRAITS[v.removeTrait]?.name || v.removeTrait}`, sign: 'negative' };
    return null;
  },
  heir: (v) => (v.claim ? { text: `Heir Claim ${signed(v.claim)}`, sign: v.claim >= 0 ? 'positive' : 'negative' } : null),
  dev: (v) => ({ text: `${regionName(v.regionId)} ${DEV_TYPE_LABELS[v.type] || v.type} ${signed(v.delta)}`, sign: v.delta >= 0 ? 'positive' : 'negative' }),
  construct: (v) => ({ text: `Free ${BUILDING_CATEGORIES[v.category]?.label || v.category} building`, sign: 'positive', tooltip: regionName(v.regionId) }),
  law: (v) => {
    const law = getLaw(v.category, v.lawId);
    return law ? { text: `Law: ${law.name}`, sign: 'neutral' } : null;
  },
  crownLand: (v) => ({ text: `Crown Land ${signed(v)}%`, sign: v >= 0 ? 'positive' : 'negative' })
};

// Keys with no player-facing preview: internal scheduling (spawnFollowUp) or nothing meaningful
// to show. Listed explicitly so a future key that's forgotten here falls through to the generic
// String(value) fallback below instead of silently vanishing.
const SILENT_KEYS = new Set(['spawnFollowUp']);

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
