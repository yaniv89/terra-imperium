// src/engine/resolveTurn.js
// Pure turn-resolution engine. Takes one state snapshot and returns the fully resolved next
// state, using the RNG seed carried on state (never Math.random() directly) so replays and
// multiplayer resolution are deterministic.
//
// Deliberately minimal for Phase A: calendar/age advance, resource income, AI nations' passive
// growth, and the (currently empty) scripted/procedural event pipeline. Combat, invasions,
// AI-declared wars and tech effects are NOT resolved here yet — they're rebuilt from scratch in
// Phase C/D against the new unit-class and diplomacy systems, rather than adapted from the old
// infantry/armor/air model this replaced.

import { GameStatus, LogTypes } from '../data/types';
import { getCalendarAgeId, getYearsPerTurn } from '../data/ages';
import { createEmptyResourcePool } from '../data/resources';
import { pickNextEvent } from '../data/events';
import { pickProceduralEvent } from '../data/proceduralEvents';
import { EVENT_CHAINS } from '../data/eventChains';
import { calcIncome, formatMoney, nextUnrest } from '../utils/helpers';
import { processAllAINations, getRelationFromHostility } from '../utils/aiLogic';
import { checkVictoryConditions, applyVictory, VICTORY_CONDITIONS } from '../data/victoryConditions';
import { createRng } from '../utils/rng';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const resolveTurn = (state) => {
  // Guard: nothing to resolve if the game already ended or an event is blocking play.
  if (state.gameStatus !== GameStatus.ACTIVE || state.activeEventId || state.activeProceduralEvent) {
    return state;
  }

  const rng = createRng(state.rngSeed);
  const logs = [];

  // --- time ---
  const newYear = state.year + getYearsPerTurn(state.age, state.gameSpeed);
  const newAge = getCalendarAgeId(newYear);
  const newTurnNumber = state.turnNumber + 1;

  // --- income ---
  const income = calcIncome(state);
  const resources = { ...createEmptyResourcePool(newAge), ...state.resources };
  Object.entries(income).forEach(([id, amount]) => { resources[id] = (resources[id] || 0) + amount; });
  logs.push({ year: newYear, message: `${Math.round(newYear)}: +${formatMoney(income.gold || 0)}`, type: LogTypes.ACTION });

  // --- unrest drift (every region, not just the player's — this is a generic mechanic every
  // nation's own territory is subject to) ---
  const regions = { ...state.regions };
  Object.entries(regions).forEach(([id, region]) => {
    const unrest = nextUnrest(region);
    if (unrest !== region.unrest) regions[id] = { ...region, unrest };
  });

  // --- AI nations: passive growth + hostility drift ---
  const aiUpdates = processAllAINations(state, newYear, rng);
  const nations = { ...state.nations };
  Object.entries(nations).forEach(([nId, nation]) => {
    if (nation.isPlayer) return;
    const growthUpdate = aiUpdates.nationUpdates[nId];
    const militaryStrength = Math.max(100, nation.militaryStrength + (growthUpdate?.militaryStrengthChange || 0));
    const hostility = clamp(nation.hostility + (growthUpdate?.hostilityChange || 0), nation.hostilityFloor || 0, 100);
    const relationStatus = nation.isAtWar || nation.hasPeaceTreaty || nation.hasTradeAgreement
      ? nation.relationStatus
      : getRelationFromHostility(hostility, nation.isAtWar, nation.hasPeaceTreaty, nation.hasTradeAgreement);
    nations[nId] = { ...nation, militaryStrength, hostility, relationStatus };
  });
  logs.push(...aiUpdates.logs.map(l => ({ year: newYear, ...l })));

  // --- events ---
  const dueEvent = pickNextEvent(newYear, nations, state.firedEvents);

  // --- event chains ---
  // A scripted follow-up scheduled earlier by applyEventEffects.js (effects.spawnFollowUp) fires
  // as soon as its dueTurn is reached, but only when no scripted historical event is already due
  // this turn.
  const pendingEventChains = state.pendingEventChains || [];
  let chainEventId = null;
  let nextPendingEventChains = pendingEventChains;
  if (!dueEvent) {
    const dueIndex = pendingEventChains.findIndex(c => c.dueTurn <= newTurnNumber && EVENT_CHAINS[c.id]);
    if (dueIndex !== -1) {
      chainEventId = pendingEventChains[dueIndex].id;
      nextPendingEventChains = pendingEventChains.filter((_, i) => i !== dueIndex);
    }
  }

  // --- procedural events ---
  // Only rolled when no scripted event or chain event is already due this turn. Gated behind a
  // cooldown (a random few turns after each firing) so these don't cluster.
  let proceduralEventCooldown = Math.max(0, (state.proceduralEventCooldown || 0) - 1);
  let activeProceduralEvent = null;
  if (!dueEvent && !chainEventId && proceduralEventCooldown <= 0 && rng.next() < 0.3) {
    const candidate = pickProceduralEvent({ ...state, nations, turnNumber: newTurnNumber, year: newYear }, rng);
    if (candidate) {
      activeProceduralEvent = candidate;
      proceduralEventCooldown = 3 + Math.floor(rng.next() * 5);
    }
  }

  // --- assemble next state ---
  let next = {
    ...state,
    year: newYear,
    age: newAge,
    turnNumber: newTurnNumber,
    resources,
    regions,
    nations,
    activeEventId: dueEvent ? dueEvent.id : chainEventId,
    activeProceduralEvent,
    proceduralEventCooldown,
    pendingEventChains: nextPendingEventChains,
    rngSeed: rng.getSeed(),
    logs: [...state.logs, ...logs]
  };

  // --- victory (checked against THIS turn's resolved state, not last turn's) ---
  // Not checked while an event is actively pending, so a victory never lands mid-event-resolution.
  if (next.gameStatus === GameStatus.ACTIVE && !next.activeEventId && !next.activeProceduralEvent) {
    const conditionId = checkVictoryConditions(next);
    if (conditionId) {
      const condition = VICTORY_CONDITIONS[conditionId];
      next = applyVictory(next, conditionId);
      next.logs = [...next.logs, { year: newYear, message: `VICTORY: ${condition.name} achieved!`, type: LogTypes.MILESTONE }];
    }
  }

  return next;
};
