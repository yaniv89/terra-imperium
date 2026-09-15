// src/utils/aiLogic.js
// AI logic for non-player nations

import { NATIONS_DATA, DOCTRINES, HOSTILE_BLOCS } from '../data/nations';
import { REGIONS_DATA, isAdjacentToOwner } from '../data/regions';
import { RelationStatus } from '../data/types';

const DEFAULT_RNG = { next: () => Math.random() };
const DEFAULT_DOCTRINE = DOCTRINES.attrition;

// True if any bloc-mate of `nationId` is currently at war with the player — used to make
// nations pile on once one member of their bloc is already fighting (bandwagon behavior),
// rather than every nation deciding independently as if the others didn't exist.
const hasBlocMateAtWar = (nationId, nations) => {
  const bloc = Object.values(HOSTILE_BLOCS).find(members => members.includes(nationId));
  if (!bloc) return false;
  return bloc.some(memberId => memberId !== nationId && nations[memberId]?.isAtWar);
};

// Process AI turn for a single nation. `rng` must be a { next(): number } generator
// (see src/utils/rng.js) so turn resolution stays deterministic and replayable.
export const processAINationTurn = (nation, state, year, rng = DEFAULT_RNG, invasionCounter = 0) => {
  const updates = {
    militaryStrengthChange: 0,
    hostilityChange: 0,
    newInvasions: [],
    regionConflicts: [],
    logs: []
  };

  if (nation.isPlayer) return updates;

  const nationData = NATIONS_DATA[nation.id];
  const doctrine = DOCTRINES[nation.doctrine] || DEFAULT_DOCTRINE;

  // 1. Economic growth - nations build military over time (cautious doctrines grow faster)
  const baseGrowth = Math.floor(nation.militaryStrength * 0.03 * doctrine.economyGrowthMult);
  const economyBonus = Math.floor(rng.next() * 500 * doctrine.economyGrowthMult);
  updates.militaryStrengthChange = baseGrowth + economyBonus;

  // Rich nations grow faster
  if (nationData) {
    const regions = Object.values(state.regions).filter(r => r.owner === nation.id);
    const totalResources = regions.reduce((sum, r) => {
      const regData = REGIONS_DATA[r.id];
      return sum + (regData?.resources?.money || 0);
    }, 0);
    updates.militaryStrengthChange += Math.floor(totalResources * 0.05 * doctrine.economyGrowthMult);
  }

  const aggression = nationData?.aggression ?? 0.3;
  const bandwagon = hasBlocMateAtWar(nation.id, state.nations) ? doctrine.bandwagonMult : 1;

  // 2. Hostility changes.
  // Decay must apply whether or not the nation is at war — otherwise DECLARE_WAR's
  // hostility:100 is a permanent floor (the only code that lowered hostility used to be
  // gated to `!isAtWar`), and "seek peace" requires hostility <= 60, which then can never
  // be reached: every war becomes permanent and unwinnable. War exhaustion should if
  // anything decay hostility *faster* than peacetime drift. Decay never crosses below the
  // nation's hostilityFloor — set once this nation broke a peace treaty (src/engine/diplomacy.js).
  const hostilityFloor = nation.hostilityFloor || 0;
  if (nation.hostility > Math.max(20, hostilityFloor) && rng.next() < (nation.isAtWar ? 0.35 : 0.2)) {
    updates.hostilityChange += -2;
    updates.logs.push({
      message: nation.isAtWar
        ? `${nation.name} war-weariness grows`
        : `${nation.name} tensions ease slightly`,
      type: 'ai'
    });
  }

  // Hostility can also ratchet up based on aggression — only while not already at war
  // (an already-warring nation is already maximally hostile; this represents peacetime
  // provocation escalating toward war, not war escalating further). A bloc-mate already at
  // war with the player accelerates this (bandwagon).
  if (!nation.isAtWar && rng.next() < aggression * 0.1 * bandwagon) {
    updates.hostilityChange += 3;
  }

  // 3. War actions - launch invasions (blitz doctrines attack more readily)
  if (nation.isAtWar && state.phase !== 'PRE_STATE') {
    // Check if should launch new invasion
    if (rng.next() < aggression * 0.3 * doctrine.warRollMult) {
      const playerRegions = Object.values(state.regions).filter(r => r.owner === 'player');
      const existingInvasions = state.invasions.filter(
        inv => !inv.isPlayerAttacker && inv.active
      );

      // Don't have too many simultaneous invasions
      if (playerRegions.length > 0 && existingInvasions.length < 3) {
        // Pick a target - prefer border regions or regions with low control. Must border
        // territory this nation actually holds, same rule the player is held to — except for
        // stateless actors with no territory on the map at all (e.g. Hamas), who have no front
        // line to be constrained by and can still strike anywhere.
        const isStateless = !Object.values(state.regions).some(r => r.owner === nation.id);
        const validTargets = playerRegions.filter(r => {
          if (existingInvasions.some(inv => inv.targetRegion === r.id)) return false;
          return isStateless || isAdjacentToOwner(r.id, state.regions, nation.id);
        });

        if (validTargets.length > 0) {
          // Sort by strategic value and control (lower control = easier target)
          validTargets.sort((a, b) => {
            const aData = REGIONS_DATA[a.id];
            const bData = REGIONS_DATA[b.id];
            const aScore = (aData?.strategicValue || 5) - (a.control / 20);
            const bScore = (bData?.strategicValue || 5) - (b.control / 20);
            return bScore - aScore;
          });

          const target = validTargets[0];
          const invasionStrength = Math.floor(nation.militaryStrength * (0.2 + rng.next() * 0.15));

          updates.newInvasions.push({
            id: `inv_${nation.id}_${year}_${invasionCounter}`,
            targetRegion: target.id,
            strength: invasionStrength,
            morale: 80 + Math.floor(rng.next() * 20),
            supply: 100,
            active: true,
            isPlayerAttacker: false,
            attackerNation: nation.id
          });

          updates.logs.push({
            message: `${nation.name} attacks ${REGIONS_DATA[target.id]?.name || target.id}!`,
            type: 'crisis'
          });

          // Launching attack costs military strength
          updates.militaryStrengthChange -= Math.floor(invasionStrength * 0.1);
        }
      }
    }
  }

  // 4. AI vs AI conflicts (simplified)
  if (!nation.isAtWar && rng.next() < 0.02) {
    const otherNations = Object.values(state.nations).filter(
      n => n.id !== nation.id && !n.isPlayer && !n.isAtWar && n.hostility > 50
    );

    if (otherNations.length > 0) {
      const enemy = otherNations[Math.floor(rng.next() * otherNations.length)];
      const casualtiesAggressor = Math.floor(nation.militaryStrength * 0.02);
      const casualtiesDefender = Math.floor(enemy.militaryStrength * 0.02);

      updates.regionConflicts.push({
        aggressor: nation.id,
        defender: enemy.id,
        casualtiesAggressor,
        casualtiesDefender
      });

      updates.logs.push({
        message: `Regional skirmish: ${nation.name} clashes with ${enemy.name}`,
        type: 'ai'
      });
    }
  }

  return updates;
};

