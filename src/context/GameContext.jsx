// src/context/GameContext.jsx
// Game state management using React Context and useReducer.
//
// Turn resolution and event resolution are delegated to pure functions in src/engine/ —
// the reducer's job is validation + a single atomic state transition per dispatch. Player
// actions (buy land, train troops, diplomacy, research, invasions) are likewise atomic:
// each is validated against the reducer's own (authoritative, non-stale) state and applied
// in one dispatch, so double-click / stale-snapshot double-spend is not reachable.

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { GamePhases, GameStatus, ActionTypes, RelationStatus, LogTypes } from '../data/types';
import { REGIONS_DATA, CORE_REGION_IDS, isAdjacentToOwner } from '../data/regions';
import { NATIONS_DATA, INDEPENDENCE_WAR_ATTACKERS } from '../data/nations';
import { TECH_TREE, canResearchTech } from '../data/techTree';
import { HISTORICAL_EVENTS } from '../data/events';
import { EVENT_CHAINS } from '../data/eventChains';
import { ACTION_COSTS } from '../data/actionCosts';
import { canAfford, applyCosts, emptyUnits, addUnits, hasEnoughUnits, subtractUnits, getTechBonuses, getAvgCoreControl, COMEBACK_THRESHOLD } from '../utils/helpers';
import { resolveTurn } from '../engine/resolveTurn';
import { applyEventEffects } from '../engine/applyEventEffects';
import { declareWar, buildWarGoal } from '../engine/diplomacy';
import { randomSeed } from '../utils/rng';
import { ACHIEVEMENTS, checkAchievements } from '../data/achievements';
import { PERSONAS } from '../data/personas';
import { applyStartingDoctrine } from '../data/startingDoctrines';
import { applyDifficulty } from '../data/difficulty';
import { loadMeta, saveMeta } from '../utils/metaProgression';

// ============ PERSISTENCE ============
const STORAGE_KEY = 'rise-of-zion-save-v1';
const SAVE_VERSION = 1;

