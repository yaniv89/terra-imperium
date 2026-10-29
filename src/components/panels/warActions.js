// src/components/panels/warActions.js
// Declaring war from wherever the intent is (plans/playtest-1.md P2.1): the city card, an enemy
// army's tile, the army sheet's greyed Attack button and the nation card all read one model so
// the cost, the justification and the reasons it is blocked never differ. Pure.
import { hasCasusBelli, isInTruce, isAtWarWithPlayer } from '../../engine/diplomacy';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { canPay, warCost } from '../../utils/costs';
import { payWhy } from './empireText';
import { peopleWhere } from './peopleWhere';

export const declareWarModel = (state, nationId) => {
  const me = state.playerNationId;
  const nation = state.nations?.[nationId];
  if (!nation || nationId === me || nationId === 'rebels') return null;
  const atWar = isAtWarWithPlayer(state, nationId);
  const justified = hasCasusBelli(state, me, nationId);
  const costs = warCost(state, justified);
  // A people you know of but have never seen (no city known, no army in sight) cannot be fought:
  // a war with nobody to fight (warmonger playtest step 31). Find them first.
  const unseen = !atWar && peopleWhere(state, nationId).places.length === 0;
  const blocked = atWar ? t('mx.war.alreadyAtWar') : state.nations[me]?.vassalOf ? t('mx.war.vassal') : nation.vassalOf === me ? t('mx.war.yourVassal') : unseen ? t('mx.war.unseen') : null;
  const shown = nameNow('people', nationId, nation.name);
  const breaksTruce = !atWar && isInTruce(state, me, nationId);
  const affordable = canPay(state, costs);
  return {
    nationId, name: nation.name, atWar, justified, costs, blocked, breaksTruce, affordable,
    shown,
    label: `${t('mx.war.label', { name: shown })}${justified ? '' : t('mx.war.unjustified')}`,
    note: blocked || (justified ? t('mx.war.cause') : t('mx.war.noCause')) + (breaksTruce ? t('mx.war.breaksTruce') : ''),
    enabled: !blocked && affordable,
    why: blocked || payWhy(state, costs) // what a tap on the greyed button says (WhyTip.jsx)
  };
};
