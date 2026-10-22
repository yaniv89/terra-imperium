// src/engine/battleThreshold.js
// Whether a battle screen opens (differentiation plan U18, KTD9). A small unwalled town or an
// outpost with nobody standing in it falls on Auto: the same resolveAutoBattle and
// applyBattleOutcome a fought battle uses, so the report and the capture card are the same. Any
// Defense-line tier counts as walls, and any defender on the tile opens the card.
// `battleSettings.smallTowns` ('auto' default, 'ask' restores the card) is for the player's
// attacks; `smallTownDefense` ('ask' default, 'auto') is for the player's own towns under attack.
import { sideAgeOf } from './ageRefs';

/** Largest town size, by the defender's age, that counts as small: at most the age's median city size in a 300-turn peoples run (medians 3, 3, 4, 6; modern not reached, extrapolated). Rome II's rule: a full assault only for walled cities, capitals and larger cities (the battle-length report). */
export const SMALL_TOWN_SIZE = { stone: 3, bronze: 3, classical: 3, kingdoms: 4, gunpowder: 5, modern: 5, information: 5, future: 5 };
const SMALL_DEFAULT = 2;

/** Is this city small and open: an outpost, or a size at or below the age's limit with no Defense-line tier and not a capital? */
export const isSmallOpenTown = (state, city) => {
  if (!city) return false;
  if (city.outpost) return true;
  if (city.isCapital) return false;
  if ((city.buildings?.categories?.defense ?? -1) >= 0) return false;
  return (city.size || 1) <= (SMALL_TOWN_SIZE[sideAgeOf(state, city.owner)] ?? SMALL_DEFAULT);
};

/** The player chose "Auto until the siege ends" for this city and that siege still stands (`state.autoSieges[id]` is the siege's startedTurn, so a later siege asks again). */
export const autoSiegeOn = (state, regionId) => {
  const siege = state.regions?.[regionId]?.siege;
  return !!siege && state.autoSieges?.[regionId] === siege.startedTurn;
};

/**
 * Does the attack on `targetRegionId` open a battle screen? False for a small open town nobody
 * defends, unless the setting asks. `byPlayer` picks smallTowns (own attacks) or smallTownDefense.
 */
export const battleRequired = (state, targetRegionId, { byPlayer = true } = {}) => {
  if (autoSiegeOn(state, targetRegionId)) return false;
  const mode = byPlayer ? state.battleSettings?.smallTowns : state.battleSettings?.smallTownDefense;
  if ((mode ?? (byPlayer ? 'auto' : 'ask')) !== 'auto') return true;
  const city = state.regions?.[targetRegionId];
  if (!isSmallOpenTown(state, city)) return true;
  return Object.values(state.units || {}).some((u) => u.regionId === targetRegionId && u.domain === 'land' && u.classId !== 'settler' && u.ownerId === city.owner);
};
