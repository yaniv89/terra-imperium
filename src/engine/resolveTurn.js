// src/engine/resolveTurn.js
// Pure turn-resolution engine. Takes one state snapshot and a seeded RNG, returns the fully
// resolved next state. Replaces the old GameContext.advanceTurn, which dispatched ~7 separate
// actions per turn from a single stale `state` closure — that caused two concrete bugs:
//   1. Two invasions landing on the same region in one turn each computed damage from the same
//      pre-turn control value, so the second dispatch silently overwrote the first (net damage
//      was ~half of what it should have been).
//   2. Victory/defeat were checked against the OLD state before the turn's own dispatches had
//      applied, so defeat was detected a full turn late.
// Collapsing everything into one pure function eliminates both: there is only one snapshot,
// mutated locally in order, and only one dispatch to the reducer.

import { GamePhases, GameStatus, LogTypes } from '../data/types';
import { REGIONS_DATA } from '../data/regions';
import { NATIONS_DATA } from '../data/nations';
import { TECH_TREE } from '../data/techTree';
import { pickNextEvent } from '../data/events';
import {
  calcIncome,
  calcMilitaryPower,
  getTechBonuses,
  calcCombatResult,
  formatNumber
} from '../utils/helpers';
import { processAllAINations, getRelationFromHostility } from '../utils/aiLogic';
import { createRng } from '../utils/rng';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const resolveTurn = (state) => {
  // Guard: nothing to resolve if the game already ended or an event is blocking play.
  // (The UI also disables End Turn in these cases; this is the authoritative backstop.)
  if (state.gameStatus !== GameStatus.ACTIVE || state.activeEventId) {
    return state;
  }

  const rng = createRng(state.rngSeed);
  const logs = [];

  // --- time ---
  const isH2 = state.period === 1;
  const newPeriod = isH2 ? 0 : 1;
  const newYear = isH2 ? state.year + 1 : state.year;
  const dateString = `${newYear} ${newPeriod === 0 ? 'H1' : 'H2'}`;

  // --- tech availability ---
  const techTree = { ...state.techTree };
  Object.keys(techTree).forEach(id => {
    if (TECH_TREE[id].yearAvailable <= newYear) {
      techTree[id] = { ...techTree[id], available: true };
    }
  });

  // --- income ---
  const income = calcIncome(state);
  logs.push({
    year: newYear,
    message: `${dateString}: +$${formatNumber(income.money)}, +${formatNumber(income.manpower)} Men${state.phase === GamePhases.POST_STATE ? `, +${income.techPoints} TP` : ''}`,
    type: LogTypes.ACTION
  });
  const resources = {
    ...state.resources,
    money: state.resources.money + income.money,
    manpower: state.resources.manpower + income.manpower,
    techPoints: state.resources.techPoints + income.techPoints,
    diplomacyPoints: state.resources.diplomacyPoints + income.diplomacyPoints,
    actionPoints: state.resources.maxActionPoints
  };

  // --- combat ---
  // `regions` is mutated in place through the loop (not re-read from `state`), so a second
  // invasion hitting the same region this turn compounds correctly instead of clobbering.
  const regions = { ...state.regions };
  let militaryPower = state.militaryPower;
  let undergroundStrength = state.undergroundStrength;
  const nationCombatDeltas = {}; // nationId -> militaryStrength delta from combat this turn

  const techBonuses = getTechBonuses(state.techTree);
  const playerDefenseBonus = (techBonuses.defenseBonus || 0) + (state.eventDefenseBonus || 0);
  // Player's own defensive tech should not also shield the nation the player is attacking —
  // that bug let researching Haganah Doctrine make the player's own offensives *harder*.
  const attackerSideDefenseTechBonuses = {};
  const defenderSideDefenseTechBonuses = { defenseBonus: playerDefenseBonus };

  // Snapshot the player's defensive capacity once for the whole turn (matches original design:
  // defense capacity doesn't instantly drop mid-turn as casualties land from earlier invasions).
  const playerDefenseBase = calcMilitaryPower(state) * 0.3;

  const addNationDelta = (nationId, militaryStrengthChange) => {
    if (!nationId) return;
    nationCombatDeltas[nationId] = (nationCombatDeltas[nationId] || 0) + militaryStrengthChange;
  };

  const resolvedInvasions = state.invasions.map(inv => {
    if (!inv.active) return inv;

    let newInv = { ...inv, supply: inv.supply - 10 };
    const targetRegion = regions[inv.targetRegion];
    const targetData = REGIONS_DATA[inv.targetRegion];
    if (!targetRegion || !targetData) return newInv;

    const fortification = targetData.fortification ?? 1;

    if (inv.isPlayerAttacker) {
      const defenderNation = state.nations[targetRegion.owner];
      if (defenderNation && !defenderNation.isPlayer) {
        const defenseStrength = defenderNation.militaryStrength * 0.3 * fortification;
        const result = calcCombatResult(inv.strength, defenseStrength, attackerSideDefenseTechBonuses, targetData.terrain, rng);

        militaryPower = Math.max(0, militaryPower - result.casualties.attacker);
        addNationDelta(targetRegion.owner, -result.casualties.defender);

        if (result.attackerWins) {
          newInv.active = false;
          regions[inv.targetRegion] = { ...targetRegion, owner: 'player', control: 60, isOccupied: true, underInvasion: false };
          logs.push({ year: newYear, message: `VICTORY! Captured ${targetData.name}!`, type: LogTypes.MILESTONE });
        } else if (result.stalemate) {
          newInv.morale -= 10;
          logs.push({ year: newYear, message: `Offensive in ${targetData.name}: progress slow`, type: LogTypes.COMBAT });
        } else {
          newInv.morale -= 25;
          newInv.strength = Math.floor(newInv.strength * 0.85);
          logs.push({ year: newYear, message: `Offensive in ${targetData.name} stalled!`, type: LogTypes.COMBAT });
        }
      }
    } else if (targetRegion.owner === 'player') {
      const result = calcCombatResult(inv.strength, playerDefenseBase, defenderSideDefenseTechBonuses, targetData.terrain, rng);

      addNationDelta(inv.attackerNation, -result.casualties.attacker);
      if (state.phase === GamePhases.PRE_STATE) {
        undergroundStrength = Math.max(0, undergroundStrength - result.casualties.defender);
      } else {
        militaryPower = Math.max(0, militaryPower - result.casualties.defender);
      }

      if (result.attackerWins) {
        const damage = 25;
        const newControl = Math.max(0, targetRegion.control - damage);
        if (newControl <= 0 && inv.attackerNation) {
          // Previously enemy invasions could only grind control to a floor of 0 and the region
          // stayed "player-owned" forever, producing $0 with no path back — this made defeat
          // impossible to trigger even when the player had visibly lost the war. Now overrunning
          // a region actually transfers it.
          regions[inv.targetRegion] = { ...targetRegion, owner: inv.attackerNation, control: 20, isOccupied: true, underInvasion: false };
          newInv.active = false;
          logs.push({ year: newYear, message: `${targetData.name} CAPTURED by ${NATIONS_DATA[inv.attackerNation]?.name}!`, type: LogTypes.CRISIS });
        } else {
          regions[inv.targetRegion] = { ...targetRegion, control: newControl };
          logs.push({ year: newYear, message: `${targetData.name} OVERRUN! Control -${damage}%`, type: LogTypes.CRISIS });
        }
      } else if (result.stalemate) {
        const damage = 10;
        regions[inv.targetRegion] = { ...targetRegion, control: Math.max(0, targetRegion.control - damage) };
        newInv.morale -= 10;
        logs.push({ year: newYear, message: `${targetData.name} under pressure. Control -${damage}%`, type: LogTypes.COMBAT });
      } else {
        newInv.morale -= 25;
        newInv.strength = Math.floor(newInv.strength * 0.8);
        logs.push({ year: newYear, message: `Defended ${targetData.name}! Enemy repelled.`, type: LogTypes.COMBAT });
      }
    }

    if (newInv.supply <= 0 || newInv.morale <= 0) {
      newInv.active = false;
      logs.push({
        year: newYear,
        message: `${inv.isPlayerAttacker ? 'Our' : 'Enemy'} invasion of ${targetData.name} collapsed`,
        type: LogTypes.COMBAT
      });
    }

    return newInv;
  });

  // --- AI nations ---
  // aiUpdates.nationUpdates (growth + AI-vs-AI conflict casualties) is read directly in the
  // nations merge pass below via growthUpdate — it must NOT also be folded into
  // nationCombatDeltas here, or growth would be double-counted (once as growthUpdate, once as
  // combatDelta) exactly canceling out the casualties this turn's player-combat inflicted.
  const aiUpdates = processAllAINations(state, newYear, rng);
  logs.push(...aiUpdates.logs.map(l => ({ year: newYear, ...l })));

  const allInvasions = [...resolvedInvasions, ...aiUpdates.newInvasions];

  // Recompute underInvasion from the final truth of active invasions, rather than toggling it
  // incrementally per-invasion — previously a collapsing invasion could clear the flag on a
  // region another invasion was still actively besieging.
  const regionHasActiveInvasion = {};
  allInvasions.forEach(inv => { if (inv.active) regionHasActiveInvasion[inv.targetRegion] = true; });
  Object.keys(regions).forEach(rid => {
    const shouldBeUnderInvasion = !!regionHasActiveInvasion[rid];
    if (regions[rid].underInvasion !== shouldBeUnderInvasion) {
      regions[rid] = { ...regions[rid], underInvasion: shouldBeUnderInvasion };
    }
  });

  // --- nations: apply AI growth + war hostility decay + combat casualties in one pass ---
  const nations = { ...state.nations };
  Object.entries(nations).forEach(([nId, nation]) => {
    if (nation.isPlayer) return;
    const growthUpdate = aiUpdates.nationUpdates[nId];
    // growthUpdate.militaryStrengthChange already includes AI-vs-AI conflict casualties (applied
    // inside processAllAINations); combatDelta here is player-related combat from this turn's
    // invasion resolution above. Each is added exactly once.
    const combatDelta = nationCombatDeltas[nId] || 0;
    const militaryStrength = Math.max(100, nation.militaryStrength + (growthUpdate?.militaryStrengthChange || 0) + combatDelta);
    const hostility = clamp(nation.hostility + (growthUpdate?.hostilityChange || 0), 0, 100);
    const relationStatus = nation.isAtWar || nation.hasPeaceTreaty || nation.hasTradeAgreement
      ? nation.relationStatus
      : getRelationFromHostility(hostility, nation.isAtWar, nation.hasPeaceTreaty, nation.hasTradeAgreement);
    nations[nId] = { ...nation, militaryStrength, hostility, relationStatus };
  });

  // --- events ---
  const dueEvent = pickNextEvent(newYear, state.phase, nations, state.firedEvents);

  // --- assemble next state ---
  let next = {
    ...state,
    year: newYear,
    period: newPeriod,
    turnNumber: state.turnNumber + 1,
    resources,
    techTree,
    regions,
    nations,
    invasions: allInvasions,
    militaryPower,
    undergroundStrength,
    activeEventId: dueEvent ? dueEvent.id : null,
    rngSeed: rng.getSeed(),
    logs: [...state.logs, ...logs]
  };

  // --- victory / defeat (checked against THIS turn's resolved state, not last turn's) ---
  if (state.phase === GamePhases.POST_STATE) {
    const hasTelAviv = next.regions.tel_aviv?.owner === 'player' && next.regions.tel_aviv?.control > 0;
    const hasJerusalem = next.regions.jerusalem?.owner === 'player' && next.regions.jerusalem?.control > 0;
    if (!hasTelAviv || !hasJerusalem) {
      next.gameStatus = GameStatus.DEFEAT;
      next.logs = [...next.logs, { year: newYear, message: 'DEFEAT: Israel has fallen. Core territories lost.', type: LogTypes.CRISIS }];
    }
  }

  // Backstop victory: the scripted `galactic_age_2150` event is what normally delivers the win
  // (its `effects.victory` is applied in applyEventEffects.js), but if for any reason no event
  // is pending once the timeline runs out, don't leave the game unwinnable.
  if (next.gameStatus === GameStatus.ACTIVE && newYear >= 2150 && !next.activeEventId) {
    next.gameStatus = GameStatus.VICTORY;
    next.logs = [...next.logs, { year: newYear, message: 'VICTORY: Israel survives to 2150!', type: LogTypes.MILESTONE }];
  }

  return next;
};
