// src/components/panels/opinionText.js
// One opinion reason (engine/opinion.js row: { id, label, value, detail }) in the current language.
// The engine keeps the English label and detail; the labels are keyed by the row's id (nc.* / op.*),
// the details are re-read from their English shapes ("3 tiles touch", "hostility 40").
import { t, hasKey } from '../../i18n/core';
import { nameNow } from '../../i18n/names';

const DETAIL_SHAPES = [
  [/^(\d+) tiles touch$/, (m) => t('op.d.tilesTouch', { n: m[1] })],
  [/^(\d+) cit(?:y|ies)$/, (m) => t('op.d.cities', { count: Number(m[1]) })],
  [/^hostility (-?\d+)$/, (m) => t('op.d.hostility', { n: m[1] })],
  [/^(\d+) AE$/, (m) => t('op.d.ae', { n: m[1] })],
  [/^since turn (\d+)$/, (m) => t('op.d.sinceTurn', { n: m[1] })],
  [/^until turn (\d+)$/, (m) => t('op.d.untilTurn', { n: m[1] })]
];

/** The label of an opinion row. `baseline` is shown as the breakdown's "Starting point for strangers". */
export const opinionLabel = (r, strangers = false) => {
  if (r.id === 'baseline') return t(strangers ? 'op.baselineStrangers' : 'op.baseline');
  if (r.id === 'tradeLaw') return t(r.value > 0 ? 'op.tradeLawPlus' : 'op.tradeLawMinus');
  if (r.id === 'metDemand') return t(/tribute/i.test(r.label) ? 'op.metDemandTribute' : 'op.metDemandYield');
  if (r.id === 'sharedMaps') return t(/Gave/.test(r.label) ? 'op.sharedMapsGave' : 'op.sharedMapsSwap');
  return hasKey(`op.${r.id}`, 'en') ? t(`op.${r.id}`) : r.label;
};

/** The detail of an opinion row, or ''. */
export const opinionDetail = (r) => {
  if (!r.detail) return '';
  if (r.id === 'claim') return String(r.detail).split(', ').map((n) => nameNow('city', null, n)).join(', ');
  for (const [re, make] of DETAIL_SHAPES) { const m = re.exec(r.detail); if (m) return make(m); }
  return String(r.detail);
};
