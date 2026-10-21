// src/engine/consequences.js
// U25: what taking a city would cost, shown before the player acts. Pure projections on copies:
// nothing here writes state. The AE rule is conquest.js's own (captureAeMult, applyAggressiveExpansion)
// and the league rule is pacts.js's own (updateDefensivePacts), so the preview cannot drift from the capture.
import { applyAggressiveExpansion } from './expansion';
import { captureAeMult, OCCUPATION_GRACE_TURNS } from './conquest';
import { updateDefensivePacts } from './pacts';
import { loyaltyForecast, LOYALTY_ON_CONQUEST } from './loyalty';

/** Nations that would join a league against `takerId` if it took `cityId` now: [nationId], sorted. */
export const coalitionIfTaken = (state, cityId, takerId = state.playerNationId) => {
  const city = state.regions?.[cityId];
  if (!city?.owner || city.owner === takerId) return [];
  const taken = { ...state.regions, [cityId]: { ...city, owner: takerId } };
  const ae = applyAggressiveExpansion(state.nations, taken, cityId, city.owner, takerId, captureAeMult(state, takerId, city));
  const { nations } = updateDefensivePacts(ae, { playerNationId: state.playerNationId, turnNumber: state.turnNumber });
  const against = (n) => n?.defensivePact?.against === takerId;
  return Object.keys(nations).filter((id) => against(nations[id]) && !against(state.nations[id])).sort();
};

/**
 * Where the city's loyalty would head once `takerId` holds it: the loyaltyForecast of the city as
 * conquest.js leaves it. shortcut: no garrison counted yet (the army is not on the centre), so
 * it is the worst case; garrison.gain says what one unit adds.
 */
export const loyaltyIfTaken = (state, cityId, takerId = state.playerNationId) => {
  const city = state.regions?.[cityId];
  if (!city?.owner || city.owner === takerId) return null;
  const turn = state.turnNumber || 1;
  const taken = { ...city, owner: takerId, loyalty: LOYALTY_ON_CONQUEST, conquest: { from: city.owner, turn, graceUntil: turn + OCCUPATION_GRACE_TURNS } };
  return loyaltyForecast({ ...state, regions: { ...state.regions, [cityId]: taken } }, taken);
};

export const consequencesOfTaking = (state, cityId, takerId = state.playerNationId) => ({
  coalition: coalitionIfTaken(state, cityId, takerId),
  loyalty: loyaltyIfTaken(state, cityId, takerId)
});
