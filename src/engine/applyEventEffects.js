// src/engine/applyEventEffects.js
// Pure resolution of a historical-event choice: takes one state snapshot and returns one
// fully-resolved next state, so two effects touching the same key can never silently clobber
// each other the way ~12 separate dispatches from the same frozen closure once could.

import { RelationStatus, LogTypes, GameStatus } from '../data/types';
import { REGIONS_DATA } from '../data/regions';
import { WORLD_NATIONS as NATIONS_DATA } from '../data/worldNations';
import { RESOURCE_IDS } from '../data/resources';
import { declareWar, isWarBetween } from './diplomacy';

export const applyEventEffects = (state, event, optionIndex) => {
  const option = event.options[optionIndex];
  if (!option) return state;

  let next = { ...state };
  const logs = [];
  const effects = option.effects || {};
  const playerNationId = next.playerNationId;

  // Generic resource deltas — any of gold/hr/copper/iron/oil/rareMetals/helium3, whichever ones
  // are currently unlocked and present on state.resources.
  const resources = { ...next.resources };
  RESOURCE_IDS.forEach(id => {
    if (effects[id] && resources[id] !== undefined) resources[id] += effects[id];
  });
  if (effects.dip) resources.dip = (resources.dip || 0) + effects.dip;
  if (effects.techPoints) resources.techPoints = (resources.techPoints || 0) + effects.techPoints;
  next.resources = resources;

  // A flat bump to the player nation's military stat — the finer-grained unit-composition system
  // (plan §7) is Phase C work; this is the generic placeholder until then.
  if (effects.militaryStrengthBonus && next.nations[playerNationId]) {
    next.nations = {
      ...next.nations,
      [playerNationId]: {
        ...next.nations[playerNationId],
        militaryStrength: next.nations[playerNationId].militaryStrength + effects.militaryStrengthBonus
      }
    };
  }

  // Applied to combat as a persistent defense multiplier (Phase C) — carried on state so it
  // survives until the combat system that consumes it exists.
  if (effects.defenseBonus) {
    next.eventDefenseBonus = (next.eventDefenseBonus || 0) + effects.defenseBonus;
  }

  if (effects.controlBonus) {
    const regions = { ...next.regions };
    Object.values(regions).forEach(r => {
      if (r.owner === playerNationId) {
        regions[r.id] = { ...r, control: Math.min(100, r.control + effects.controlBonus) };
      }
    });
    next.regions = regions;
  }
  if (effects.controlPenalty) {
    const regions = { ...next.regions };
    Object.values(regions).forEach(r => {
      if (r.owner === playerNationId && r.isOccupied) {
        regions[r.id] = { ...r, control: Math.max(0, r.control - effects.controlPenalty) };
      }
    });
    next.regions = regions;
  }

  if (effects.captureRegions) {
    const regions = { ...next.regions };
    effects.captureRegions.forEach(rId => {
      if (regions[rId]) {
        regions[rId] = {
          ...regions[rId],
          owner: playerNationId,
          control: 80,
          isOccupied: true,
          underInvasion: false
        };
      }
    });
    next.regions = regions;
  }

  if (effects.returnRegion && next.regions[effects.returnRegion]?.owner === playerNationId) {
    const origOwner = REGIONS_DATA[effects.returnRegion]?.startOwner;
    if (origOwner) {
      next.regions = {
        ...next.regions,
        [effects.returnRegion]: {
          ...next.regions[effects.returnRegion],
          owner: origOwner,
          control: 100,
          isOccupied: false
        }
      };
    }
  }

  if (effects.peaceWith) {
    const ids = Array.isArray(effects.peaceWith) ? effects.peaceWith : [effects.peaceWith];
    const nations = { ...next.nations };
    const wars = [...next.wars];
    let invasions = next.invasions;
    ids.forEach(nId => {
      if (!nations[nId]) return;
      nations[nId] = {
        ...nations[nId],
        isAtWar: false,
        hostility: 20,
        relationStatus: RelationStatus.COLD_PEACE,
        hasPeaceTreaty: true
      };
      // The war record names an aggressor and an enemy, not "the player's side" — the AI could
      // have declared this war on the player just as easily as the reverse. Either way the
      // player's own isAtWar must clear too, or aiLogic.js's pickWarTarget (which filters out any
      // nation still flagged isAtWar) would make the player permanently immune to future wars.
      if (nations[playerNationId]) nations[playerNationId] = { ...nations[playerNationId], isAtWar: false };
      for (let i = 0; i < wars.length; i++) {
        if (isWarBetween(wars[i], playerNationId, nId)) wars[i] = { ...wars[i], active: false };
      }
      invasions = invasions.filter(inv => !(inv.attackerNation === nId && inv.attackerNation !== playerNationId));
      logs.push({ year: next.year, message: `PEACE signed with ${NATIONS_DATA[nId]?.name}!`, type: LogTypes.MILESTONE });
    });
    next.nations = nations;
    next.wars = wars;
    next.invasions = invasions;
  }

  if (effects.tradeWith) {
    const ids = Array.isArray(effects.tradeWith) ? effects.tradeWith : [effects.tradeWith];
    const nations = { ...next.nations };
    ids.forEach(nId => {
      if (!nations[nId]) return;
      nations[nId] = {
        ...nations[nId],
        hasTradeAgreement: true,
        hostility: Math.max(0, nations[nId].hostility - 10),
        relationStatus: RelationStatus.FRIENDLY
      };
      logs.push({ year: next.year, message: `Trade agreement with ${NATIONS_DATA[nId]?.name}!`, type: LogTypes.DIPLOMACY });
    });
    next.nations = nations;
  }

  if (effects.warWith) {
    const ids = Array.isArray(effects.warWith) ? effects.warWith : [effects.warWith];
    ids.forEach(nId => {
      if (!next.nations[nId] || next.nations[nId].isAtWar) return;
      next = declareWar(next, nId, { aggressor: playerNationId });
      logs.push({ year: next.year, message: `WAR declared on ${NATIONS_DATA[nId]?.name}!`, type: LogTypes.CRISIS });
    });
  }

  // Generic per-nation hostility nudge — procedural events target a specific nation without
  // needing a one-off effect key per template (see src/data/proceduralEvents.js).
  if (effects.nationHostility) {
    const nations = { ...next.nations };
    Object.entries(effects.nationHostility).forEach(([nId, delta]) => {
      if (!nations[nId]) return;
      nations[nId] = { ...nations[nId], hostility: Math.max(0, Math.min(100, nations[nId].hostility + delta)) };
    });
    next.nations = nations;
  }

  // Event chains with memory — schedules a registry entry from eventChains.js to fire delayTurns
  // turns from now (see resolveTurn.js, which checks state.pendingEventChains every turn).
  // turnNumber, not year, is the clock here so the delay is exact regardless of game speed.
  if (effects.spawnFollowUp) {
    const { id, delayTurns } = effects.spawnFollowUp;
    next.pendingEventChains = [
      ...(next.pendingEventChains || []),
      { id, dueTurn: next.turnNumber + delayTurns }
    ];
  }

  if (effects.victory) {
    next.gameStatus = GameStatus.VICTORY;
    next.victoryConditionId = 'survival';
    logs.push({ year: next.year, message: 'VICTORY!', type: LogTypes.MILESTONE });
  }

  logs.push({ year: next.year, message: `Event: ${event.title} → ${option.label}`, type: LogTypes.EVENT });

  next.logs = [...next.logs, ...logs];
  next.activeEventId = null;
  // Procedural events never populate activeEventId — they're carried in activeProceduralEvent
  // instead (see resolveTurn.js) — so this clear is a no-op for a scripted event and the one that
  // actually dismisses a procedural one.
  next.activeProceduralEvent = null;
  next.firedEvents = { ...next.firedEvents, [event.id]: true };

  return next;
};
