// src/components/map/marchOddsText.js
// The line a march to attack shows before it starts (battleOdds.js estimateMarchOdds): the target's
// known strength against the stack, and how often Auto takes the city; out of sight it says so.
// A garrisoned city is never taken by Auto in one battle (garrison first): then the line gives the
// battle's win chance and says why. A city with only its militia is taken when its walls break: the
// line gives their HP (simulate's own reading). It also names the enemy troops seen standing by near
// the city (newcomer playtest, round 3: "Hopeless" at 10,000 to 1,600 with no reason).
// Shared by the march bar and the city card's "March on" button. { text, hopeless } or null.
import { t } from '../../i18n/core';
import { menText } from '../../engine/battleLedger';
import { HOPELESS_HOLD } from '../battle/defenseSheetModel';
import { garrisonSince, allInText } from '../battle/oddsMemory';
import { autoChance } from '../../engine/battleOdds';

export const marchOddsText = (odds, target) => {
  if (!odds) return null;
  if (!odds.known) return { text: t('march.oddsUnseen', { target }), hopeless: false };
  const garrison = odds.autoRule === 'garrison';
  const chance = autoChance(odds);
  const hopeless = chance < HOPELESS_HOLD;
  const walls = odds.autoRule === 'attack' && odds.city;
  const key = `march.odds${garrison ? 'Garrison' : walls ? 'Walls' : ''}${hopeless ? 'Hopeless' : ''}`;
  const city = odds.defenderStrength - (odds.defenderStandby || 0); // the men in the city; those near it are counted below
  const all = allInText({ city, near: odds.standbyStrength, allies: odds.standbyAllies, auxiliaries: odds.auxiliaries });
  const standby = all ? ` ${all}` : '';
  const hp = walls ? { a: odds.city.hpBefore, b: odds.city.maxHp, c: odds.city.hpAfter } : {};
  // A number that jumped since an earlier turn says so (round 3b: Zafar 14,900, then 294,900).
  const since = odds.cityId ? garrisonSince(odds.cityId, odds.turn, city) : '';
  return { text: t(key, { target, theirs: menText(city), mine: menText(odds.attackerStrength), pct: Math.round(chance * 100), ...hp }) + (since ? ` ${since}` : '') + standby, hopeless };
};
