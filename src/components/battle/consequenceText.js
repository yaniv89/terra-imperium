// U25: the plain-English lines for engine/consequences.js, shared by the pre-battle card and the march bar.
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { consequencesOfTaking } from '../../engine/consequences';

/** [{ id: 'coalition' | 'loyalty', text }] for taking city `cityId`; empty when nothing follows. */
export const consequenceLines = (state, cityId) => {
  if (!cityId || !state.regions?.[cityId]) return [];
  const { coalition, loyalty } = consequencesOfTaking(state, cityId);
  const lines = [];
  if (coalition.length) {
    const names = coalition.map((id) => (state.nations[id] ? nameNow('people', id, state.nations[id].name) : id)).join(', ');
    lines.push({ id: 'coalition', text: t('bt.pre.coalition', { count: coalition.length, names }) });
  }
  if (loyalty?.breaksIn != null) lines.push({ id: 'loyalty', text: t('bt.pre.loyaltyBreaks', { count: loyalty.breaksIn }) });
  else if (loyalty && loyalty.target < 50) lines.push({ id: 'loyalty', text: t('bt.pre.loyaltyLow', { n: loyalty.target }) });
  return lines;
};
