// src/components/capture/captureCardModel.js
// What the capture card (decision 40, UI15) shows for the first capture waiting for the player:
// the city, who it was taken from and how (a won battle or a siege surrender), a few facts, and the
// four choices from the engine (capture.js captureOptions) with their icons, what each does and,
// for one that is not on offer, why. Pure.
import { pendingCapturesOf, captureOptions } from '../../engine/capture';
import { CAPTURE_CHOICE_ICON_IDS } from '../../data/icons';
import { t, getLanguage } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { msgRefText } from '../battle/battleText';

// In the middle of a sentence: "the Aghvan tribes", not "The Aghvan tribes".
const nameOf = (state, id) => (id ? nameNow('people', id, state.nations?.[id]?.name || id).replace(/^The /, 'the ') : t('bt.cap.nobody'));
const possessive = (name) => (name.endsWith('s') ? `${name}'` : `${name}'s`);

/** The model of the first waiting capture, or null. */
export const captureCardModel = (state) => {
  const list = pendingCapturesOf(state);
  const cap = list[0];
  if (!cap) return null;
  const city = state.regions[cap.cityId];
  const from = nameOf(state, cap.from);
  const how = cap.source === 'siege' ? t('bt.cap.howSiege', { from }) : t('bt.cap.howBattle', { from });
  const cityName = nameNow('city', null, city.name);
  const facts = [
    t('bt.cap.size', { n: city.size || 1 }),
    city.conquest?.capital ? (getLanguage() === 'en' ? `It was ${possessive(from)} capital` : t('bt.cap.wasCapitalPoss', { name: from })) : null,
    (city.buildings?.categories && Object.values(city.buildings.categories).some((lvl) => lvl >= 0)) ? t('bt.cap.buildingsStand') : null
  ].filter(Boolean);
  const choices = captureOptions(state, cap).map((o) => ({ ...o, label: t(`bt.cap.choice.${o.id}`), effect: msgRefText(o.effectMsg, o.effect), reason: msgRefText(o.reasonMsg, o.reason), icon: CAPTURE_CHOICE_ICON_IDS[o.id] }));
  return {
    id: cap.id,
    cityId: cap.cityId,
    name: cityName,
    title: t('bt.cap.title', { name: cityName }),
    how,
    facts,
    choices,
    waiting: list.length - 1,
    turn: state.turnNumber
  };
};
