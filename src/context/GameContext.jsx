// src/context/GameContext.jsx
// Game state management using React Context and useReducer.
//
// Turn resolution and event resolution are delegated to pure functions in src/engine/ —
// the reducer's job is validation + a single atomic state transition per dispatch.

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { GameStatus, ActionTypes, RelationStatus, LogTypes, TechCategories } from '../data/types';
import { REGIONS_DATA, getNeighborIds, isAdjacentToOwner } from '../data/regions';
import { WORLD_NATIONS } from '../data/worldNations';
import { TECH_TREE, canResearchTech, getTechsForAge, TECH_AGE_ADVANCEMENT_THRESHOLD } from '../data/techTree';
import { GOVERNMENT_TYPES, canAdoptGovernment } from '../data/government';
import { POLICIES } from '../data/policies';
import { declareWar, hasCasusBelli } from '../engine/diplomacy';
import { HISTORICAL_EVENTS } from '../data/events';
import { EVENT_CHAINS } from '../data/eventChains';
import { START_YEAR, getCalendarAgeId, getEffectiveAgeId, AGE_ORDER, AGES } from '../data/ages';
import { createEmptyResourcePool } from '../data/resources';
import { createEmptyRegionBuildings, canBuildTier, canBuildExtraction } from '../data/buildings';
import { hasDeposit } from '../data/deposits';
import { getAvailableClasses } from '../data/unitClasses';
import {
  ACTION_COSTS, DISBAND_HR_REFUND_RATIO, FUND_SCHOLARS_TECHPOINTS,
  SUE_FOR_PEACE_MIN_GOLD, SUE_FOR_PEACE_BASE_GOLD, GIFT_HOSTILITY_REDUCTION,
  UNJUSTIFIED_WAR_GLOBAL_HOSTILITY, UNJUSTIFIED_WAR_HOME_UNREST, ALLIANCE_HOSTILITY_CEILING,
  SETTLE_COLONIZE_CONTROL_THRESHOLD, SETTLE_COLONIZE_START_CONTROL, SETTLE_COLONIZE_START_UNREST,
  POPULATION_POLICY_GROWTH_RATE
} from '../data/actionCosts';
import { resolveTurn } from '../engine/resolveTurn';
import { applyEventEffects } from '../engine/applyEventEffects';
import { resolveBattle } from '../engine/battle';
import { awardXp, canPromote, getPerk } from '../data/promotions';
import { generateGeneral, getGeneralXpMultiplier } from '../data/generals';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD } from '../data/rebellion';
import { randomSeed, createRng } from '../utils/rng';
import { ACHIEVEMENTS, checkAchievements } from '../data/achievements';
import { applyStartingDoctrine } from '../data/startingDoctrines';
import { applyDifficulty } from '../data/difficulty';
import { canAfford, applyCosts } from '../utils/helpers';
import { WONDERS, canConstructWonder } from '../data/wonders';
import { TAX_RATE_IDS, DEFAULT_TAX_RATE } from '../data/taxRates';
import { loadMeta, saveMeta } from '../utils/metaProgression';

// How many land units one naval unit can carry (plan §7.5's Embark/Disembark).
const NAVAL_TRANSPORT_CAPACITY = 2;
// Amphibious assault penalty (plan §7.5): attacking from the sea with no existing foothold takes
// a combat malus. Once the attacker holds a region adjacent to the target, further attacks staged
// from that beachhead are normal.
const AMPHIBIOUS_PENALTY_MULT = 0.75;

// ============ PERSISTENCE ============
const STORAGE_KEY = 'terra-imperium-save-v1';
const SAVE_VERSION = 1;

// Any of the 240 nations works as a fallback default — only used when no explicit choice (from
// the country-select start screen) or saved game is present yet.
const DEFAULT_PLAYER_NATION_ID = 'us';

const formatYear = (year) => (year < 0 ? `${-year} BCE` : `${year} CE`);

