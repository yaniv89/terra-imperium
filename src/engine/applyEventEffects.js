// src/engine/applyEventEffects.js
// Pure resolution of a historical-event choice: takes one state snapshot and returns one
// fully-resolved next state, so two effects touching the same key can never silently clobber
// each other the way ~12 separate dispatches from the same frozen closure once could.

import { RelationStatus, LogTypes, GameStatus } from '../data/types';
import { REGIONS_DATA } from '../data/regions';
import { WORLD_NATIONS as NATIONS_DATA } from '../data/worldNations';
import { RESOURCE_IDS } from '../data/resources';
import { declareWar, isWarBetween } from './diplomacy';
import { clampStability, clampLegitimacy, clampPrestige } from './nationalPower';
import { addNationModifier, addRegionModifier } from './modifiers/timed';
import { REBEL_OWNER_ID, getRebelSpawnStrength } from '../data/rebellion';
import { getLaw } from '../data/laws';
import { seedDevelopment } from './development';

// Plan §M17: "defenseBonus becomes a timed fort modifier" — the old value (0.05-0.1, meant as a
// percentage under the pre-M6 combat model) is scaled onto the modifier engine's FLAT
// local.fortLevel scale (real Defense buildings grant 1/2/4/6) rather than reinterpreted as a
// percentage of something fortLevel was never denominated in.
const DEFENSE_BONUS_FORT_LEVEL_SCALE = 20;
const DEFENSE_BONUS_DURATION_TURNS = 20;

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

  // Plan §M17: "defenseBonus becomes a timed fort modifier" — a real local.fortLevel entry on every
  // region the player currently owns, through the same addRegionModifier/expireRegionModifiers
  // infrastructure M1 built and nothing had called yet. This replaces the dead `eventDefenseBonus`
  // field (removed with M14) that this key used to accumulate into with no combat system reading it.
  if (effects.defenseBonus) {
    let regionModifiers = next.regionModifiers || {};
    const fortLevelBonus = Math.max(1, Math.round(effects.defenseBonus * DEFENSE_BONUS_FORT_LEVEL_SCALE));
    Object.values(next.regions).forEach((r) => {
      if (r.owner !== playerNationId) return;
      regionModifiers = addRegionModifier(regionModifiers, r.id, {
        sourceType: 'event', sourceId: event.id, label: event.title,
        mods: { 'local.fortLevel': fortLevelBonus }, duration: DEFENSE_BONUS_DURATION_TURNS, turnNumber: next.turnNumber
      });
    });
    next.regionModifiers = regionModifiers;
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
  // Plan §M17: "isOccupied-based controlPenalty now applies to regions with occupiedBy set" — M13
  // introduced real occupation (`occupiedBy`) and left `isOccupied` a stale field (cleanup in M21).
  if (effects.controlPenalty) {
    const regions = { ...next.regions };
    Object.values(regions).forEach(r => {
      if (r.owner === playerNationId && r.occupiedBy) {
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

  // Stability/legitimacy/prestige deltas (plan §M4) — event authoring content itself is M17's job,
  // but the effect keys are wired now so a `stability`/`legitimacy`/`prestige` key on a future
  // event's `effects` object works immediately rather than needing a second patch to this file.
  if ((effects.stability || effects.legitimacy || effects.prestige) && next.nations[playerNationId]) {
    const playerNation = next.nations[playerNationId];
    next.nations = {
      ...next.nations,
      [playerNationId]: {
        ...playerNation,
        stability: effects.stability ? clampStability(playerNation.stability + effects.stability) : playerNation.stability,
        legitimacy: effects.legitimacy ? clampLegitimacy(playerNation.legitimacy + effects.legitimacy) : playerNation.legitimacy,
        prestige: effects.prestige ? clampPrestige(playerNation.prestige + effects.prestige) : playerNation.prestige
      }
    };
  }

  // Plan §M17 effect vocabulary — each of these hooks into an EXISTING M3/M5/M6/M8/M9/M12/M14
  // system rather than inventing a parallel one, so the effect is exactly as real as the action a
  // player would take to get the same result manually.

  // addModifier: { id, label, mods, duration } — the first real production caller of
  // addNationModifier (src/engine/modifiers/timed.js's M1 infrastructure, unused until now).
  if (effects.addModifier && next.nations[playerNationId]) {
    next.nations = {
      ...next.nations,
      [playerNationId]: addNationModifier(next.nations[playerNationId], {
        sourceType: 'event', sourceId: event.id, label: effects.addModifier.label || event.title,
        mods: effects.addModifier.mods, duration: effects.addModifier.duration, turnNumber: next.turnNumber
      })
    };
  }

  // estateLoyalty: { estateId: delta } — loyalty is a real, drifting STORED field (processEstatesTurn
  // pulls it toward equilibrium every turn); influence is deliberately NOT wired here because it's a
  // derived snapshot recomputed fresh every turn (src/engine/estates.js's own header comment), so a
  // flat delta on it would just be silently overwritten on the very next turn.
  if (effects.estateLoyalty && next.nations[playerNationId]?.estates) {
    const player = next.nations[playerNationId];
    const estates = { ...player.estates };
    Object.entries(effects.estateLoyalty).forEach(([estateId, delta]) => {
      const estate = estates[estateId];
      if (!estate) return;
      estates[estateId] = { ...estate, loyalty: Math.max(0, Math.min(100, estate.loyalty + delta)) };
    });
    next.nations = { ...next.nations, [playerNationId]: { ...player, estates } };
  }

  // addClaim: nationId — this codebase's own claim model (src/engine/diplomacy.js's hasCasusBelli)
  // is per-NATION, not per-region as the plan's own text describes; an event reuses the exact same
  // `nation.claims` array FABRICATE_CLAIM (gameReducer.js) already writes to.
  if (effects.addClaim && next.nations[playerNationId] && !next.nations[playerNationId].claims.includes(effects.addClaim)) {
    const player = next.nations[playerNationId];
    next.nations = { ...next.nations, [playerNationId]: { ...player, claims: [...player.claims, effects.addClaim] } };
  }

  // spawnRebels: { regionId, strength } — the exact rebel-unit shape resolveTurn.js's own
  // rebellion phase creates (src/data/rebellion.js), so an event-spawned uprising is fought,
  // suppressed, or grows exactly like an organic one; a no-op if that region is already rebelling.
  if (effects.spawnRebels && next.regions[effects.spawnRebels.regionId]) {
    const { regionId, strength: givenStrength } = effects.spawnRebels;
    const alreadyRebelling = Object.values(next.units).some((u) => u.ownerId === REBEL_OWNER_ID && u.regionId === regionId);
    if (!alreadyRebelling) {
      const region = next.regions[regionId];
      const strength = givenStrength || getRebelSpawnStrength(region);
      const rebelId = `rebel_${regionId}_${next.turnNumber}`;
      next.units = {
        ...next.units,
        [rebelId]: {
          id: rebelId, regionId, ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry',
          strength, maxStrength: strength, morale: 100, movesLeft: 1,
          xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null,
          spawnedTurn: next.turnNumber
        }
      };
      next.regions = { ...next.regions, [regionId]: { ...region, control: Math.max(0, (region.control || 0) - 30) } };
    }
  }

  // ruler: { addTrait, removeTrait } — src/data/traits.js's existing 20-trait table.
  if (effects.ruler && next.nations[playerNationId]?.ruler) {
    const player = next.nations[playerNationId];
    let traits = player.ruler.traits || [];
    if (effects.ruler.removeTrait) traits = traits.filter((t) => t !== effects.ruler.removeTrait);
    if (effects.ruler.addTrait && !traits.includes(effects.ruler.addTrait)) traits = [...traits, effects.ruler.addTrait];
    next.nations = { ...next.nations, [playerNationId]: { ...player, ruler: { ...player.ruler, traits } } };
  }

  // heir: { claim: delta } — src/engine/succession.js's own 0-100 claim field.
  if (effects.heir?.claim && next.nations[playerNationId]?.heir) {
    const player = next.nations[playerNationId];
    next.nations = {
      ...next.nations,
      [playerNationId]: { ...player, heir: { ...player.heir, claim: Math.max(0, Math.min(100, player.heir.claim + effects.heir.claim)) } }
    };
  }

  // dev: { regionId, type, delta } — a direct, permanent development bump (distinct from the
  // Develop Province ACTION's ADM/DIP/MIL cost — the event itself IS the cost here).
  if (effects.dev && next.regions[effects.dev.regionId]) {
    const { regionId, type, delta } = effects.dev;
    const region = next.regions[regionId];
    const dev = region.dev || seedDevelopment(regionId);
    next.regions = { ...next.regions, [regionId]: { ...region, dev: { ...dev, [type]: Math.max(1, dev[type] + delta) } } };
  }

  // construct: { regionId, category } — grants a free tier-0 building (no gold cost, no
  // construction time — the event is the cost), only if that category isn't already built there.
  if (effects.construct && next.regions[effects.construct.regionId]) {
    const { regionId, category } = effects.construct;
    const region = next.regions[regionId];
    const categories = region.buildings?.categories || {};
    if ((categories[category] ?? -1) === -1) {
      next.regions = { ...next.regions, [regionId]: { ...region, buildings: { ...region.buildings, categories: { ...categories, [category]: 0 } } } };
    }
  }

  // law: { category, lawId } — the same field ENACT_LAW already writes; getLaw validates the id is
  // real for that category first, so a typo'd event author gets a silent no-op, not a crash.
  if (effects.law && next.nations[playerNationId] && getLaw(effects.law.category, effects.law.lawId)) {
    const player = next.nations[playerNationId];
    next.nations = { ...next.nations, [playerNationId]: { ...player, laws: { ...player.laws, [effects.law.category]: effects.law.lawId } } };
  }

  // crownLand: delta — src/engine/nationalPower.js/estates.js's existing 0-100 field.
  if (effects.crownLand && next.nations[playerNationId]) {
    const player = next.nations[playerNationId];
    next.nations = {
      ...next.nations,
      [playerNationId]: { ...player, crownLand: Math.max(0, Math.min(100, (player.crownLand ?? 50) + effects.crownLand)) }
    };
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
