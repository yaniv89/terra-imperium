// src/engine/applyEventEffects.js
// Pure resolution of a historical-event choice. Previously this lived in GameContext's
// resolveEvent() as ~12 separate dispatches, each computed from the same frozen `state`
// closure — non-atomic, and any two effects touching the same key would silently drop one.
// This function takes one state snapshot and returns one fully-resolved next state.

import { RelationStatus, LogTypes, GameStatus } from '../data/types';
import { REGIONS_DATA } from '../data/regions';
import { NATIONS_DATA } from '../data/nations';
import { addUnits } from '../utils/helpers';
import { declareWar } from './diplomacy';

export const applyEventEffects = (state, event, optionIndex) => {
  const option = event.options[optionIndex];
  if (!option) return state;

  let next = { ...state };
  const logs = [];
  const effects = option.effects || {};

  const resources = { ...next.resources };
  if (effects.money) resources.money += effects.money;
  if (effects.manpower) resources.manpower += effects.manpower;
  if (effects.diplomacyPoints) resources.diplomacyPoints += effects.diplomacyPoints;
  if (effects.techPoints) resources.techPoints += effects.techPoints;
  next.resources = resources;

  if (effects.undergroundBonus) {
    next.undergroundStrength = Math.max(0, next.undergroundStrength + effects.undergroundBonus);
  }
  if (effects.militaryBonus) {
    // Event-granted military bonuses land as infantry — there's no finer-grained composition
    // signal in the event data, and infantry is the safest generic "more army" bucket.
    next.militaryUnits = addUnits(next.militaryUnits, { infantry: effects.militaryBonus });
  }

  // Applied to combat as a persistent defense multiplier (see resolveTurn.js) — previously
  // events like the Bar-Lev Line / security barrier advertised "+20% Defense" in the UI and
  // it was never actually consumed anywhere.
  if (effects.defenseBonus) {
    next.eventDefenseBonus = (next.eventDefenseBonus || 0) + effects.defenseBonus;
  }

  if (effects.controlBonus) {
    const regions = { ...next.regions };
    Object.values(regions).forEach(r => {
      if (r.owner === 'player') {
        regions[r.id] = { ...r, control: Math.min(100, r.control + effects.controlBonus) };
      }
    });
    next.regions = regions;
  }
  if (effects.controlPenalty) {
    const regions = { ...next.regions };
    Object.values(regions).forEach(r => {
      if (r.owner === 'player' && r.isOccupied) {
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
          owner: 'player',
          control: 80,
          isOccupied: true,
          underInvasion: false
        };
      }
    });
    next.regions = regions;
  }

  if (effects.returnRegion && next.regions[effects.returnRegion]?.owner === 'player') {
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
      for (let i = 0; i < wars.length; i++) {
        if (wars[i].enemy === nId) wars[i] = { ...wars[i], active: false };
      }
      invasions = invasions.filter(inv => !(inv.attackerNation === nId && !inv.isPlayerAttacker));
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
      next = declareWar(next, nId);
      logs.push({ year: next.year, message: `WAR declared on ${NATIONS_DATA[nId]?.name}!`, type: LogTypes.CRISIS });
    });
  }

  if (effects.canDeclareIndependence) {
    logs.push({ year: next.year, message: 'Independence is now possible! Declare when ready.', type: LogTypes.MILESTONE });
  }

  if (effects.victory) {
    next.gameStatus = GameStatus.VICTORY;
    logs.push({ year: next.year, message: 'VICTORY: Israel has led humanity to the stars!', type: LogTypes.MILESTONE });
  }

  logs.push({ year: next.year, message: `Event: ${event.title} → ${option.label}`, type: LogTypes.EVENT });

  next.logs = [...next.logs, ...logs];
  next.activeEventId = null;
  next.firedEvents = { ...next.firedEvents, [event.id]: true };

  return next;
};
