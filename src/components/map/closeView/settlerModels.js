// src/components/map/closeView/settlerModels.js
// The settler party in the close view (art items units/settler-<age>, MD01): settlers on their tile
// are drawn as their owner's age band's party (src/assets/units/<age>-settler.glb, unitModels.js
// findSettlerModel: an ox cart, a covered wagon or a small truck with the family walking), through
// the soldier layer like an army, in place of the wagon disc the far map keeps. Until the file is
// in (or without one) the disc stays in the close view too.
import { findSettlerModel, preloadSettlerModel, SETTLER_KEY } from '../../../battle/render/unitModels';
import { hasSoldierOverride } from '../../../battle/render/soldierFactory';
import { isSettler } from '../../../engine/settlers';
import { getEffectiveAgeId } from '../../../data/ages';

export { SETTLER_KEY, preloadSettlerModel };

/** The age band whose settler model this age draws, or null (no file). */
export const settlerBand = (ageId, find) => findSettlerModel(ageId, find)?.ageId || null;

/** Whether the close view draws this age's settler party now (its model is registered). */
export const settlerModelReady = (ageId, { find, has = hasSoldierOverride } = {}) => {
  const band = settlerBand(ageId, find);
  return !!band && has(band, SETTLER_KEY);
};

/** A nation's age as the close view draws it (the player's tech age, others' own). */
export const ownerAge = (state, nationId) => (nationId === state.playerNationId
  ? getEffectiveAgeId(state.age, state.techAgeId)
  : getEffectiveAgeId(state.age, state.nations?.[nationId]?.tech?.ageId));

/** For the map's sprites: (unit) => whether the close view draws that settler's party now. */
export const settlerModelled = (state, opts = {}) => (u) => settlerModelReady(ownerAge(state, u.ownerId), opts);

/** The settlers the close view stands a party for: on a tile, yours, or others' in sight. */
export const settlersInSight = (state, isVisible = null) => Object.values(state.units || {})
  .filter((u) => isSettler(u) && u.tile != null && (u.ownerId === state.playerNationId || !isVisible || isVisible(u.tile)));