// ============ INITIAL STATE FACTORY ============
// Exported (not just used internally) so it doubles as test fixture data — resolveTurn.test.js
// and applyEventEffects.test.js build realistic states from it rather than hand-rolling partial
// mocks that could silently drift from the real shape.
export const createInitialState = () => {
  // Initialize regions
  const regions = {};
  Object.entries(REGIONS_DATA).forEach(([id, data]) => {
    regions[id] = {
      id,
      owner: data.startOwner,
      control: data.startOwner === 'player' ? data.startControl : 100,
      currentPopulation: data.population,
      currentInfrastructure: data.infrastructure,
      underInvasion: false,
      isOccupied: false
    };
  });

  // Initialize nations
  const nations = {};
  Object.entries(NATIONS_DATA).forEach(([id, data]) => {
    if (data.isPlayer) {
      nations[id] = { id, name: data.name, color: data.color, isPlayer: true };
    } else {
      nations[id] = {
        id,
        name: data.name,
        color: data.color,
        hostility: data.startHostility,
        militaryStrength: data.startMilitary,
        aggression: data.aggression,
        doctrine: data.doctrine || 'attrition',
        relationStatus: data.startRelation || RelationStatus.NEUTRAL,
        isAtWar: false,
        hasPeaceTreaty: false,
        hasTradeAgreement: false,
        hasMilitaryPact: false,
        // Permanent floor hostility decay can't cross below, set once a peace treaty with this
        // nation is broken by a new war — see src/engine/diplomacy.js declareWar().
        hostilityFloor: 0
      };
    }
  });

  // Initialize tech tree
  const techTree = {};
  Object.entries(TECH_TREE).forEach(([id, data]) => {
    techTree[id] = {
      id,
      researched: false,
      available: data.yearAvailable <= 1870
    };
  });

  return {
    // Time
    year: 1870,
    period: 0, // 0 = H1 (First Half), 1 = H2 (Second Half)
    turnNumber: 1,
    phase: GamePhases.PRE_STATE,
    gameStatus: GameStatus.ACTIVE,
    // Which VICTORY_CONDITIONS entry ended the game, if any (Phase 10: multiple win conditions).
    victoryConditionId: null,
    // Difficulty select (Phase 10) — 1 is a no-op multiplier, matching DIFFICULTIES.normal.
    difficultyMultiplier: 1,

    // Resources
    resources: {
      money: 50000,
      manpower: 1000,
      diplomacyPoints: 20,
      techPoints: 0,
      actionPoints: 3,
      maxActionPoints: 3
    },

    // Military
    undergroundStrength: 500,
    // POST_STATE arsenal, split by type so terrain/composition are real tradeoffs (see
    // src/utils/helpers.js UNIT_TYPES). calcMilitaryPower() derives the total from this —
    // there is no separate flat `militaryPower` field to drift out of sync with it.
    militaryUnits: emptyUnits(),

    // Societal alignment (0 = Secular, 100 = Religious)
    societalSlider: 50,

    // World state
    regions,
    nations,
    techTree,

    // Wars and invasions
    wars: [],
    invasions: [],
    nextInvasionSeq: 0,
    // { [sideId]: turnsRemaining } — a side ('player' or a nation id) whose invasion was just
    // decisively repelled is briefly disorganized, so a new invasion into its territory gets a
    // strength bonus (Phase 7 counter-attack windows). See resolveTurn.js.
    counterAttackWindows: {},
    // Persona ids the player has commissioned (Phase 8) — see src/data/personas.js. A hired
    // commander can be assigned to one active invasion at a time via invasion.commanderId.
    hiredCommanders: [],

    // Events
    activeEventId: null,
    // Procedural late-game events (Phase 6) are carried in full here rather than by id, since
    // unlike scripted events they aren't in a static registry to look them up from afterward —
    // see src/data/proceduralEvents.js and resolveTurn.js.
    activeProceduralEvent: null,
    proceduralEventCooldown: 0,
    // Scheduled event-chain follow-ups (Phase 10) — [{ id, dueTurn }], checked each turn in
    // resolveTurn.js and looked up in EVENT_CHAINS (src/data/eventChains.js) once due.
    pendingEventChains: [],
    firedEvents: {},

    // Persistent effect from event choices (e.g. Bar-Lev Line) applied to combat
    eventDefenseBonus: 0,

    // Deterministic turn resolution — see src/utils/rng.js
    rngSeed: randomSeed(),

    // Logs
    logs: [
      { year: 1870, message: '1870 H1: The Yishuv begins. Build your homeland.', type: LogTypes.MILESTONE }
    ]
  };
};

