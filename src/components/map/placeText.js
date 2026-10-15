// src/components/map/placeText.js
// Where a tile is, in words, in the current language (the march bar, the army sheet). The engine
// keeps its own English (routes.js placeName, unitLocation.js whereLabel) for the log it saves; this
// reads the same facts and writes them with t() and name().
import { getTiles } from '../../data/geo/tiles';
import { whereLabel } from '../../engine/unitLocation';
import { t as tNow } from '../../i18n';
import { nameNow } from '../../i18n/names';

/** "at Men-nefer", "in the land of Siwa", "near Siwa", "at sea", "in open country". */
export const whereText = (state, tile) => {
  const w = whereLabel(state, tile);
  const city = w.cityId != null ? state.regions[w.cityId] : null;
  const cityName = city ? nameNow('city', null, city.name) : '';
  switch (w.kind) {
    case 'city': return tNow('where.at', { name: cityName });
    case 'named': return tNow('where.at', { name: nameNow('place', null, w.name) });
    case 'land': return tNow('where.landOf', { name: cityName });
    case 'near': return tNow('where.near', { name: cityName });
    case 'sea': return w.name === 'sea' ? tNow('where.atSea') : tNow('where.inPlace', { name: nameNow('place', null, w.name) });
    default: return w.name === 'the field' ? tNow('where.field') : tNow('where.open');
  }
};

/** A march target: the city, the named place, "the land of Siwa", the river, open country. */
export const placeLabel = (state, tile) => {
  const tiles = getTiles();
  const city = state.regions[state.world?.tileOwner?.[tile]];
  if (city?.tile === tile) return nameNow('city', null, city.name);
  if (tiles.names[tile]) return nameNow('place', null, tiles.names[tile]);
  if (city) return tNow('place.landOf', { name: nameNow('city', null, city.name) });
  return tiles.rivers[tile] ? (tiles.riverNames[tile] ? tNow('place.river', { name: nameNow('place', null, tiles.riverNames[tile]) }) : tNow('place.riverPlain')) : tNow('place.open');
};
