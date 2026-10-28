// src/components/map/citySearch.js
// Find a city by name on the map (newcomer rerun steps 245 to 246: the magnifier only zoomed, and
// Shechem could not be found to march on). Only cities on land the player has explored; the name
// as shown in the reader's language, the record's own name too. Names that start with the query first.
import { isExplored } from '../../engine/fog';
import { nameNow } from '../../i18n/names';

export const findCities = (state, query, limit = 6) => {
  const q = String(query || '').trim().toLocaleLowerCase();
  if (!q) return [];
  return Object.values(state.regions || {})
    .filter((c) => c.tile != null && c.name && isExplored(state, c.tile))
    .map((c) => ({ id: c.id, name: nameNow('city', null, c.name), raw: String(c.name).toLocaleLowerCase(), mine: c.owner === state.playerNationId }))
    .map((r) => ({ ...r, at: Math.min(...[r.name.toLocaleLowerCase().indexOf(q), r.raw.indexOf(q)].map((i) => (i < 0 ? Infinity : i))) }))
    .filter((r) => r.at !== Infinity)
    .sort((a, b) => (a.at === 0 ? 0 : 1) - (b.at === 0 ? 0 : 1) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ id, name, mine }) => ({ id, name, mine }));
};