// Migrates a raw loaded/imported state object onto the current shape. Kept intentionally tiny —
// this project doesn't promise long-term save compatibility across schema changes, but a
// one-line conversion here avoids silently deleting the player's army the first time the
// militaryPower-scalar -> militaryUnits-composition change (Phase 3) loads an old save.
const migrateLoadedState = (savedState) => {
  if (savedState && savedState.militaryUnits === undefined && typeof savedState.militaryPower === 'number') {
    return { ...savedState, militaryUnits: { infantry: savedState.militaryPower, armor: 0, air: 0 } };
  }
  return savedState;
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
    return { ...fresh, ...migrateLoadedState(saved.state) };
  } catch (e) {
    return fresh;
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
      // Fast-forward (Phase 10): repeatedly resolves turns within a single atomic dispatch, so
      // the component doesn't need to loop across async re-renders. Stops the moment there's a
      // decision worth the player's attention — an event becomes active, a war starts or ends,
      // the game ends — or a turn cap is hit, so a single click can't silently skip to 2150.
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
      // A procedural event (Phase 6) is never in HISTORICAL_EVENTS — it's carried in full on
      // the state itself since it was generated fresh, not looked up from a static registry.
      // A chain event (Phase 10) IS looked up by id, but from EVENT_CHAINS rather than
      // HISTORICAL_EVENTS — see src/data/eventChains.js.
      const event = state.activeEventId
        ? (HISTORICAL_EVENTS[state.activeEventId] || EVENT_CHAINS[state.activeEventId])
        : state.activeProceduralEvent;
      if (!event) return state;
      return applyEventEffects(state, event, action.payload.optionIndex);
    }

    case ActionTypes.DECLARE_INDEPENDENCE: {
      if (state.phase !== GamePhases.PRE_STATE) return state;

      // Set all core regions to 100% control
      const updRegions = { ...state.regions };
      CORE_REGION_IDS.forEach(id => {
        if (updRegions[id] && updRegions[id].owner === 'player') {
          updRegions[id] = { ...updRegions[id], control: 100 };
        }
      });

      // All historical enemies declare war
      const updNations = { ...state.nations };
      INDEPENDENCE_WAR_ATTACKERS.forEach(id => {
        if (updNations[id]) {
          updNations[id] = {
            ...updNations[id],
            isAtWar: true,
            hostility: 100,
            relationStatus: RelationStatus.WAR
          };
        }
      });

      // Create war records
      const newWars = INDEPENDENCE_WAR_ATTACKERS.map(n => ({
        id: `war_${n}_${state.year}`,
        enemy: n,
        startYear: state.year,
        active: true
      }));

      // Initial invasions
      const newInvasions = [
        { id: 'inv_egypt_1948', targetRegion: 'negev', strength: 8000, morale: 100, supply: 100, active: true, isPlayerAttacker: false, attackerNation: 'egypt' },
        { id: 'inv_syria_1948', targetRegion: 'galilee', strength: 5000, morale: 100, supply: 100, active: true, isPlayerAttacker: false, attackerNation: 'syria' },
        { id: 'inv_jordan_1948', targetRegion: 'jerusalem', strength: 3000, morale: 100, supply: 100, active: true, isPlayerAttacker: false, attackerNation: 'jordan' },
        { id: 'inv_iraq_1948', targetRegion: 'haifa', strength: 2000, morale: 90, supply: 100, active: true, isPlayerAttacker: false, attackerNation: 'iraq' }
      ];

      newInvasions.forEach(inv => {
        if (updRegions[inv.targetRegion]) {
          updRegions[inv.targetRegion] = { ...updRegions[inv.targetRegion], underInvasion: true };
        }
      });

      return {
        ...state,
        phase: GamePhases.POST_STATE,
        militaryUnits: { ...emptyUnits(), infantry: state.undergroundStrength * 2 },
        undergroundStrength: 0,
        regions: updRegions,
        nations: updNations,
        wars: [...state.wars, ...newWars],
        invasions: [...state.invasions, ...newInvasions],
        resources: {
          ...state.resources,
          techPoints: state.resources.techPoints + 10,
          actionPoints: state.resources.maxActionPoints
        },
        logs: [
          ...state.logs,
          { year: state.year, message: 'INDEPENDENCE DECLARED! The State of Israel is born!', type: LogTypes.MILESTONE },
          { year: state.year, message: 'Arab armies invade from all directions!', type: LogTypes.CRISIS }
        ]
      };
    }

    // ---- Atomic, cost-validated player actions ----

    case ActionTypes.BUY_LAND: {
      const region = state.regions[action.payload.regionId];
      const costs = ACTION_COSTS.buyLand;
      if (!region || region.owner !== 'player' || region.control >= 100) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: {
          ...state.regions,
          [region.id]: { ...region, control: Math.min(100, region.control + 5) }
        },
        logs: [...state.logs, { year: state.year, message: `Purchased land in ${REGIONS_DATA[region.id]?.name}. Control +5%`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.ORGANIZE_IMMIGRATION: {
      const isPreState = state.phase === GamePhases.PRE_STATE;
      const costs = isPreState ? ACTION_COSTS.immigrationPreState : ACTION_COSTS.immigrationPostState;
      if (!canAfford(state.resources, costs)) return state;
      const manpowerGain = isPreState ? 1000 : 2000;
      const techGain = isPreState ? 0 : 5;
      const resources = applyCosts(state.resources, costs);
      return {
        ...state,
        resources: { ...resources, manpower: resources.manpower + manpowerGain, techPoints: resources.techPoints + techGain },
        logs: [...state.logs, { year: state.year, message: `Immigration wave! +${manpowerGain} Manpower${techGain ? `, +${techGain} TP` : ''}`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_INFRASTRUCTURE: {
      const region = state.regions[action.payload.regionId];
      const costs = ACTION_COSTS.buildInfrastructure;
      if (!region || region.owner !== 'player' || region.currentInfrastructure >= 10) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: {
          ...state.regions,
          [region.id]: { ...region, currentInfrastructure: region.currentInfrastructure + 1 }
        },
        logs: [...state.logs, { year: state.year, message: `Built infrastructure in ${REGIONS_DATA[region.id]?.name}. Level ${region.currentInfrastructure + 1}`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.LOBBY_POWERS: {
      const costs = ACTION_COSTS.lobbyPowers;
      if (!canAfford(state.resources, costs)) return state;
      const resources = applyCosts(state.resources, costs);
      return {
        ...state,
        resources: { ...resources, diplomacyPoints: resources.diplomacyPoints + 10 },
        logs: [...state.logs, { year: state.year, message: 'Lobbied international powers. +10 Diplomacy Points', type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.TRAIN_UNDERGROUND: {
      const costs = ACTION_COSTS.trainUnderground;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        undergroundStrength: state.undergroundStrength + 500,
        logs: [...state.logs, { year: state.year, message: 'Trained underground forces. +500 strength', type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.TRAIN_INFANTRY: {
      const costs = ACTION_COSTS.trainInfantry;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        militaryUnits: addUnits(state.militaryUnits, { infantry: 1000 }),
        logs: [...state.logs, { year: state.year, message: 'Trained IDF infantry. +1000 infantry', type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_TANKS: {
      // Merkava doctrine's tankDiscount reduces the build cost — previously accumulated into
      // techBonuses and never actually applied anywhere.
      const discount = getTechBonuses(state.techTree).tankDiscount || 0;
      const costs = { ...ACTION_COSTS.buildTanks, money: Math.round(ACTION_COSTS.buildTanks.money * (1 - discount)) };
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        militaryUnits: addUnits(state.militaryUnits, { armor: 2000 }),
        logs: [...state.logs, { year: state.year, message: 'Built armored units. +2000 armor', type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_JETS: {
      // Air Superiority doctrine's jetDiscount reduces the build cost, same pattern as tanks.
      const discount = getTechBonuses(state.techTree).jetDiscount || 0;
      const costs = { ...ACTION_COSTS.buildJets, money: Math.round(ACTION_COSTS.buildJets.money * (1 - discount)) };
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        militaryUnits: addUnits(state.militaryUnits, { air: 3000 }),
        logs: [...state.logs, { year: state.year, message: 'Built air force jets. +3000 air power', type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.LAUNCH_PLAYER_INVASION: {
      const { targetRegion, composition, approach } = action.payload;
      const region = state.regions[targetRegion];
      const enemyNation = region ? state.nations[region.owner] : null;
      const costs = ACTION_COSTS.launchInvasion;
      if (!region || region.owner === 'player' || !enemyNation || !enemyNation.isAtWar) return state;
      // Must be launched from territory that actually borders the target — previously invasions
      // could originate from anywhere on the map with no notion of a front line.
      if (!isAdjacentToOwner(targetRegion, state.regions, 'player')) return state;
      const requestedComposition = { ...emptyUnits(), ...composition };
      if (Object.values(requestedComposition).every(v => v <= 0)) return state;
      if (!hasEnoughUnits(state.militaryUnits, requestedComposition)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        // Committed units leave the home defense pool for the duration of the invasion — this
        // is what makes multi-front war a real tradeoff instead of reusing the same full-strength
        // pool for every simultaneous invasion (the original balance exploit).
        militaryUnits: subtractUnits(state.militaryUnits, requestedComposition),
        nextInvasionSeq: state.nextInvasionSeq + 1,
        invasions: [
          ...state.invasions,
          {
            id: `inv_player_${state.turnNumber}_${state.nextInvasionSeq}`,
            targetRegion,
            composition: requestedComposition,
            morale: 100,
            supply: 100,
            active: true,
            isPlayerAttacker: true,
            // Siege vs. storm (Phase 8) — defaults to 'storm' (the only option before Phase 8)
            // when the caller doesn't specify one.
            approach: approach === 'siege' ? 'siege' : 'storm'
          }
        ],
        regions: { ...state.regions, [targetRegion]: { ...region, underInvasion: true } },
        logs: [...state.logs, { year: state.year, message: `Launched invasion of ${REGIONS_DATA[targetRegion]?.name}!`, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.COUNTERATTACK: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const inv = state.invasions.find(i => i.targetRegion === regionId && i.active && !i.isPlayerAttacker);
      const costs = ACTION_COSTS.counterattack;
      if (!region || !inv) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        invasions: state.invasions.map(i =>
          i.id === inv.id ? { ...i, strength: Math.floor(i.strength * 0.7), morale: i.morale - 20 } : i
        ),
        regions: { ...state.regions, [regionId]: { ...region, control: Math.min(100, region.control + 15) } },
        logs: [...state.logs, { year: state.year, message: `Counterattack in ${REGIONS_DATA[regionId]?.name}! Control +15%`, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.AIR_STRIKE: {
      const target = state.invasions.find(i => !i.isPlayerAttacker && i.active);
      const costs = ACTION_COSTS.airStrike;
      if (!target) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        invasions: state.invasions.map(i =>
          i.id === target.id ? { ...i, strength: Math.floor(i.strength * 0.6), morale: i.morale - 25 } : i
        ),
        logs: [...state.logs, { year: state.year, message: `Air strike hit enemy forces at ${REGIONS_DATA[target.targetRegion]?.name}!`, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.FORTIFY: {
      const region = state.regions[action.payload.regionId];
      const costs = ACTION_COSTS.fortify;
      if (!region || region.owner !== 'player') return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [region.id]: { ...region, control: Math.min(100, region.control + 10) } },
        logs: [...state.logs, { year: state.year, message: `Fortified ${REGIONS_DATA[region.id]?.name}. Control +10%`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DECLARE_WAR_COSTED: {
      // goalType (Phase 7) lets the player pick 'capture_region' or 'destroy_military' explicitly
      // (see DiplomacyPanel's two Declare War buttons) instead of only getting the doctrine-style
      // auto-assigned default; omitting it keeps the old auto-assign behavior.
      const { nationId, goalType } = action.payload;
      const nation = state.nations[nationId];
      const costs = ACTION_COSTS.declareWar;
      if (!nation || nation.isAtWar) return state;
      if (!canAfford(state.resources, costs)) return state;
      const withCostSpent = { ...state, resources: applyCosts(state.resources, costs) };
      const goal = goalType ? buildWarGoal(withCostSpent, nationId, 'player', goalType) : null;
      return {
        ...declareWar(withCostSpent, nationId, { aggressor: 'player', goal }),
        logs: [...state.logs, { year: state.year, message: `WAR declared on ${NATIONS_DATA[nationId]?.name}!`, type: LogTypes.CRISIS }]
      };
    }

    case ActionTypes.SEEK_PEACE: {
      const { nationId } = action.payload;
      const nation = state.nations[nationId];
      const costs = ACTION_COSTS.seekPeace;
      if (!nation || !nation.isAtWar || nation.hostility > 60) return state;
      if (!canAfford(state.resources, costs)) return state;
      const filteredInvasions = state.invasions.filter(inv => !(inv.attackerNation === nationId && !inv.isPlayerAttacker));
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [nationId]: { ...nation, isAtWar: false, hostility: 20, relationStatus: RelationStatus.COLD_PEACE, hasPeaceTreaty: true }
        },
        wars: state.wars.map(w => (w.enemy === nationId ? { ...w, active: false } : w)),
        invasions: filteredInvasions,
        logs: [...state.logs, { year: state.year, message: `PEACE signed with ${NATIONS_DATA[nationId]?.name}!`, type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.SIGN_TRADE_COSTED: {
      const { nationId } = action.payload;
      const nation = state.nations[nationId];
      const costs = ACTION_COSTS.signTrade;
      if (!nation || !nation.hasPeaceTreaty || nation.hasTradeAgreement) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [nationId]: { ...nation, hasTradeAgreement: true, hostility: Math.max(0, nation.hostility - 10), relationStatus: RelationStatus.FRIENDLY }
        },
        logs: [...state.logs, { year: state.year, message: `Trade agreement with ${NATIONS_DATA[nationId]?.name}!`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.SIGN_MILITARY_PACT_COSTED: {
      const { nationId } = action.payload;
      const nation = state.nations[nationId];
      const costs = ACTION_COSTS.militaryPact;
      if (!nation || !nation.hasTradeAgreement || nation.hasMilitaryPact) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [nationId]: { ...nation, hasMilitaryPact: true, relationStatus: RelationStatus.ALLIED } },
        logs: [...state.logs, { year: state.year, message: `Military pact with ${NATIONS_DATA[nationId]?.name}!`, type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.RESEARCH_TECH_COSTED: {
      const { techId } = action.payload;
      const tech = TECH_TREE[techId];
      const techState = state.techTree[techId];
      // Delegate to the single source of truth for eligibility (prerequisites, requiresAny,
      // exclusiveWith, year, cost) instead of re-deriving a subset of it here — this reducer
      // case used to duplicate only the plain-AND prerequisite check, so it silently didn't know
      // about requiresAny (would have wrongly rejected Iron Dome after researching only one of
      // the two exclusive doctrines) or exclusiveWith (would have let a direct dispatch research
      // both mutually-exclusive doctrines, bypassing the UI-only guard).
      if (!canResearchTech(techId, state.techTree, state.resources, state.year).can) return state;
      const costs = { money: tech.cost.money, techPoints: tech.cost.techPoints, actionPoints: ACTION_COSTS.researchTechActionPoints };
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        techTree: { ...state.techTree, [techId]: { ...techState, researched: true } },
        logs: [...state.logs, { year: state.year, message: `Researched: ${tech.name}`, type: LogTypes.TECH }]
      };
    }

    case ActionTypes.SABOTAGE_INVASION: {
      const { invasionId } = action.payload;
      const invasion = state.invasions.find(i => i.id === invasionId && i.active && !i.isPlayerAttacker);
      const costs = ACTION_COSTS.sabotageInvasion;
      if (!invasion) return state;
      if (!getTechBonuses(state.techTree).covertOps) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        invasions: state.invasions.map(i =>
          i.id === invasionId ? { ...i, morale: Math.max(0, i.morale - 30), supply: Math.max(0, i.supply - 30) } : i
        ),
        logs: [...state.logs, { year: state.year, message: `Mossad sabotages the invasion of ${REGIONS_DATA[invasion.targetRegion]?.name}!`, type: LogTypes.CRISIS }]
      };
    }

    case ActionTypes.DESTABILIZE_NATION: {
      const { nationId } = action.payload;
      const nation = state.nations[nationId];
      const costs = ACTION_COSTS.destabilizeNation;
      if (!nation) return state;
      if (!getTechBonuses(state.techTree).cyber) return state;
      if (!canAfford(state.resources, costs)) return state;
      // Base 5% from Unit 8200 alone; Cyber Command's enemyDebuff adds up to another 15% (20% total).
      const debuffPct = 0.05 + (getTechBonuses(state.techTree).enemyDebuff || 0);
      const reduction = Math.round(nation.militaryStrength * debuffPct);
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [nationId]: { ...nation, militaryStrength: Math.max(100, nation.militaryStrength - reduction) } },
        logs: [...state.logs, { year: state.year, message: `Cyber operation cripples ${nation.name}'s military infrastructure!`, type: LogTypes.CRISIS }]
      };
    }

    case ActionTypes.COVERT_TECH_THEFT: {
      const costs = ACTION_COSTS.covertTechTheft;
      if (!getTechBonuses(state.techTree).globalIntel) return state;
      if (!canAfford(state.resources, costs)) return state;
      const stolenTechPoints = 50;
      return {
        ...state,
        resources: { ...applyCosts(state.resources, costs), techPoints: state.resources.techPoints + stolenTechPoints },
        logs: [...state.logs, { year: state.year, message: `Quantum intelligence operation yields +${stolenTechPoints} TP`, type: LogTypes.TECH }]
      };
    }

    case ActionTypes.SET_INVASION_APPROACH: {
      // Siege vs. storm (Phase 8) — free to switch, since it's a tactical stance not a spend.
      const { invasionId, approach } = action.payload;
      if (approach !== 'storm' && approach !== 'siege') return state;
      const inv = state.invasions.find(i => i.id === invasionId && i.active && i.isPlayerAttacker);
      if (!inv) return state;
      return { ...state, invasions: state.invasions.map(i => (i.id === invasionId ? { ...i, approach } : i)) };
    }

    case ActionTypes.SET_INVASION_ORDER: {
      // Per-turn tactical order (Phase 8) — press/hold/probe, storm-only (see resolveTurn.js).
      const { invasionId, tacticalOrder } = action.payload;
      if (!['press', 'hold', 'probe'].includes(tacticalOrder)) return state;
      const inv = state.invasions.find(i => i.id === invasionId && i.active && i.isPlayerAttacker);
      if (!inv) return state;
      return { ...state, invasions: state.invasions.map(i => (i.id === invasionId ? { ...i, tacticalOrder } : i)) };
    }

    case ActionTypes.COMMISSION_COMMANDER: {
      const { personaId } = action.payload;
      if (!PERSONAS[personaId]) return state;
      if ((state.hiredCommanders || []).includes(personaId)) return state;
      const costs = ACTION_COSTS.commissionCommander;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        hiredCommanders: [...(state.hiredCommanders || []), personaId],
        logs: [...state.logs, { year: state.year, message: `${PERSONAS[personaId].name} has joined the officer corps.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.ASSIGN_COMMANDER: {
      // personaId may be null/undefined to unassign. A commander already leading a different
      // active front can't be double-booked.
      const { invasionId, personaId } = action.payload;
      const inv = state.invasions.find(i => i.id === invasionId && i.active && i.isPlayerAttacker);
      if (!inv) return state;
      if (personaId) {
        if (!(state.hiredCommanders || []).includes(personaId)) return state;
        const alreadyElsewhere = state.invasions.some(i => i.active && i.id !== invasionId && i.commanderId === personaId);
        if (alreadyElsewhere) return state;
      }
      return { ...state, invasions: state.invasions.map(i => (i.id === invasionId ? { ...i, commanderId: personaId || null } : i)) };
    }

    case ActionTypes.HIRE_MERCENARIES: {
      // Temporary composition boost (Phase 8) — resolveTurn.js ticks mercenaryBoost.turnsRemaining
      // down each turn and removes exactly what it added once the contract expires.
      const { invasionId } = action.payload;
      const inv = state.invasions.find(i => i.id === invasionId && i.active && i.isPlayerAttacker);
      const costs = ACTION_COSTS.hireMercenaries;
      if (!inv) return state;
      if (!canAfford(state.resources, costs)) return state;
      const MERCENARY_INFANTRY = 500;
      const MERCENARY_TURNS = 4;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        invasions: state.invasions.map(i => {
          if (i.id !== invasionId) return i;
          return {
            ...i,
            composition: addUnits(i.composition, { infantry: MERCENARY_INFANTRY }),
            mercenaryBoost: { amount: (i.mercenaryBoost?.amount || 0) + MERCENARY_INFANTRY, turnsRemaining: MERCENARY_TURNS }
          };
        }),
        logs: [...state.logs, { year: state.year, message: `Volunteer brigade of ${MERCENARY_INFANTRY} reinforces the front at ${REGIONS_DATA[inv.targetRegion]?.name}!`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.EMERGENCY_INTERVENTION: {
      // Comeback mechanic (Phase 10) — only while core control is critically low, so a close
      // game stays tense instead of just being over once it's clearly lost. International aid:
      // an immediate resource injection plus diplomatic pressure that cools every war down a bit.
      const costs = ACTION_COSTS.emergencyIntervention;
      if (state.phase !== GamePhases.POST_STATE || getAvgCoreControl(state) >= COMEBACK_THRESHOLD) return state;
      if (!canAfford(state.resources, costs)) return state;
      const nations = { ...state.nations };
      Object.keys(nations).forEach(id => {
        if (!nations[id].isAtWar) return;
        nations[id] = { ...nations[id], hostility: Math.max(nations[id].hostilityFloor || 0, nations[id].hostility - 15) };
      });
      const spentResources = applyCosts(state.resources, costs);
      return {
        ...state,
        resources: { ...spentResources, money: spentResources.money + 50000, manpower: spentResources.manpower + 2000 },
        nations,
        logs: [...state.logs, { year: state.year, message: 'International allies answer the call — emergency aid arrives and war-weariness spreads among your enemies.', type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.SCORCHED_EARTH_DEFENSE: {
      // Comeback mechanic (Phase 10) — a costly, permanent defense bonus for a state fighting
      // for its life. Stacks with repeated use in later crises, same as any other eventDefenseBonus.
      const costs = ACTION_COSTS.scorchedEarthDefense;
      if (state.phase !== GamePhases.POST_STATE || getAvgCoreControl(state) >= COMEBACK_THRESHOLD) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        eventDefenseBonus: (state.eventDefenseBonus || 0) + 0.1,
        logs: [...state.logs, { year: state.year, message: 'Scorched-earth defenses rushed into place. Defense permanently reinforced.', type: LogTypes.CRISIS }]
      };
    }

    case ActionTypes.UPDATE_SLIDER:
      return {
        ...state,
        societalSlider: Math.max(0, Math.min(100, action.payload))
      };

    case ActionTypes.ADD_LOG:
      return {
        ...state,
        logs: [...state.logs, { year: state.year, message: action.payload.message, type: action.payload.type || LogTypes.ACTION }]
      };

    case ActionTypes.LOAD_GAME: {
      const fresh = createInitialState();
      const incoming = migrateLoadedState(action.payload) || {};
      return { ...fresh, ...incoming, gameStatus: incoming.gameStatus || GameStatus.ACTIVE };
    }

    case ActionTypes.RESET_GAME: {
      // doctrineId/difficultyId come from the component layer (GameProvider reads them from
      // meta-progression localStorage) rather than this reducer reading storage directly, so
      // gameReducer stays a pure function of (state, action) — see startingDoctrines.js/difficulty.js.
      const fresh = createInitialState();
      const doctrineId = action.payload?.doctrineId;
      const withDoctrine = doctrineId ? applyStartingDoctrine(fresh, doctrineId) : fresh;
      const difficultyId = action.payload?.difficultyId;
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
  // Meta-progression (achievements + selected starting doctrine) lives in its OWN localStorage
  // key, deliberately separate from the per-save game state — see src/utils/metaProgression.js.
  // Lazy-init reads storage once on mount, matching loadOrCreateState's pattern for the save.
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
  // Dispatching ADD_LOG here re-triggers this effect once, but newlyUnlocked is then empty
  // (already persisted), so it settles after that one extra render — no unlock loop.
  // notifiedRef guards against React StrictMode's dev-only double-invoke of this exact effect:
  // both invocations close over the same pre-update `meta`, so without this they'd both see the
  // achievement as "not yet unlocked" and double-log it. The ref persists across that double
  // invoke (no remount happens), so the second call sees it's already been handled.
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

  // Wraps RESET_GAME with the player's currently-selected starting doctrine, so callers (App.jsx)
  // don't need to know meta-progression's shape just to start a new game.
  const resetGame = useCallback(() => {
    dispatch({ type: ActionTypes.RESET_GAME, payload: { doctrineId: meta.selectedDoctrine, difficultyId: meta.difficulty } });
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
