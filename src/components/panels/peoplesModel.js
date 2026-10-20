// src/components/panels/peoplesModel.js
// The Peoples screen (W07, plans/UI-DESIGN.md): the peoples you have met as a list, and the header
// counts. Pure. A row: the colour, the short people name and the full title, the relation as one
// word (war, pact, trade, peace or met), the opinion of you, when you met them and how many of
// their cities your scouts have seen. War first, then by opinion (worst first: they matter most).
import { PEOPLES } from '../../data/peoples';
import { isIndependentNation } from '../../data/independents';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { hasMet, isExplored, fogOn } from '../../engine/fog';
import { opinionOf } from '../../engine/opinion';
import { t as tNow } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { ageOf } from '../../engine/nationState';
import { ageVersusPlayer } from '../ui/ageProgress';
import { shortAge } from './researchSheetModel';

// The words are read when asked, so they follow the language (keys p2.rel.<relation>).
export const RELATION_LABEL = Object.defineProperties({}, Object.fromEntries(
  ['war', 'pact', 'trade', 'peace', 'vassal', 'met'].map((k) => [k, { enumerable: true, get: () => tNow(`p2.rel.${k}`) }])
));

export const relationOf = (state, n) => {
  if (isAtWarWithPlayer(state, n.id)) return 'war';
  if (n.vassalOf === state.playerNationId) return 'vassal';
  if (n.hasMilitaryPact) return 'pact';
  if (n.hasTradeAgreement) return 'trade';
  if (n.hasPeaceTreaty) return 'peace';
  return 'met';
};

export const peoplesModel = (state, search = '') => {
  const me = state.playerNationId;
  const q = search.trim().toLowerCase();
  const others = Object.values(state.nations || {}).filter((n) => n.id !== me && !n.isPlayer && !isIndependentNation(n));
  const known = others.filter((n) => hasMet(state, me, n.id) || isAtWarWithPlayer(state, n.id));
  const cityCount = {};
  Object.values(state.regions || {}).forEach((c) => { if (c.owner && c.owner !== me && isExplored(state, c.tile)) cityCount[c.owner] = (cityCount[c.owner] || 0) + 1; });
  const rows = known.map((n) => ({
    id: n.id,
    name: nameNow('people', n.id, PEOPLES[n.id]?.name || n.name),
    title: nameNow('people', n.id, n.name),
    nameEn: PEOPLES[n.id]?.name || n.name,
    titleEn: n.name,
    color: n.color || '#EE8A3A',
    relation: relationOf(state, n),
    // the people's own age (never a world age) and how it stands against yours
    ageId: ageOf(state, n.id),
    ageName: shortAge(ageOf(state, n.id)),
    ageVsYou: ageVersusPlayer(state, n.id),
    opinion: opinionOf(state, n.id),
    metTurn: fogOn(state) ? state.fog?.met?.[me]?.[n.id] ?? null : null,
    citiesSeen: cityCount[n.id] || 0,
    eliminated: !!n.isEliminated
  }));
  const shown = rows
    .filter((r) => !q || [r.name, r.title, r.nameEn, r.titleEn].some((x) => x.toLowerCase().includes(q)))
    .sort((a, b) => ((b.relation === 'war') - (a.relation === 'war')) || (a.eliminated - b.eliminated) || (a.opinion - b.opinion) || a.nameEn.localeCompare(b.nameEn));
  return {
    rows: shown,
    counts: {
      met: rows.filter((r) => !r.eliminated).length,
      war: rows.filter((r) => r.relation === 'war').length,
      pact: rows.filter((r) => r.relation === 'pact').length,
      trade: rows.filter((r) => r.relation === 'trade' || (r.relation === 'pact' && state.nations[r.id]?.hasTradeAgreement)).length,
      unmet: others.filter((n) => !n.isEliminated && !hasMet(state, me, n.id)).length
    }
  };
};