// Process all AI nations for a turn. Returns per-nation strength/hostility deltas
// (including AI-vs-AI conflict casualties, which are now actually applied — previously
// regionConflicts was computed and logged but silently discarded by the caller).
export const processAllAINations = (state, year, rng = DEFAULT_RNG) => {
  const allUpdates = {
    nationUpdates: {},
    newInvasions: [],
    regionConflicts: [],
    logs: []
  };

  let invasionCounter = 0;
  Object.values(state.nations).forEach(nation => {
    if (nation.isPlayer) return;

    const updates = processAINationTurn(nation, state, year, rng, invasionCounter);
    invasionCounter += updates.newInvasions.length;

    allUpdates.nationUpdates[nation.id] = {
      militaryStrengthChange: (allUpdates.nationUpdates[nation.id]?.militaryStrengthChange || 0) + updates.militaryStrengthChange,
      hostilityChange: (allUpdates.nationUpdates[nation.id]?.hostilityChange || 0) + updates.hostilityChange
    };

    allUpdates.newInvasions.push(...updates.newInvasions);
    allUpdates.regionConflicts.push(...updates.regionConflicts);
    allUpdates.logs.push(...updates.logs);
  });

  // Apply AI-vs-AI conflict casualties to both sides now, rather than discarding them.
  allUpdates.regionConflicts.forEach(conflict => {
    const aggUpdate = allUpdates.nationUpdates[conflict.aggressor] || { militaryStrengthChange: 0, hostilityChange: 0 };
    aggUpdate.militaryStrengthChange -= conflict.casualtiesAggressor;
    allUpdates.nationUpdates[conflict.aggressor] = aggUpdate;

    const defUpdate = allUpdates.nationUpdates[conflict.defender] || { militaryStrengthChange: 0, hostilityChange: 0 };
    defUpdate.militaryStrengthChange -= conflict.casualtiesDefender;
    allUpdates.nationUpdates[conflict.defender] = defUpdate;
  });

  return allUpdates;
};

// Calculate if a nation should independently declare war on the player this turn.
// `rng` must be a { next(): number } generator so this stays deterministic like the rest of
// turn resolution — previously this used Math.random() directly and, separately, was never
// called from anywhere, so AI nations could never start a war on their own initiative.
export const shouldDeclareWar = (nation, state, rng = DEFAULT_RNG) => {
  if (nation.isPlayer || nation.isAtWar || nation.hasPeaceTreaty) return false;

  const nationData = NATIONS_DATA[nation.id];
  if (!nationData) return false;

  const doctrine = DOCTRINES[nation.doctrine] || DEFAULT_DOCTRINE;
  const bandwagon = hasBlocMateAtWar(nation.id, state.nations) ? doctrine.bandwagonMult : 1;

  // High hostility + high aggression = war likely
  const warChance = (nation.hostility / 100) * nationData.aggression;

  // Historical enemies more likely to attack
  const isHistoricalEnemy = ['egypt', 'syria', 'jordan', 'iraq'].includes(nation.id);
  const historicalBonus = isHistoricalEnemy ? 0.1 : 0;

  return rng.next() < (warChance + historicalBonus) * 0.05 * doctrine.warRollMult * bandwagon;
};

// Get relation status from hostility
export const getRelationFromHostility = (hostility, isAtWar, hasPeace, hasTrade) => {
  if (isAtWar) return RelationStatus.WAR;
  if (hasTrade) return RelationStatus.FRIENDLY;
  if (hasPeace) return RelationStatus.COLD_PEACE;
  if (hostility >= 80) return RelationStatus.HOSTILE;
  if (hostility >= 50) return RelationStatus.NEUTRAL;
  return RelationStatus.NEUTRAL;
};
