// src/components/map/marchOddsText.js
// The line a march to attack shows before it starts (battleOdds.js estimateMarchOdds): the target's
// known strength against the stack, and how often Auto takes the city; out of sight it says so.
// Shared by the march bar and the city card's "March on" button. { text, hopeless } or null.
import { t } from '../../i18n/core';
import { menText } from '../../engine/battleLedger';
import { HOPELESS_HOLD } from '../battle/defenseSheetModel';

export const marchOddsText = (odds, target) => {
  if (!odds) return null;
  if (!odds.known) return { text: t('march.oddsUnseen', { target }), hopeless: false };
  const hopeless = odds.capture < HOPELESS_HOLD;
  return { text: t(hopeless ? 'march.oddsHopeless' : 'march.odds', { target, theirs: menText(odds.defenderStrength), mine: menText(odds.attackerStrength), pct: Math.round(odds.capture * 100) }), hopeless };
};
