// src/engine/diplomacy.js
// Pure diplomatic state transitions shared between the reducer (player-initiated actions) and
// resolveTurn.js (AI-initiated wars, Phase 4). Keeping one implementation means a war declared
// by the player and one declared by an AI nation always produce the same shape of state change.

import { RelationStatus } from '../data/types';

// Declares war on `nationId`. No-op (returns state unchanged) if the nation doesn't exist or is
// already at war. If the target had a peace treaty, this sets a permanent hostilityFloor — the
// nation remembers the betrayal and can never fully cool back down, even after a later peace.
export const declareWar = (state, nationId) => {
  const nation = state.nations[nationId];
  if (!nation || nation.isAtWar) return state;

  const brokePeace = !!nation.hasPeaceTreaty;
  return {
    ...state,
    nations: {
      ...state.nations,
      [nationId]: {
        ...nation,
        isAtWar: true,
        hostility: 100,
        relationStatus: RelationStatus.WAR,
        hostilityFloor: brokePeace ? Math.max(nation.hostilityFloor || 0, 40) : (nation.hostilityFloor || 0)
      }
    },
    wars: [...state.wars, { id: `war_${nationId}_${state.year}`, enemy: nationId, startYear: state.year, active: true }]
  };
};
