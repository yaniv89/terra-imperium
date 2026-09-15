// src/components/globe/nationCountryMap.js
// Cosmetic-only mapping from the current game's nation ids (src/data/nations.js) to the new
// world country-tier ids (src/data/geo/countries-meta.json), so the Phase 12 globe can highlight
// the familiar Middle East conflict in the same colors as the flat map while the rest of the
// world renders as neutral backdrop. This is NOT the Phase 13 canonical world-game mapping —
// once regions/nations are rebuilt on top of the real world data, this file goes away.
import { NATIONS_DATA } from '../../data/nations';

export const NATION_TO_COUNTRY_ID = {
  player: 'il',
  egypt: 'eg',
  jordan: 'jo',
  syria: 'sy',
  lebanon: 'lb',
  iraq: 'iq',
  saudi: 'sa',
  iran: 'ir',
  turkey: 'tr',
  yemen: 'ye',
  oman: 'om',
  uae: 'ae',
  qatar: 'qa',
  bahrain: 'bh',
  kuwait: 'kw'
  // hamas has no sovereign territory of its own in the country tier — left uncolored.
};

// countryId -> hex color, built once from the existing NATIONS_DATA palette.
export const COUNTRY_HIGHLIGHT_COLORS = Object.fromEntries(
  Object.entries(NATION_TO_COUNTRY_ID).map(([nationId, countryId]) => [countryId, NATIONS_DATA[nationId].color])
);