// ============ INITIAL STATE FACTORY ============
// Exported (not just used internally) so it doubles as test fixture data — resolveTurn.test.js
// and applyEventEffects.test.js build realistic states from it rather than hand-rolling partial
// mocks that could silently drift from the real shape.
export const createInitialState = ({ playerNationId = DEFAULT_PLAYER_NATION_ID, gameSpeed = 'normal' } = {}) => {
  const year = START_YEAR;
  const age = getCalendarAgeId(year);

  // Every one of the 240 nations starts owning exactly its own territory at full control — see
  // src/data/regions.js.
  const regions = {};
  Object.entries(REGIONS_DATA).forEach(([id, data]) => {
    regions[id] = {
      id,
      owner: data.startOwner,
      control: data.startControl,
      currentPopulation: data.population,
      currentInfrastructure: data.infrastructure,
      underInvasion: false,
      isOccupied: false,
      buildings: createEmptyRegionBuildings(),
      // Unrest (plan §9): 0 = fully calm. Drifts each turn based on control% (resolveTurn.js) and
      // can be pushed down directly via the Quell Unrest action. Every nation starts at full
      // control of its own territory, so unrest starts at 0 rather than needing a curve.
      unrest: 0,
      // Built-up defense from the Build Defenses action — separate from REGIONS_DATA's static
      // `fortification` seed value; Phase C's combat system will read both once it exists.
      defenseLevel: 0
    };
  });

  // Every one of the 240 nations gets a record — any of them can be the player's.
  const nations = {};
  Object.entries(WORLD_NATIONS).forEach(([id, data]) => {
    nations[id] = {
      id,
      name: data.name,
      color: data.color,
      isPlayer: id === playerNationId,
      hostility: data.startHostility,
      militaryStrength: data.startMilitary,
      aggression: data.aggression,
      doctrine: data.doctrine || 'attrition',
      relationStatus: RelationStatus.NEUTRAL,
      isAtWar: false,
      hasPeaceTreaty: false,
      hasTradeAgreement: false,
      hasMilitaryPact: false,
      // Permanent floor hostility decay can't cross below, set once a peace treaty with this
      // nation is broken by a new war — see src/engine/diplomacy.js declareWar().
      hostilityFloor: 0,

      // Government & policies (plan §9) — every nation gets these fields so resolveTurn.js's
      // stability pass can read any nation's bonus generically, but only the player can change
      // them via ADOPT_GOVERNMENT/ADOPT_POLICY today; AI adoption is Task 23's job.
      government: null,
      policies: [],
      // World Wonders this nation has completed (Construct Wonder) — same getNationBonusTotal
      // hooks as government/policies (src/utils/helpers.js). Every nation carries the field so
      // that helper can read it generically, though only the player can build one today.
      wonders: [],
      // Set Tax Rate (plan §5) — every nation gets a rate so calcIncome/nextUnrest can read any
      // nation's generically; only the player can change theirs today.
      taxRate: DEFAULT_TAX_RATE,

      // Diplomacy (plan §11's nation data model: "+ warExhaustion, legitimacy, claims[], vassals[]")
      // — claims make a later DECLARE_WAR against that nation justified (FABRICATE_CLAIM);
      // warExhaustion rises every turn a nation is at war and decays at peace (resolveTurn.js),
      // making a long war's eventual SUE_FOR_PEACE cheaper. vassals[] is scaffolded now (an empty
      // array every nation carries) for the Vassalize/Release action a later task adds.
      claims: [],
      warExhaustion: 0,
      vassals: []
    };
  });

  // Initialize tech tree (currently empty content — see src/data/techTree.js).
  const techTree = {};
  Object.entries(TECH_TREE).forEach(([id, data]) => {
    techTree[id] = { id, researched: false, available: data.yearAvailable <= year };
  });

  return {
    // Identity
    playerNationId,

    // Time
    year,
    age,
    // The nation's tech-earned age (plan §2) — starts equal to the calendar age; RESEARCH_TECH
    // advances it once enough of its current age's tech line is researched. Never used directly
    // for gating; src/data/ages.js's getEffectiveAgeId(age, techAgeId) is what buildings/units/
    // extraction actually read, capped at one age ahead of the calendar. See techTree.js's file
    // header for what this currently does and doesn't unlock beyond Phase B's existing rush rule.
    techAgeId: age,
    gameSpeed,
    turnNumber: 1,
    gameStatus: GameStatus.ACTIVE,
    // Which VICTORY_CONDITIONS entry ended the game, if any.
    victoryConditionId: null,
    // Difficulty select — 'prince' is fully symmetrical (a no-op multiplier), matching
    // DIFFICULTIES.prince.
    difficultyId: 'prince',
    difficultyMultiplier: 1,

    // Resources — Gold/HR always present; Copper/Iron/Oil (and later Rare Metals/Helium-3) join
    // as their age unlocks (see src/data/resources.js). diplomacyPoints/techPoints/actionPoints
    // are meta-currencies, not age-gated resources.
    resources: {
      ...createEmptyResourcePool(age),
      gold: 500,
      hr: 100,
      diplomacyPoints: 20,
      techPoints: 0,
      actionPoints: 3,
      maxActionPoints: 3
    },

    // World state
    regions,
    nations,
    techTree,
    // Set Research Focus (Research tab) — which TechCategory the nation is committing research
    // effort toward; null until first set. See helpers.js's calcIncome for its effect.
    researchFocus: null,

    // Per-region armies (plan §7) — a flat dict keyed by unit id, not nested under regions, since
    // units move between regions over their lifetime. See src/data/unitClasses.js for the class/
    // roster data a unit's classId/ageId reference.
    units: {},
    nextUnitSeq: 0,

    // Wars and invasions — the combat/invasion resolution engine that reads these is Phase C work.
    wars: [],
    invasions: [],
    nextInvasionSeq: 0,
    counterAttackWindows: {},

    // Generals (plan §7) — a flat dict keyed by id, mirroring state.units. A general is assigned
    // to a single unit via that unit's own commanderId (see src/data/generals.js).
    hiredCommanders: {},
    nextCommanderSeq: 0,

    // Set by LAUNCH_INVASION to the itemized phase-by-phase result of the most recent battle (see
    // src/engine/battle.js) — read by the UI for an after-action report, never by the reducer.
    lastBattleReport: null,

    // Events
    activeEventId: null,
    activeProceduralEvent: null,
    proceduralEventCooldown: 0,
    pendingEventChains: [],
    firedEvents: {},

    // Persistent effect from event choices, applied to combat once combat exists again (Phase C).
    eventDefenseBonus: 0,

    // Construct Wonder (plan §5/§6) — { wonderId: builderNationId }, checked by
    // src/data/wonders.js's canConstructWonder so a wonder can only ever be finished once,
    // globally, no matter which nation gets there first.
    wondersBuilt: {},

    // Deterministic turn resolution — see src/utils/rng.js
    rngSeed: randomSeed(),

    // Logs
    logs: [
      { year, message: `${formatYear(year)}: Your nation's story begins.`, type: LogTypes.MILESTONE }
    ]
  };
};

// Lazily load a saved game, falling back to a fresh one. Old/corrupt/foreign-shaped saves are
// merged over a fresh default state so a missing field never crashes the app.
const loadOrCreateState = () => {
  const fresh = createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== SAVE_VERSION || !saved.state) return fresh;
    return { ...fresh, ...saved.state };
  } catch (e) {
    return fresh;
  }
};

// Pure, side-effect-visible-only-via-read check: true if a save already exists. Used by the app
// shell to decide whether to show the country-select/difficulty/speed start screen (a brand new
// player, or one whose save is gone) or go straight to GameLayout.
export const hasExistingSave = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch (e) {
    return false;
  }
};

