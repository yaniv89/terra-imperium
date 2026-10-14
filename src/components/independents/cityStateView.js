// src/components/independents/cityStateView.js
// The city-state type of an independent for the UI (decision 42, UI18): its type, what its patron
// gets, and who that patron is. The icons are placeholders from the lucide set until the UI18 art
// lands (one badge per type: trade, military, science, culture, raiders).
import { CITY_STATE_TYPES, cityStateTypeOf, patronBonusText } from '../../data/cityStates';

/** { id, name, colour, icon, bonus, patron: 'you' | a name | null, line } or null for a major. */
export const cityStateViewOf = (state, nation, me = state?.playerNationId) => {
  const type = cityStateTypeOf(nation);
  if (!type) return null;
  const t = CITY_STATE_TYPES[type];
  const patronId = nation.indep?.patron || null;
  const patron = !patronId ? null : patronId === me ? 'you' : (state.nations?.[patronId]?.name || patronId);
  const bonus = patronBonusText(type, state?.age);
  const line = !bonus ? 'Raiders: no patron, they live by raiding'
    : `Its patron gets ${bonus}. ${patron === 'you' ? 'They favour you.' : patron ? `They favour ${patron}.` : 'They favour nobody yet: a good attitude (gifts help) makes you their patron.'}`;
  return { id: type, name: `${t.name} city-state`, colour: t.badge, icon: t.icon, bonus, patron, line };
};
