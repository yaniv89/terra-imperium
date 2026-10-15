// src/components/panels/warActions.js
// Declaring war from wherever the intent is (plans/playtest-1.md P2.1): the city card, an enemy
// army's tile, the army sheet's greyed Attack button and the nation card all read one model so
// the cost, the justification and the reasons it is blocked never differ. Pure.
import { ACTION_COSTS } from '../../data/actionCosts';
import { hasCasusBelli, isInTruce, isAtWarWithPlayer } from '../../engine/diplomacy';
import { canAfford } from '../../utils/helpers';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';

export const declareWarModel = (state, nationId) => {
  const me = state.playerNationId;
  const nation = state.nations?.[nationId];
  if (!nation || nationId === me || nationId === 'rebels') return null;
  const atWar = isAtWarWithPlayer(state, nationId);
  const justified = hasCasusBelli(state, me, nationId);
  const costs = justified ? ACTION_COSTS.declareWarJustified : ACTION_COSTS.declareWarUnjustified;
  const blocked = atWar ? t('mx.war.alreadyAtWar') : state.nations[me]?.vassalOf ? t('mx.war.vassal') : nation.vassalOf === me ? t('mx.war.yourVassal') : null;
  const shown = nameNow('people', nationId, nation.name);
  const breaksTruce = !atWar && isInTruce(state, me, nationId);
  const affordable = canAfford(state.resources, costs);
  return {
    nationId, name: nation.name, atWar, justified, costs, blocked, breaksTruce, affordable,
    shown,
    label: `${t('mx.war.label', { name: shown })}${justified ? '' : t('mx.war.unjustified')}`,
    note: blocked || (justified ? t('mx.war.cause') : t('mx.war.noCause')) + (breaksTruce ? t('mx.war.breaksTruce') : ''),
    enabled: !blocked && affordable
  };
};
