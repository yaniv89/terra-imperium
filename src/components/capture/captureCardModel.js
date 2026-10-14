// src/components/capture/captureCardModel.js
// What the capture card (decision 40, UI15) shows for the first capture waiting for the player:
// the city, who it was taken from and how (a won battle or a siege surrender), a few facts, and the
// four choices from the engine (capture.js captureOptions) with their icons, what each does and,
// for one that is not on offer, why. Pure.
import { pendingCapturesOf, captureOptions } from '../../engine/capture';
import { CAPTURE_CHOICE_ICON_IDS } from '../../data/icons';

// In the middle of a sentence: "the Aghvan tribes", not "The Aghvan tribes".
const nameOf = (state, id) => (id ? (state.nations?.[id]?.name || id).replace(/^The /, 'the ') : 'nobody');
const possessive = (name) => (name.endsWith('s') ? `${name}'` : `${name}'s`);

/** The model of the first waiting capture, or null. */
export const captureCardModel = (state) => {
  const list = pendingCapturesOf(state);
  const cap = list[0];
  if (!cap) return null;
  const city = state.regions[cap.cityId];
  const from = nameOf(state, cap.from);
  const how = cap.source === 'siege' ? `It surrendered to your siege, taken from ${from}.` : `Your army took it from ${from} in battle.`;
  const facts = [
    `Size ${city.size || 1}`,
    city.conquest?.capital ? `It was ${possessive(from)} capital` : null,
    (city.buildings?.categories && Object.values(city.buildings.categories).some((t) => t >= 0)) ? 'Its buildings stand' : null
  ].filter(Boolean);
  const choices = captureOptions(state, cap).map((o) => ({ ...o, icon: CAPTURE_CHOICE_ICON_IDS[o.id] }));
  return {
    id: cap.id,
    cityId: cap.cityId,
    name: city.name,
    title: `${city.name} is yours`,
    how,
    facts,
    choices,
    waiting: list.length - 1,
    turn: state.turnNumber
  };
};
