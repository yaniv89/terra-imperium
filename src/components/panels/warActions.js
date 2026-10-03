// src/components/panels/warActions.js
// Declaring war from wherever the intent is (plans/playtest-1.md P2.1): the city card, an enemy
// army's tile, the army sheet's greyed Attack button and the nation card all read one model so
// the cost, the justification and the reasons it is blocked never differ. Pure.
import { ACTION_COSTS } from '../../data/actionCosts';
import { hasCasusBelli, isInTruce, isAtWarWithPlayer } from '../../engine/diplomacy';
import { canAfford } from '../../utils/helpers';

export const declareWarModel = (state, nationId) => {
  const me = state.playerNationId;
  const nation = state.nations?.[nationId];
  if (!nation || nationId === me || nationId === 'rebels') return null;
  const atWar = isAtWarWithPlayer(state, nationId);
  const justified = hasCasusBelli(state, me, nationId);
  const costs = justified ? ACTION_COSTS.declareWarJustified : ACTION_COSTS.declareWarUnjustified;
  const blocked = atWar ? 'already at war' : state.nations[me]?.vassalOf ? "you can't declare war while you're a vassal" : nation.vassalOf === me ? 'your own vassal' : null;
  const breaksTruce = !atWar && isInTruce(state, me, nationId);
  const affordable = canAfford(state.resources, costs);
  return {
    nationId, name: nation.name, atWar, justified, costs, blocked, breaksTruce, affordable,
    label: `Declare war on ${nation.name}${justified ? '' : ' (unjustified)'}`,
    note: blocked || (justified ? 'You have a casus belli.' : 'No casus belli: costs more and angers the world.') + (breaksTruce ? ' Breaks your truce.' : ''),
    enabled: !blocked && affordable
  };
};
