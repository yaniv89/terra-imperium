// src/components/battle/oddsMemory.js
// What the player last saw of a city's defence on an earlier turn, so a card whose numbers jumped
// says why (civ-veteran round 3b: Zafar read 14,900, then 44,900, then 294,900 men with no reason;
// Jerusalem went from "holds 100%" to "0%" as its walls broke). UI memory, never game state.
// shortcut: lost on reload and keyed by city id alone (ids repeat between games, a new game starts at a lower turn); move it into the save if a reload must keep it.
import { t } from '../../i18n/core';
import { menText } from '../../engine/battleLedger';
import { nameNow } from '../../i18n/names';

const seen = new Map();

/** Records `now` under `key` for `turn`; returns what was recorded on the last earlier turn ({ turn, value }) or null. */
export const seenBefore = (key, turn, now) => {
  const e = seen.get(key);
  const before = e && e.turn < turn ? { turn: e.turn, value: e.now } : e && e.turn === turn ? e.before : null;
  seen.set(key, { turn, now, before });
  return before;
};

export const forgetSeen = () => seen.clear();

// A change smaller than this share of the old number is not worth a line.
const JUMP = 0.25;

/** "Up from 14,900 men on turn 130: more troops marched in." when the city's defenders (strength) changed by a quarter or more since an earlier turn the player saw them, else ''. */
export const garrisonSince = (cityId, turn, strength) => {
  const b = seenBefore(`g:${cityId}`, turn, strength);
  if (!b || Math.abs(strength - b.value) < JUMP * Math.max(1, b.value)) return '';
  return t(strength > b.value ? 'odds.sinceUp' : 'odds.sinceDown', { men: menText(b.value), turn: b.turn });
};

/** "Its walls had 120 of 240 HP on turn 130; now 0." when they lost HP since an earlier turn the player saw them, else ''. */
export const wallsSince = (cityId, turn, hp, maxHp) => {
  const b = seenBefore(`w:${cityId}`, turn, hp);
  return b && b.value > hp ? t('odds.wallsSince', { turn: b.turn, hp: b.value, max: maxHp, now: hp }) : '';
};

/**
 * Every enemy man the battle meets, from the odds (estimateMarchOdds, or the card's own): the city's
 * garrison with its militia, the troops standing near it (a battle you command calls them in, Auto does
 * not) and the auxiliaries it trains (Auto's own estimate). '' when there is nothing beyond the city.
 * Lead playtest 29 Oct, Blidaru: the card said 33,440 to 50,160, the battle met 61,800.
 */
export const allInText = ({ defenderStrength = 0, standbyStrength = 0, standbyAllies = [], auxiliaries = null }) => {
  const aux = auxiliaries?.defender || 0;
  if (standbyStrength > 0) return t('odds.allInNear', { near: menText(standbyStrength), allies: alliesText(standbyAllies), all: menText(defenderStrength + standbyStrength + aux), aux: menText(aux) });
  return aux > 0 ? t('odds.allIn', { all: menText(defenderStrength + aux), aux: menText(aux) }) : '';
};

/** " (20,000 from Elam)" for seenStandby's allies, else ''. The march line and the pre-battle card. */
export const alliesText = (allies = []) => (allies.length
  ? t('march.standbyAllies', { list: allies.map((a) => t('march.allyMen', { who: nameNow('people', a.id, a.name), men: menText(a.strength) })).join(', ') })
  : '');