// ============ REDUCER ============
// Exported for direct unit testing (see GameContext.test.js) — the reducer is the authoritative
// validation point for every player action, so it should be testable without mounting React.
export const gameReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.ADVANCE_TURN:
      return resolveTurn(state);

    case ActionTypes.FAST_FORWARD: {
      // Fast-forward: repeatedly resolves turns within a single atomic dispatch, so the component
      // doesn't need to loop across async re-renders. Stops the moment there's a decision worth
      // the player's attention — an event becomes active, a war starts or ends, the game ends —
      // or a turn cap is hit, so a single click can't silently skip to the end of the game.
      const MAX_TURNS = 20;
      const countWars = (s) => Object.values(s.nations).filter(n => n.isAtWar).length;
      let current = state;
      const startingWarCount = countWars(current);
      for (let i = 0; i < MAX_TURNS; i++) {
        const next = resolveTurn(current);
        if (next === current) break; // resolveTurn's own no-op guard (event pending / game over)
        current = next;
        if (current.gameStatus !== GameStatus.ACTIVE) break;
        if (current.activeEventId || current.activeProceduralEvent) break;
        if (countWars(current) !== startingWarCount) break;
      }
      return current;
    }

    case ActionTypes.RESOLVE_EVENT: {
      // A procedural event is never in HISTORICAL_EVENTS — it's carried in full on the state
      // itself since it was generated fresh, not looked up from a static registry. A chain event
      // IS looked up by id, but from EVENT_CHAINS rather than HISTORICAL_EVENTS.
      const event = state.activeEventId
        ? (HISTORICAL_EVENTS[state.activeEventId] || EVENT_CHAINS[state.activeEventId])
        : state.activeProceduralEvent;
      if (!event) return state;
      return applyEventEffects(state, event, action.payload.optionIndex);
    }

    // ---- Domestic tab (plan §5) — atomic, cost-validated player actions ----

    case ActionTypes.GAIN_CONTROL: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.gainControl;
      if (!region || region.owner !== state.playerNationId || region.control >= 100) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, control: Math.min(100, region.control + 5) } },
        logs: [...state.logs, { year: state.year, message: `Gained control in ${REGIONS_DATA[regionId]?.name}. Control +5%`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_INFRASTRUCTURE: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.buildInfrastructure;
      if (!region || region.owner !== state.playerNationId || region.currentInfrastructure >= 10) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, currentInfrastructure: region.currentInfrastructure + 1 } },
        logs: [...state.logs, { year: state.year, message: `Built infrastructure in ${REGIONS_DATA[regionId]?.name}. Level ${region.currentInfrastructure + 1}`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_DEFENSES: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.buildDefenses;
      if (!region || region.owner !== state.playerNationId || region.defenseLevel >= 10) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, defenseLevel: region.defenseLevel + 1 } },
        logs: [...state.logs, { year: state.year, message: `Built defenses in ${REGIONS_DATA[regionId]?.name}. Level ${region.defenseLevel + 1}`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.CONSTRUCT_BUILDING: {
      const { regionId, categoryId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.constructBuilding;
      if (!region || region.owner !== state.playerNationId) return state;
      const currentTier = region.buildings.categories[categoryId];
      if (currentTier === undefined) return state; // unknown category
      const nextTier = currentTier + 1;
      if (!canBuildTier(categoryId, getEffectiveAgeId(state.age, state.techAgeId), nextTier)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: {
          ...state.regions,
          [regionId]: {
            ...region,
            buildings: { ...region.buildings, categories: { ...region.buildings.categories, [categoryId]: nextTier } }
          }
        },
        logs: [...state.logs, { year: state.year, message: `Constructed a new building in ${REGIONS_DATA[regionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DEVELOP_RESOURCE_SITE: {
      const { regionId, resourceId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.developResourceSite;
      if (!region || region.owner !== state.playerNationId) return state;
      if (region.buildings.extraction[resourceId] === undefined || region.buildings.extraction[resourceId]) return state;
      if (!hasDeposit(regionId, resourceId) || !canBuildExtraction(resourceId, getEffectiveAgeId(state.age, state.techAgeId))) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: {
          ...state.regions,
          [regionId]: {
            ...region,
            buildings: { ...region.buildings, extraction: { ...region.buildings.extraction, [resourceId]: true } }
          }
        },
        logs: [...state.logs, { year: state.year, message: `Developed a ${resourceId} extraction site in ${REGIONS_DATA[regionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.QUELL_UNREST: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.quellUnrest;
      if (!region || region.owner !== state.playerNationId || region.unrest <= 0) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, unrest: Math.max(0, region.unrest - 30) } },
        logs: [...state.logs, { year: state.year, message: `Quelled unrest in ${REGIONS_DATA[regionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.SETTLE_COLONIZE: {
      // Peacefully absorbs a bordering nation's own homeland once its control there has
      // collapsed below SETTLE_COLONIZE_CONTROL_THRESHOLD — the "minimally-held adjacent land"
      // the plan describes, adapted to a one-region-per-nation world with no literal unowned
      // territory. No military required, unlike LAUNCH_INVASION.
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.settleColonize;
      if (!region || region.owner === state.playerNationId) return state;
      if (region.control >= SETTLE_COLONIZE_CONTROL_THRESHOLD) return state;
      if (!isAdjacentToOwner(regionId, state.regions, state.playerNationId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: {
          ...state.regions,
          [regionId]: { ...region, owner: state.playerNationId, control: SETTLE_COLONIZE_START_CONTROL, unrest: Math.max(region.unrest || 0, SETTLE_COLONIZE_START_UNREST) }
        },
        logs: [...state.logs, { year: state.year, message: `Settlers peacefully absorbed ${REGIONS_DATA[regionId]?.name}, whose own control there had collapsed.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.POPULATION_POLICY: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.populationPolicy;
      if (!region || region.owner !== state.playerNationId) return state;
      if (!canAfford(state.resources, costs)) return state;
      const nextPopulation = Math.round((region.currentPopulation || 1) * (1 + POPULATION_POLICY_GROWTH_RATE));
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, currentPopulation: nextPopulation } },
        logs: [...state.logs, { year: state.year, message: `Population growth invested in ${REGIONS_DATA[regionId]?.name} — now ${nextPopulation.toLocaleString()}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.SET_TAX_RATE: {
      const { rate } = action.payload;
      const costs = ACTION_COSTS.setTaxRate;
      const nation = state.nations[state.playerNationId];
      if (!TAX_RATE_IDS.includes(rate) || nation.taxRate === rate) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [state.playerNationId]: { ...nation, taxRate: rate } },
        logs: [...state.logs, { year: state.year, message: `Tax rate set to ${rate}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.CONSTRUCT_WONDER: {
      // Empire-wide, not region-scoped — a Wonder is one permanent bonus for the whole nation
      // (plan §5's "permanent empire bonus"), not tied to the region it was raised in.
      const { wonderId } = action.payload;
      const costs = ACTION_COSTS.constructWonder;
      const effectiveAge = getEffectiveAgeId(state.age, state.techAgeId);
      if (!canConstructWonder(wonderId, effectiveAge, state.wondersBuilt)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const nation = state.nations[state.playerNationId];
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        wondersBuilt: { ...state.wondersBuilt, [wonderId]: state.playerNationId },
        nations: { ...state.nations, [state.playerNationId]: { ...nation, wonders: [...(nation.wonders || []), wonderId] } },
        logs: [...state.logs, { year: state.year, message: `${WONDERS[wonderId]?.name} completed!`, type: LogTypes.MILESTONE }]
      };
    }

    // ---- Military tab (plan §7) — per-region armies ----

    case ActionTypes.RECRUIT_UNIT: {
      const { regionId, classId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.recruitUnit;
      if (!region || region.owner !== state.playerNationId) return state;
      if (!getAvailableClasses(getEffectiveAgeId(state.age, state.techAgeId)).includes(classId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const unitId = `unit_${state.nextUnitSeq}`;
      const isNaval = classId === 'naval';
      const newUnit = {
        id: unitId,
        regionId,
        ownerId: state.playerNationId,
        domain: isNaval ? 'naval' : 'land',
        classId,
        ageId: state.age,
        strength: 1000,
        maxStrength: 1000,
        morale: 100,
        organization: 100,
        xp: 0,
        rank: 'recruit',
        promotions: [],
        commanderId: null,
        // Naval-only: how many land units it can carry (plan §7.5's Embark/Disembark). Land-only:
        // which naval unit currently carries it, if any — set by EMBARK_UNIT/AMPHIBIOUS_ASSAULT.
        transportCapacity: isNaval ? NAVAL_TRANSPORT_CAPACITY : null,
        embarkedOn: null
      };
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [unitId]: newUnit },
        nextUnitSeq: state.nextUnitSeq + 1,
        logs: [...state.logs, { year: state.year, message: `Recruited a new ${classId} unit in ${REGIONS_DATA[regionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DISBAND_UNIT: {
      const { unitId } = action.payload;
      const unit = state.units[unitId];
      if (!unit || unit.ownerId !== state.playerNationId) return state;
      const refundHr = Math.round(ACTION_COSTS.recruitUnit.hr * DISBAND_HR_REFUND_RATIO);
      const remainingUnits = { ...state.units };
      delete remainingUnits[unitId];
      // Disbanding a transport strands its cargo in place rather than sinking it with the ship.
      if (unit.domain === 'naval') {
        Object.values(remainingUnits).forEach(u => {
          if (u.embarkedOn === unitId) remainingUnits[u.id] = { ...u, embarkedOn: null };
        });
      }
      return {
        ...state,
        resources: { ...state.resources, hr: (state.resources.hr || 0) + refundHr },
        units: remainingUnits,
        logs: [...state.logs, { year: state.year, message: `Disbanded a ${unit.classId} unit. +${refundHr} HR`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.MOVE_ARMY: {
      const { unitId, toRegionId } = action.payload;
      const unit = state.units[unitId];
      const costs = ACTION_COSTS.moveArmy;
      if (!unit || unit.ownerId !== state.playerNationId) return state;
      if (unit.embarkedOn) return state; // embarked units move with their transport, not on their own
      const isLandAdjacent = getNeighborIds(unit.regionId).includes(toRegionId);
      const isSeaLaneReachable = unit.domain === 'naval' && isReachableBySea(unit.regionId, toRegionId, state.age);
      if (!isLandAdjacent && !isSeaLaneReachable) return state;
      if (!canAfford(state.resources, costs)) return state;
      const nextUnits = { ...state.units, [unitId]: { ...unit, regionId: toRegionId } };
      // A transport takes its embarked cargo along with it.
      Object.values(state.units).forEach(u => {
        if (u.embarkedOn === unitId) nextUnits[u.id] = { ...u, regionId: toRegionId };
      });
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: nextUnits,
        logs: [...state.logs, { year: state.year, message: `Moved a ${unit.classId} unit to ${REGIONS_DATA[toRegionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.EMBARK_UNIT: {
      const { landUnitId, navalUnitId } = action.payload;
      const landUnit = state.units[landUnitId];
      const navalUnit = state.units[navalUnitId];
      const costs = ACTION_COSTS.embarkUnit;
      if (!landUnit || landUnit.ownerId !== state.playerNationId || landUnit.domain !== 'land' || landUnit.embarkedOn) return state;
      if (!navalUnit || navalUnit.ownerId !== state.playerNationId || navalUnit.domain !== 'naval') return state;
      if (landUnit.regionId !== navalUnit.regionId) return state;
      const cargoCount = Object.values(state.units).filter(u => u.embarkedOn === navalUnitId).length;
      if (cargoCount >= navalUnit.transportCapacity) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [landUnitId]: { ...landUnit, embarkedOn: navalUnitId } },
        logs: [...state.logs, { year: state.year, message: `A ${landUnit.classId} unit embarked for transport.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DISEMBARK_UNIT: {
      const { landUnitId } = action.payload;
      const landUnit = state.units[landUnitId];
      const costs = ACTION_COSTS.disembarkUnit;
      if (!landUnit || landUnit.ownerId !== state.playerNationId || !landUnit.embarkedOn) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [landUnitId]: { ...landUnit, embarkedOn: null } },
        logs: [...state.logs, { year: state.year, message: `A ${landUnit.classId} unit disembarked at ${REGIONS_DATA[landUnit.regionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.LAUNCH_INVASION: {
      const { fromRegionId, targetRegionId } = action.payload;
      const fromRegion = state.regions[fromRegionId];
      const targetRegion = state.regions[targetRegionId];
      const costs = ACTION_COSTS.launchInvasion;
      if (!fromRegion || fromRegion.owner !== state.playerNationId) return state;
      if (!targetRegion || targetRegion.owner === state.playerNationId) return state;
      if (!getNeighborIds(fromRegionId).includes(targetRegionId)) return state;
      if (!canAfford(state.resources, costs)) return state;

      const attackerUnits = Object.values(state.units).filter(u => u.regionId === fromRegionId && u.ownerId === state.playerNationId && u.domain === 'land');
      if (attackerUnits.length === 0) return state;
      const defenderUnits = Object.values(state.units).filter(u => u.regionId === targetRegionId && u.domain === 'land');

      const rng = createRng(state.rngSeed);
      const { outcome, attackerUnits: resolvedAttackers, defenderUnits: resolvedDefenders, report } = resolveBattle({
        attackerUnits,
        defenderUnits,
        terrain: REGIONS_DATA[targetRegionId]?.terrain,
        isAttackingFortification: (targetRegion.defenseLevel || 0) > 0,
        rng,
        generals: state.hiredCommanders
      });

      // Only units actually deployed to the front line fought and earn XP; the winning side earns
      // more than the losing side, a draw splits the difference. A Logistician-commanded unit
      // earns extra on top (see src/data/generals.js).
      const XP_WIN = 30;
      const XP_LOSE = 15;
      const attackerXpAmount = outcome === 'attacker' ? XP_WIN : outcome === 'defender' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
      const defenderXpAmount = outcome === 'defender' ? XP_WIN : outcome === 'attacker' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
      const awardBattleXp = (units, deployedIds, xpAmount) => units.map(u => {
        if (!deployedIds.includes(u.id)) return u;
        const gained = Math.round(xpAmount * getGeneralXpMultiplier(state.hiredCommanders[u.commanderId]));
        return awardXp(u, gained);
      });
      const xpAttackers = awardBattleXp(resolvedAttackers, report.deployedAttackerIds, attackerXpAmount);
      const xpDefenders = awardBattleXp(resolvedDefenders, report.deployedDefenderIds, defenderXpAmount);

      const nextUnits = { ...state.units };
      // Attacker survivors move into the target region on a win, otherwise fall back to where
      // they started; either way, units reduced to zero strength are destroyed and removed.
      xpAttackers.forEach(u => {
        if (u.strength <= 0) { delete nextUnits[u.id]; return; }
        nextUnits[u.id] = { ...u, regionId: outcome === 'attacker' ? targetRegionId : fromRegionId };
      });
      // A captured region's garrison doesn't remain a coherent defending force — on an attacker
      // win the whole defending side is cleared, survivors and routed alike.
      xpDefenders.forEach(u => {
        if (outcome === 'attacker' || u.strength <= 0) { delete nextUnits[u.id]; return; }
        nextUnits[u.id] = u;
      });

      const nextRegions = { ...state.regions };
      if (outcome === 'attacker') {
        nextRegions[targetRegionId] = {
          ...targetRegion,
          owner: state.playerNationId,
          control: 25,
          unrest: Math.max(targetRegion.unrest || 0, 50)
        };
      }

      const outcomeMessage = outcome === 'attacker'
        ? `Your forces captured ${REGIONS_DATA[targetRegionId]?.name} from ${state.nations[targetRegion.owner]?.name || targetRegion.owner}.`
        : outcome === 'defender'
          ? `Your invasion of ${REGIONS_DATA[targetRegionId]?.name} was repelled.`
          : `Your invasion of ${REGIONS_DATA[targetRegionId]?.name} ended in a mutual withdrawal.`;

      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: nextRegions,
        units: nextUnits,
        rngSeed: rng.getSeed(),
        lastBattleReport: { ...report, fromRegionId, targetRegionId, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner },
        logs: [...state.logs, { year: state.year, message: outcomeMessage, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.AMPHIBIOUS_ASSAULT: {
      const { navalUnitId, targetRegionId } = action.payload;
      const navalUnit = state.units[navalUnitId];
      const targetRegion = state.regions[targetRegionId];
      const costs = ACTION_COSTS.amphibiousAssault;
      if (!navalUnit || navalUnit.ownerId !== state.playerNationId || navalUnit.domain !== 'naval') return state;
      if (!targetRegion || targetRegion.owner === state.playerNationId) return state;
      if (!isCoastal(targetRegionId)) return state;
      const isLandAdjacent = getNeighborIds(navalUnit.regionId).includes(targetRegionId);
      const isSeaLaneReachable = isReachableBySea(navalUnit.regionId, targetRegionId, state.age);
      if (!isLandAdjacent && !isSeaLaneReachable) return state;
      const embarkedLandUnits = Object.values(state.units).filter(u => u.embarkedOn === navalUnitId && u.ownerId === state.playerNationId);
      if (embarkedLandUnits.length === 0) return state;
      if (!canAfford(state.resources, costs)) return state;

      const rng = createRng(state.rngSeed);
      const nextUnits = { ...state.units };

      // Naval interception (plan §7.5): a defending fleet forces a naval battle before the landing.
      // Losing it sinks the transport and everything still aboard, and the assault never lands.
      const defenderNavalUnits = Object.values(state.units).filter(u => u.regionId === targetRegionId && u.domain === 'naval' && u.ownerId !== state.playerNationId);
      if (defenderNavalUnits.length > 0) {
        const navalBattle = resolveBattle({
          attackerUnits: [navalUnit],
          defenderUnits: defenderNavalUnits,
          terrain: REGIONS_DATA[targetRegionId]?.terrain,
          isAttackingFortification: false,
          rng,
          generals: state.hiredCommanders
        });
        navalBattle.defenderUnits.forEach(u => { if (u.strength <= 0) delete nextUnits[u.id]; else nextUnits[u.id] = u; });
        if (navalBattle.outcome !== 'attacker') {
          delete nextUnits[navalUnitId];
          embarkedLandUnits.forEach(u => delete nextUnits[u.id]);
          return {
            ...state,
            resources: applyCosts(state.resources, costs),
            units: nextUnits,
            rngSeed: rng.getSeed(),
            lastBattleReport: { ...navalBattle.report, kind: 'naval', fromRegionId: navalUnit.regionId, targetRegionId, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner },
            logs: [...state.logs, { year: state.year, message: `Your invasion fleet was intercepted and sunk approaching ${REGIONS_DATA[targetRegionId]?.name}.`, type: LogTypes.COMBAT }]
          };
        }
        nextUnits[navalUnitId] = navalBattle.attackerUnits[0];
      }

      // No existing foothold near the target means the landing itself takes the amphibious malus;
      // once the attacker already holds a neighboring region, further attacks staged from it are normal.
      const hasBeachhead = getNeighborIds(targetRegionId).some(nId => state.regions[nId]?.owner === state.playerNationId);
      const attackerLandUnits = embarkedLandUnits.map(u => nextUnits[u.id] || u);
      const defenderLandUnits = Object.values(nextUnits).filter(u => u.regionId === targetRegionId && u.domain === 'land');

      const { outcome, attackerUnits: resolvedAttackers, defenderUnits: resolvedDefenders, report } = resolveBattle({
        attackerUnits: attackerLandUnits,
        defenderUnits: defenderLandUnits,
        terrain: REGIONS_DATA[targetRegionId]?.terrain,
        isAttackingFortification: (targetRegion.defenseLevel || 0) > 0,
        rng,
        generals: state.hiredCommanders,
        attackerPenaltyMultiplier: hasBeachhead ? 1 : AMPHIBIOUS_PENALTY_MULT
      });

      const XP_WIN = 30;
      const XP_LOSE = 15;
      const attackerXpAmount = outcome === 'attacker' ? XP_WIN : outcome === 'defender' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
      const defenderXpAmount = outcome === 'defender' ? XP_WIN : outcome === 'attacker' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
      const awardBattleXp = (units, deployedIds, xpAmount) => units.map(u => {
        if (!deployedIds.includes(u.id)) return u;
        const gained = Math.round(xpAmount * getGeneralXpMultiplier(state.hiredCommanders[u.commanderId]));
        return awardXp(u, gained);
      });
      const xpAttackers = awardBattleXp(resolvedAttackers, report.deployedAttackerIds, attackerXpAmount);
      const xpDefenders = awardBattleXp(resolvedDefenders, report.deployedDefenderIds, defenderXpAmount);

      // Winning survivors disembark onto the captured beach; a repelled landing force falls back
      // aboard its transport, still embarked, for another attempt.
      xpAttackers.forEach(u => {
        if (u.strength <= 0) { delete nextUnits[u.id]; return; }
        nextUnits[u.id] = outcome === 'attacker'
          ? { ...u, regionId: targetRegionId, embarkedOn: null }
          : { ...u, regionId: navalUnit.regionId, embarkedOn: navalUnitId };
      });
      xpDefenders.forEach(u => {
        if (outcome === 'attacker' || u.strength <= 0) { delete nextUnits[u.id]; return; }
        nextUnits[u.id] = u;
      });

      const nextRegions = { ...state.regions };
      if (outcome === 'attacker') {
        nextRegions[targetRegionId] = {
          ...targetRegion,
          owner: state.playerNationId,
          control: 25,
          unrest: Math.max(targetRegion.unrest || 0, 50)
        };
      }

      const outcomeMessage = outcome === 'attacker'
        ? `Your amphibious assault captured ${REGIONS_DATA[targetRegionId]?.name} from ${state.nations[targetRegion.owner]?.name || targetRegion.owner}.`
        : outcome === 'defender'
          ? `Your amphibious assault on ${REGIONS_DATA[targetRegionId]?.name} was repelled.`
          : `Your amphibious assault on ${REGIONS_DATA[targetRegionId]?.name} ended in a mutual withdrawal.`;

      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: nextRegions,
        units: nextUnits,
        rngSeed: rng.getSeed(),
        lastBattleReport: { ...report, kind: 'amphibious', fromRegionId: navalUnit.regionId, targetRegionId, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner },
        logs: [...state.logs, { year: state.year, message: outcomeMessage, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.NAVAL_ENGAGEMENT: {
      const { fromRegionId, targetRegionId } = action.payload;
      const fromRegion = state.regions[fromRegionId];
      const costs = ACTION_COSTS.navalEngagement;
      if (!fromRegion || fromRegion.owner !== state.playerNationId) return state;
      const isLandAdjacent = getNeighborIds(fromRegionId).includes(targetRegionId);
      const isSeaLaneReachable = isReachableBySea(fromRegionId, targetRegionId, state.age);
      if (!isLandAdjacent && !isSeaLaneReachable) return state;
      const attackerNavalUnits = Object.values(state.units).filter(u => u.regionId === fromRegionId && u.ownerId === state.playerNationId && u.domain === 'naval');
      if (attackerNavalUnits.length === 0) return state;
      const defenderNavalUnits = Object.values(state.units).filter(u => u.regionId === targetRegionId && u.domain === 'naval' && u.ownerId !== state.playerNationId);
      if (defenderNavalUnits.length === 0) return state;
      if (!canAfford(state.resources, costs)) return state;

      const rng = createRng(state.rngSeed);
      const { outcome, attackerUnits: resolvedAttackers, defenderUnits: resolvedDefenders, report } = resolveBattle({
        attackerUnits: attackerNavalUnits,
        defenderUnits: defenderNavalUnits,
        terrain: REGIONS_DATA[targetRegionId]?.terrain,
        isAttackingFortification: false,
        rng,
        generals: state.hiredCommanders
      });

      // A naval engagement only contests the lane — survivors hold their own positions, win or
      // lose; there's no ground to capture from a fleet-on-fleet action.
      const nextUnits = { ...state.units };
      resolvedAttackers.forEach(u => { if (u.strength <= 0) delete nextUnits[u.id]; else nextUnits[u.id] = u; });
      resolvedDefenders.forEach(u => { if (u.strength <= 0) delete nextUnits[u.id]; else nextUnits[u.id] = u; });

      const outcomeMessage = outcome === 'attacker'
        ? `Your fleet cleared the enemy from the waters near ${REGIONS_DATA[targetRegionId]?.name}.`
        : outcome === 'defender'
          ? `Your fleet was driven off near ${REGIONS_DATA[targetRegionId]?.name}.`
          : `Your fleet's engagement near ${REGIONS_DATA[targetRegionId]?.name} ended inconclusively.`;

      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: nextUnits,
        rngSeed: rng.getSeed(),
        lastBattleReport: { ...report, kind: 'naval', fromRegionId, targetRegionId, attackerNationId: state.playerNationId, defenderNationId: state.regions[targetRegionId]?.owner },
        logs: [...state.logs, { year: state.year, message: outcomeMessage, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.SUPPRESS_REBELLION: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.suppressRebellion;
      if (!region || region.owner !== state.playerNationId) return state;
      const rebelUnits = Object.values(state.units).filter(u => u.regionId === regionId && u.ownerId === REBEL_OWNER_ID);
      if (rebelUnits.length === 0) return state;
      const garrisonUnits = Object.values(state.units).filter(u => u.regionId === regionId && u.ownerId === state.playerNationId && u.domain === 'land');
      if (garrisonUnits.length === 0) return state;
      if (!canAfford(state.resources, costs)) return state;

      const rng = createRng(state.rngSeed);
      const { outcome, attackerUnits: resolvedGarrison, defenderUnits: resolvedRebels, report } = resolveBattle({
        attackerUnits: garrisonUnits,
        defenderUnits: rebelUnits,
        terrain: REGIONS_DATA[regionId]?.terrain,
        isAttackingFortification: false,
        rng,
        generals: state.hiredCommanders
      });

      const nextUnits = { ...state.units };
      resolvedGarrison.forEach(u => { if (u.strength <= 0) delete nextUnits[u.id]; else nextUnits[u.id] = u; });
      // The rebellion is crushed outright on a win — a defeated uprising doesn't leave survivors
      // to regroup the way a foreign army might retreat and return.
      resolvedRebels.forEach(u => { if (outcome === 'attacker' || u.strength <= 0) delete nextUnits[u.id]; else nextUnits[u.id] = u; });

      const nextRegions = { ...state.regions };
      if (outcome === 'attacker') {
        nextRegions[regionId] = {
          ...region,
          unrest: Math.min(region.unrest, REBELLION_UNREST_THRESHOLD - 10),
          control: Math.min(100, (region.control || 0) + 20)
        };
      }

      const outcomeMessage = outcome === 'attacker'
        ? `The rebellion in ${REGIONS_DATA[regionId]?.name} has been crushed.`
        : outcome === 'defender'
          ? `Your garrison failed to suppress the rebellion in ${REGIONS_DATA[regionId]?.name}.`
          : `The fighting in ${REGIONS_DATA[regionId]?.name} ended without a clear result.`;

      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: nextRegions,
        units: nextUnits,
        rngSeed: rng.getSeed(),
        lastBattleReport: { ...report, kind: 'rebellion', fromRegionId: regionId, targetRegionId: regionId, attackerNationId: state.playerNationId, defenderNationId: REBEL_OWNER_ID },
        logs: [...state.logs, { year: state.year, message: outcomeMessage, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.RESEARCH_TECH: {
      const { techId } = action.payload;
      const tech = TECH_TREE[techId];
      const costs = ACTION_COSTS.researchTech;
      if (!tech) return state;
      if (!canResearchTech(techId, state.techTree, state.resources, state.year).can) return state;
      if (!canAfford(state.resources, costs)) return state;

      const nextTechTree = { ...state.techTree, [techId]: { ...state.techTree[techId], researched: true } };

      // Tech-earned age (plan §2): once a majority of the current tech age's line is researched,
      // it advances — see src/data/ages.js's getEffectiveAgeId, which is what actually gates
      // buildings/units/extraction one age ahead of the calendar as a result.
      const currentAgeTechs = getTechsForAge(state.techAgeId);
      const researchedCount = currentAgeTechs.filter(t => nextTechTree[t.id]?.researched).length;
      const nextTechAgeIndex = AGE_ORDER.indexOf(state.techAgeId) + 1;
      const advancesTechAge = researchedCount >= TECH_AGE_ADVANCEMENT_THRESHOLD && nextTechAgeIndex < AGE_ORDER.length;
      const nextTechAgeId = advancesTechAge ? AGE_ORDER[nextTechAgeIndex] : state.techAgeId;

      const resourcesAfterTechCost = applyCosts(applyCosts(state.resources, costs), tech.cost);

      return {
        ...state,
        resources: resourcesAfterTechCost,
        techTree: nextTechTree,
        techAgeId: nextTechAgeId,
        logs: [
          ...state.logs,
          { year: state.year, message: `Researched ${tech.name}.`, type: LogTypes.TECH },
          ...(advancesTechAge ? [{ year: state.year, message: `Your empire's expertise has reached the ${AGES[nextTechAgeId]?.name}.`, type: LogTypes.MILESTONE }] : [])
        ]
      };
    }

    case ActionTypes.SET_RESEARCH_FOCUS: {
      const { categoryId } = action.payload;
      const costs = ACTION_COSTS.setResearchFocus;
      if (!Object.values(TechCategories).includes(categoryId)) return state;
      if (state.researchFocus === categoryId) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        researchFocus: categoryId,
        logs: [...state.logs, { year: state.year, message: `Research focus set to ${categoryId}.`, type: LogTypes.TECH }]
      };
    }

    case ActionTypes.FUND_SCHOLARS: {
      const costs = ACTION_COSTS.fundScholars;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: { ...applyCosts(state.resources, costs), techPoints: (state.resources.techPoints || 0) + FUND_SCHOLARS_TECHPOINTS },
        logs: [...state.logs, { year: state.year, message: `Funded scholars for +${FUND_SCHOLARS_TECHPOINTS} tech points.`, type: LogTypes.TECH }]
      };
    }

    case ActionTypes.ADOPT_GOVERNMENT: {
      const { governmentId } = action.payload;
      const gov = GOVERNMENT_TYPES[governmentId];
      const nation = state.nations[state.playerNationId];
      const costs = ACTION_COSTS.adoptGovernment;
      if (!gov || nation.government === governmentId) return state;
      if (!canAdoptGovernment(governmentId, state.age)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            government: governmentId,
            // A reform to fewer slots than currently filled bumps the excess policies — a real
            // cost of switching, not just a formality.
            policies: nation.policies.slice(0, gov.slots)
          }
        },
        logs: [...state.logs, { year: state.year, message: `Your empire has adopted ${gov.name}.`, type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.ADOPT_POLICY: {
      const { policyId } = action.payload;
      const policy = POLICIES[policyId];
      const nation = state.nations[state.playerNationId];
      const gov = GOVERNMENT_TYPES[nation.government];
      const costs = ACTION_COSTS.adoptPolicy;
      if (!policy || !gov) return state;
      if (nation.policies.includes(policyId) || nation.policies.length >= gov.slots) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [state.playerNationId]: { ...nation, policies: [...nation.policies, policyId] } },
        logs: [...state.logs, { year: state.year, message: `Adopted the ${policy.name} policy.`, type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.REMOVE_POLICY: {
      const { policyId } = action.payload;
      const nation = state.nations[state.playerNationId];
      const costs = ACTION_COSTS.removePolicy;
      if (!nation.policies.includes(policyId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [state.playerNationId]: { ...nation, policies: nation.policies.filter(id => id !== policyId) } },
        logs: [...state.logs, { year: state.year, message: `Repealed the ${POLICIES[policyId]?.name || policyId} policy.`, type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.DECLARE_WAR: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      if (!target || nationId === state.playerNationId || target.isAtWar) return state;
      const justified = hasCasusBelli(state, state.playerNationId, nationId);
      const costs = justified ? ACTION_COSTS.declareWarJustified : ACTION_COSTS.declareWarUnjustified;
      if (!canAfford(state.resources, costs)) return state;

      const afterWar = declareWar(state, nationId, { aggressor: state.playerNationId });
      const homeRegion = afterWar.regions[state.playerNationId];
      const nextNations = { ...afterWar.nations };
      let nextRegions = afterWar.regions;
      if (!justified) {
        // Unjustified aggression costs stability at home and relations with everyone else — the
        // plan's own framing, not just a bigger gold bill.
        nextRegions = { ...afterWar.regions, [state.playerNationId]: { ...homeRegion, unrest: Math.min(100, (homeRegion.unrest || 0) + UNJUSTIFIED_WAR_HOME_UNREST) } };
        Object.keys(nextNations).forEach(id => {
          if (id === state.playerNationId || id === nationId) return;
          nextNations[id] = { ...nextNations[id], hostility: Math.min(100, (nextNations[id].hostility || 0) + UNJUSTIFIED_WAR_GLOBAL_HOSTILITY) };
        });
      }

      return {
        ...afterWar,
        resources: applyCosts(state.resources, costs),
        nations: nextNations,
        regions: nextRegions,
        logs: [...afterWar.logs, {
          year: state.year,
          message: justified ? `You declared a justified war on ${target.name}.` : `You declared an unjustified war on ${target.name} — the world takes note.`,
          type: LogTypes.DIPLOMACY
        }]
      };
    }

    case ActionTypes.FABRICATE_CLAIM: {
      const { nationId } = action.payload;
      const player = state.nations[state.playerNationId];
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.fabricateClaim;
      if (!target || nationId === state.playerNationId || player.claims.includes(nationId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [state.playerNationId]: { ...player, claims: [...player.claims, nationId] } },
        logs: [...state.logs, { year: state.year, message: `Fabricated a claim against ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.SUE_FOR_PEACE: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      if (!target || !target.isAtWar) return state;
      const costs = { gold: Math.max(SUE_FOR_PEACE_MIN_GOLD, Math.round(SUE_FOR_PEACE_BASE_GOLD - target.warExhaustion * 2)), actionPoints: 1 };
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [nationId]: { ...target, isAtWar: false, hasPeaceTreaty: true, hostility: Math.min(target.hostility, 50), relationStatus: RelationStatus.COLD_PEACE }
        },
        wars: state.wars.map(w => (w.enemy === nationId && w.active ? { ...w, active: false } : w)),
        logs: [...state.logs, { year: state.year, message: `Signed a peace treaty with ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.TRADE_AGREEMENT: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.tradeAgreement;
      if (!target || target.isAtWar || target.hasTradeAgreement) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [nationId]: { ...target, hasTradeAgreement: true, relationStatus: RelationStatus.FRIENDLY } },
        logs: [...state.logs, { year: state.year, message: `Signed a trade agreement with ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.MILITARY_ALLIANCE: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.militaryAlliance;
      if (!target || target.isAtWar || target.hasMilitaryPact) return state;
      if (!target.hasTradeAgreement && target.hostility > ALLIANCE_HOSTILITY_CEILING) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [nationId]: { ...target, hasMilitaryPact: true, relationStatus: RelationStatus.ALLIED } },
        logs: [...state.logs, { year: state.year, message: `Formed a military alliance with ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.GIFT_BRIBE: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.giftBribe;
      if (!target) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [nationId]: { ...target, hostility: Math.max(target.hostilityFloor || 0, target.hostility - GIFT_HOSTILITY_REDUCTION) } },
        logs: [...state.logs, { year: state.year, message: `Sent a gift to ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.PROMOTE_UNIT: {
      const { unitId, perkId } = action.payload;
      const unit = state.units[unitId];
      const costs = ACTION_COSTS.promoteUnit;
      if (!unit || unit.ownerId !== state.playerNationId) return state;
      if (!canPromote(unit)) return state;
      const perk = getPerk(perkId);
      if (!perk || (unit.promotions || []).includes(perkId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [unitId]: { ...unit, promotions: [...(unit.promotions || []), perkId] } },
        logs: [...state.logs, { year: state.year, message: `Your ${unit.classId} unit earned the ${perk.name} promotion.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.HIRE_GENERAL: {
      const costs = ACTION_COSTS.hireGeneral;
      if (!canAfford(state.resources, costs)) return state;
      const rng = createRng(state.rngSeed);
      const generalId = `general_${state.nextCommanderSeq}`;
      const general = generateGeneral(rng, generalId, state.playerNationId);
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        hiredCommanders: { ...state.hiredCommanders, [generalId]: general },
        nextCommanderSeq: state.nextCommanderSeq + 1,
        rngSeed: rng.getSeed(),
        logs: [...state.logs, { year: state.year, message: `${general.name} has joined your officer corps.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.APPOINT_GENERAL: {
      const { generalId, unitId } = action.payload;
      const general = state.hiredCommanders[generalId];
      const costs = ACTION_COSTS.appointGeneral;
      if (!general || general.nationId !== state.playerNationId) return state;
      if (unitId) {
        const unit = state.units[unitId];
        if (!unit || unit.ownerId !== state.playerNationId) return state;
      }
      if (!canAfford(state.resources, costs)) return state;

      const nextUnits = { ...state.units };
      // Vacate wherever this general was previously assigned before taking the new post.
      if (general.assignedUnitId && nextUnits[general.assignedUnitId]) {
        nextUnits[general.assignedUnitId] = { ...nextUnits[general.assignedUnitId], commanderId: null };
      }
      if (unitId) {
        nextUnits[unitId] = { ...nextUnits[unitId], commanderId: generalId };
      }

      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: nextUnits,
        hiredCommanders: { ...state.hiredCommanders, [generalId]: { ...general, assignedUnitId: unitId || null } },
        logs: [...state.logs, {
          year: state.year,
          message: unitId ? `${general.name} took command of a unit.` : `${general.name} was recalled from the field.`,
          type: LogTypes.ACTION
        }]
      };
    }

    case ActionTypes.ADD_LOG:
      return {
        ...state,
        logs: [...state.logs, { year: state.year, message: action.payload.message, type: action.payload.type || LogTypes.ACTION }]
      };

    case ActionTypes.LOAD_GAME: {
      const fresh = createInitialState();
      const incoming = action.payload || {};
      return { ...fresh, ...incoming, gameStatus: incoming.gameStatus || GameStatus.ACTIVE };
    }

    case ActionTypes.RESET_GAME: {
      // playerNationId/gameSpeed/difficultyId come from the start screen; doctrineId comes from
      // meta-progression localStorage via the component layer — see GameProvider.resetGame below.
      // This keeps gameReducer a pure function of (state, action).
      const { playerNationId, gameSpeed, doctrineId, difficultyId } = action.payload || {};
      const fresh = createInitialState({ playerNationId, gameSpeed });
      const withDoctrine = doctrineId ? applyStartingDoctrine(fresh, doctrineId) : fresh;
      return difficultyId ? applyDifficulty(withDoctrine, difficultyId) : withDoctrine;
    }

    default:
      return state;
  }
};

// ============ CONTEXT ============
const GameContext = createContext(null);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

// ============ PROVIDER ============
export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, null, loadOrCreateState);
  // Meta-progression (achievements + selected starting doctrine/difficulty) lives in its OWN
  // localStorage key, deliberately separate from the per-save game state — see
  // src/utils/metaProgression.js. Lazy-init reads storage once on mount, matching
  // loadOrCreateState's pattern for the save.
  const [meta, setMeta] = useState(() => loadMeta());

  // Autosave. The whole state is plain JSON (no Dates/Maps/class instances), so this is a
  // straight serialize — the only thing intentionally NOT embedded is event *content*
  // (we store activeEventId, not the event object, so a future content patch can't leave a
  // save holding stale copy).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, state, savedAt: Date.now() }));
    } catch (e) {
      // Storage unavailable or full — autosave is best-effort, never fatal.
    }
  }, [state]);

  // Achievement unlocks. checkAchievements is a pure predicate over the CURRENT snapshot (no
  // history needed), so this just diffs it against what's already persisted; the diff is what
  // makes "newly earned" meaningful despite the predicate itself only knowing "currently true".
  // notifiedRef guards against React StrictMode's dev-only double-invoke of this exact effect.
  const notifiedRef = useRef(new Set());
  useEffect(() => {
    const satisfied = checkAchievements(state);
    const newlyUnlocked = satisfied.filter(id => !meta.unlockedAchievements.includes(id) && !notifiedRef.current.has(id));
    if (newlyUnlocked.length === 0) return;
    newlyUnlocked.forEach(id => notifiedRef.current.add(id));

    const updatedMeta = { ...meta, unlockedAchievements: [...meta.unlockedAchievements, ...newlyUnlocked] };
    setMeta(updatedMeta);
    saveMeta(updatedMeta);
    newlyUnlocked.forEach(id => {
      dispatch({
        type: ActionTypes.ADD_LOG,
        payload: { message: `Achievement unlocked: ${ACHIEVEMENTS[id].name}`, type: LogTypes.MILESTONE }
      });
    });
  }, [state, meta]);

  const selectDoctrine = useCallback((doctrineId) => {
    setMeta(prev => {
      const updated = { ...prev, selectedDoctrine: doctrineId };
      saveMeta(updated);
      return updated;
    });
  }, []);

  const selectDifficulty = useCallback((difficultyId) => {
    setMeta(prev => {
      const updated = { ...prev, difficulty: difficultyId };
      saveMeta(updated);
      return updated;
    });
  }, []);

  const addLog = useCallback((message, type = LogTypes.ACTION) => {
    dispatch({ type: ActionTypes.ADD_LOG, payload: { message, type } });
  }, []);

  // Turn/event resolution now needs no payload from the component — the reducer always
  // operates on the true latest state, so there is no stale-closure window to race.
  const advanceTurn = useCallback(() => {
    dispatch({ type: ActionTypes.ADVANCE_TURN });
  }, []);

  const fastForward = useCallback(() => {
    dispatch({ type: ActionTypes.FAST_FORWARD });
  }, []);

  const resolveEvent = useCallback((optionIndex) => {
    dispatch({ type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex } });
  }, []);

  // Starts a new game as `playerNationId` at the chosen `gameSpeed`, layering in the player's
  // persisted starting doctrine and (if the start screen picked one) difficulty — see the
  // country-select + difficulty + speed start screen this feeds.
  const resetGame = useCallback((options = {}) => {
    dispatch({
      type: ActionTypes.RESET_GAME,
      payload: {
        playerNationId: options.playerNationId,
        gameSpeed: options.gameSpeed,
        doctrineId: meta.selectedDoctrine,
        difficultyId: options.difficultyId || meta.difficulty
      }
    });
  }, [meta.selectedDoctrine, meta.difficulty]);

  const exportSave = useCallback(() => {
    return JSON.stringify({ version: SAVE_VERSION, state, savedAt: Date.now() }, null, 2);
  }, [state]);

  const importSave = useCallback((jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      const payload = parsed && parsed.version === SAVE_VERSION && parsed.state ? parsed.state : parsed;
      dispatch({ type: ActionTypes.LOAD_GAME, payload });
      return true;
    } catch (e) {
      return false;
    }
  }, []);

  const contextValue = useMemo(() => ({
    state,
    dispatch,
    addLog,
    advanceTurn,
    fastForward,
    resolveEvent,
    resetGame,
    exportSave,
    importSave,
    meta,
    selectDoctrine,
    selectDifficulty
  }), [state, addLog, advanceTurn, fastForward, resolveEvent, resetGame, exportSave, importSave, meta, selectDoctrine, selectDifficulty]);

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};

export default GameContext;
