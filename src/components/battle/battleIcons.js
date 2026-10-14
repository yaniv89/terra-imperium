// src/components/battle/battleIcons.js
// I186 (addendum X14): the build sheet's pictures were `loading="lazy"` with nothing fetching them
// first, so the sheet opened blank once. The battle screen asks for every picture it may show (the
// buildings of the side's age, the four stocks, the battle glyphs) as it opens; the browser keeps
// them, and GameIcon shows its glyph for any that still fails.
import { iconUrl, BATTLE_STOCK_ICON_IDS, BATTLE_GLYPH_IDS } from '../../data/icons';
import { BUILDINGS, buildableFor } from '../../battle/data/economy';

/** The icon URLs a battle of `ageId` may show at once (tests read it). */
export const battleIconUrls = (ageId = 'bronze') => [
  ...buildableFor(ageId).map((id) => iconUrl('battle', BUILDINGS[id].icon)),
  ...Object.values(BATTLE_STOCK_ICON_IDS).map((id) => iconUrl('battle', id)),
  ...BATTLE_GLYPH_IDS.map((id) => iconUrl('battle', id))
].filter(Boolean);

const asked = new Set();
/** Start loading the battle's pictures (once per URL per page). */
export const preloadBattleIcons = (ageId) => {
  if (typeof Image === 'undefined') return 0;
  let n = 0;
  battleIconUrls(ageId).forEach((url) => {
    if (asked.has(url)) return;
    asked.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    n += 1;
  });
  return n;
};
