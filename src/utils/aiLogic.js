// src/utils/aiLogic.js
// AI logic for non-player nations. Deliberately minimal for now: passive economic growth and
// hostility drift only. The full tiered decision loop (threat assessment, posture, counter-
// building, war declarations — plan §8.5) is Phase D work, built once the new military and
// diplomacy systems (unit classes, casus belli) exist for it to reason about.

import { DOCTRINES } from '../data/nations';
import { RelationStatus } from '../data/types';

const DEFAULT_RNG = { next: () => Math.random() };
const DEFAULT_DOCTRINE = DOCTRINES.attrition;

// Process AI turn for a single nation. `rng` must be a { next(): number } generator
// (see src/utils/rng.js) so turn resolution stays deterministic and replayable.
export const processAINationTurn = (nation, state, year, rng = DEFAULT_RNG) => {
  const updates = { militaryStrengthChange: 0, hostilityChange: 0, logs: [] };
  if (nation.isPlayer) return updates;

  const doctrine = DOCTRINES[nation.doctrine] || DEFAULT_DOCTRINE;

  // Passive economic growth — nations build military over time (cautious doctrines grow faster).
  const baseGrowth = Math.floor(nation.militaryStrength * 0.01 * doctrine.economyGrowthMult);
  const economyBonus = Math.floor(rng.next() * 50 * doctrine.economyGrowthMult);
  updates.militaryStrengthChange = baseGrowth + economyBonus;

  // Hostility drifts down toward its floor over time — no scripted conflict is pushing it up in
  // the other direction yet (that's Phase D's casus belli / AI war-decision work).
  const hostilityFloor = nation.hostilityFloor || 0;
  if (nation.hostility > hostilityFloor) {
    updates.hostilityChange = -1;
  }

  return updates;
};

// Process all AI nations for a turn. Returns per-nation strength/hostility deltas.
export const processAllAINations = (state, year, rng = DEFAULT_RNG) => {
  const allUpdates = { nationUpdates: {}, logs: [] };

  Object.values(state.nations).forEach(nation => {
    if (nation.isPlayer) return;
    const updates = processAINationTurn(nation, state, year, rng);
    allUpdates.nationUpdates[nation.id] = {
      militaryStrengthChange: updates.militaryStrengthChange,
      hostilityChange: updates.hostilityChange
    };
    allUpdates.logs.push(...updates.logs);
  });

  return allUpdates;
};

// Get relation status from hostility.
export const getRelationFromHostility = (hostility, isAtWar, hasPeace, hasTrade) => {
  if (isAtWar) return RelationStatus.WAR;
  if (hasTrade) return RelationStatus.FRIENDLY;
  if (hasPeace) return RelationStatus.COLD_PEACE;
  if (hostility >= 80) return RelationStatus.HOSTILE;
  return RelationStatus.NEUTRAL;
};
