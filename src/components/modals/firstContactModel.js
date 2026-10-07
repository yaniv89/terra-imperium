// src/components/modals/firstContactModel.js
// The first-contact card (W03, plans/UI-DESIGN.md): which peoples the player met since the last
// look, and what the card says about one of them: its title and colour, its capital, the mood
// (opinion of you, with its word), how many of its cities your scouts have seen, and how many
// tiles of border you share. Independents are met by sight and get no card (they have their own
// sheet, phase W4). Pure.
import { getTiles } from '../../data/geo/tiles';
import { metNations, isExplored, fogOn } from '../../engine/fog';
import { isIndependentNation } from '../../data/independents';
import { opinionOf } from '../../engine/opinion';
import { PEOPLES } from '../../data/peoples';

/** The opinion as a word, the same bands as the diplomacy screen's colours. */
export const moodWord = (opinion) => (opinion >= 40 ? 'Friendly' : opinion >= 20 ? 'Warm' : opinion > -20 ? 'Wary' : opinion > -40 ? 'Cold' : 'Hostile');

/** Peoples met now that were not in `before` (a Set of ids), majors only, in id order. */
export const newContacts = (state, before) => {
  if (!fogOn(state)) return [];
  return metNations(state).filter((id) => !before.has(id) && id !== state.playerNationId && state.nations[id] && !state.nations[id].isEliminated && !isIndependentNation(state.nations[id]));
};

export const contactCard = (state, nationId) => {
  const n = state.nations[nationId];
  if (!n) return null;
  const me = state.playerNationId;
  const tiles = getTiles();
  const theirs = Object.values(state.regions || {}).filter((c) => c.owner === nationId && c.tile != null);
  const capital = state.regions?.[n.capitalRegionId];
  const tileOwner = state.world?.tileOwner || {};
  const ownerOf = (t) => (tileOwner[t] != null ? state.regions?.[tileOwner[t]]?.owner : null);
  let border = 0;
  Object.keys(tileOwner).forEach((k) => {
    const t = Number(k);
    if (ownerOf(t) !== me) return;
    if ((tiles.neighbors[t] || []).some((x) => ownerOf(x) === nationId)) border += 1;
  });
  const opinion = opinionOf(state, nationId);
  return {
    id: nationId,
    title: n.name,
    name: PEOPLES[nationId]?.name || n.name,
    color: n.color || '#EE8A3A',
    capital: capital?.name || null,
    capitalSeen: !!capital && isExplored(state, capital.tile),
    citiesSeen: theirs.filter((c) => isExplored(state, c.tile)).length,
    border,
    opinion,
    mood: moodWord(opinion)
  };
};
