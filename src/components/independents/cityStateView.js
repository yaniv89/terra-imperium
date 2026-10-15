// src/components/independents/cityStateView.js
// The city-state type of an independent for the UI (decision 42, UI18): its type, what its patron
// gets, and who that patron is. iconUrl is the type's badge (UI18 art, data/icons.js) and patronUrl
// the "they favour you" mark; while either is missing the badge draws the lucide placeholder (`icon`).
import { CITY_STATE_TYPES, cityStateTypeOf, patronBonusOf } from '../../data/cityStates';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { cityStateTypeName } from '../../i18n/gameText';
import { cityStateIconUrl, cityStatePatronIconUrl } from '../../data/icons';

/** { id, name, colour, icon, iconUrl, patronUrl, bonus, patron: 'you' | a name | null, line } or null for a major. */
export const cityStateViewOf = (state, nation, me = state?.playerNationId) => {
  const type = cityStateTypeOf(nation);
  if (!type) return null;
  const ct = CITY_STATE_TYPES[type];
  const patronId = nation.indep?.patron || null;
  const patron = !patronId ? null : patronId === me ? 'you' : (state.nations?.[patronId]?.name ? nameNow('people', patronId, state.nations[patronId].name) : patronId);
  const b = patronBonusOf(type, state?.age);
  const bonus = b.gold ? t('ind.cs.bonusGold', { n: b.gold }) : b.hr ? t('ind.cs.bonusHr', { n: b.hr }) : b.techPoints ? t('ind.cs.bonusTech', { n: b.techPoints }) : b.prestige ? t('ind.cs.bonusPrestige', { n: b.prestige }) : null;
  const line = !bonus ? t('ind.cs.noPatron')
    : t('ind.cs.patronGets', { bonus, who: patron === 'you' ? t('ind.cs.favourYou') : patron ? t('ind.cs.favourOther', { name: patron }) : t('ind.cs.favourNobody') });
  return {
    id: type, name: t('ind.cs.name', { type: cityStateTypeName(type, ct.name) }), colour: ct.badge, icon: ct.icon, iconUrl: cityStateIconUrl(type),
    patronUrl: patron === 'you' ? cityStatePatronIconUrl() : null, bonus, patron, line
  };
};
