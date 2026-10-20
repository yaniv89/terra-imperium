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
import { t as tNow } from '../../i18n/core';
import { nameNow } from '../../i18n/names';

/** The opinion as a word, the same bands as the diplomacy screen's colours. */
export const moodWord = (opinion) => (opinion >= 40 ? 'Friendly' : opinion >= 20 ? 'Warm' : opinion > -20 ? 'Wary' : opinion > -40 ? 'Cold' : 'Hostile');

/** Peoples met now that were not in `before` (a Set of ids), majors only, in id order. */
export const newContacts = (state, before) => {
  if (!fogOn(state)) return [];
  return metNations(state).filter((id) => !before.has(id) && id !== state.playerNationId && state.nations[id] && !state.nations[id].isEliminated && !isIndependentNation(state.nations[id]));
};

/**
 * The queue of cards waiting, as [{ id, turn }] (the turn the contact was seen). A card is for the
 * turn of contact plus one turn of grace: one still waiting after that is dropped, not shown 4 to 27 turns late and
 * stacked behind others (mobile audit H-21). `fresh` are the ids met just now.
 */
export const contactQueue = (queue, fresh, turn) => {
  const kept = queue.filter((c) => c.turn + 1 >= turn);
  return [...kept, ...fresh.filter((id) => !kept.some((c) => c.id === id)).map((id) => ({ id, turn }))];
};

/** How the meeting happened, in words that depend on who saw whom (no invented scouts). */
export const contactHow = ({ youSaw, theySaw, capitalSeen, capital }) => {
  const seen = capitalSeen && capital ? tNow('p2.fc.seenCapital', { capital }) : capital ? tNow('p2.fc.theirCapital', { capital }) : '';
  if (youSaw && theySaw) return tNow('p2.fc.mutual', { seen }).trim();
  if (theySaw && !youSaw) return tNow('p2.fc.theySaw');
  if (youSaw) return capitalSeen && capital ? tNow('p2.fc.cameUponCapital', { capital }) : tNow('p2.fc.cameUponLand', { tail: capital ? tNow('p2.fc.landTail', { capital }) : '' });
  return tNow('p2.fc.word');
};

export const contactCard =(state, nationId) => {
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
  const citiesSeen = theirs.filter((c) => isExplored(state, c.tile)).length;
  const capitalSeen = !!capital && isExplored(state, capital.tile);
  // Who saw whom (I118): meeting is mutual, so the card says what happened, not "your scouts".
  const youSaw = capitalSeen || citiesSeen > 0 || border > 0;
  const theySaw = Object.values(state.regions || {}).some((c) => c.owner === me && c.tile != null && isExplored(state, c.tile, nationId));
  return {
    id: nationId,
    title: nameNow('people', nationId, n.name),
    name: nameNow('people', nationId, PEOPLES[nationId]?.name || n.name),
    color: n.color || '#EE8A3A',
    capital: capital?.name ? nameNow('city', null, capital.name) : null,
    capitalSeen,
    citiesSeen,
    border,
    youSaw,
    theySaw,
    how: contactHow({ youSaw, theySaw, capitalSeen, capital: capital?.name ? nameNow('city', null, capital.name) : null }),
    opinion,
    mood: moodWord(opinion),
    moodText: tNow(`p2.mood.${moodWord(opinion)}`)
  };
};
