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

export const RELATION_LABEL = { war: 'War', pact: 'Pact', trade: 'Trade', peace: 'Peace', vassal: 'Vassal', met: 'Met' };

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
    name: PEOPLES[n.id]?.name || n.name,
    title: n.name,
    color: n.color || '#EE8A3A',
    relation: relationOf(state, n),
    opinion: opinionOf(state, n.id),
    metTurn: fogOn(state) ? state.fog?.met?.[me]?.[n.id] ?? null : null,
    citiesSeen: cityCount[n.id] || 0,
    eliminated: !!n.isEliminated
  }));
  const shown = rows
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.title.toLowerCase().includes(q))
    .sort((a, b) => ((b.relation === 'war') - (a.relation === 'war')) || (a.eliminated - b.eliminated) || (a.opinion - b.opinion) || a.name.localeCompare(b.name));
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
