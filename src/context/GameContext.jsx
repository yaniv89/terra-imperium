// src/context/GameContext.jsx
// Game state management using React Context and useReducer.
//
// Turn resolution and event resolution are delegated to pure functions in src/engine/ —
// the reducer's job is validation + a single atomic state transition per dispatch. Player
// actions (buy land, train troops, diplomacy, research, invasions) are likewise atomic:
// each is validated against the reducer's own (authoritative, non-stale) state and applied
// in one dispatch, so double-click / stale-snapshot double-spend is not reachable.

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import { GamePhases, GameStatus, ActionTypes, RelationStatus, LogTypes } from '../data/types';
import { REGIONS_DATA, CORE_REGION_IDS } from '../data/regions';
import { NATIONS_DATA, INDEPENDENCE_WAR_ATTACKERS } from '../data/nations';
import { TECH_TREE } from '../data/techTree';
import { HISTORICAL_EVENTS } from '../data/events';
import { ACTION_COSTS } from '../data/actionCosts';
import { canAfford, applyCosts, calcMilitaryPower } from '../utils/helpers';
import { resolveTurn } from '../engine/resolveTurn';
import { applyEventEffects } from '../engine/applyEventEffects';
import { randomSeed } from '../utils/rng';

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
        relationStatus: data.startRelation || RelationStatus.NEUTRAL,
        isAtWar: false,
        hasPeaceTreaty: false,
        hasTradeAgreement: false,
        hasMilitaryPact: false
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
    militaryPower: 0,

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

    // Events
    activeEventId: null,
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

// ============ REDUCER ============
// Exported for direct unit testing (see GameContext.test.js) — the reducer is the authoritative
// validation point for every player action, so it should be testable without mounting React.
export const gameReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.ADVANCE_TURN:
      return resolveTurn(state);

    case ActionTypes.RESOLVE_EVENT: {
      const event = HISTORICAL_EVENTS[state.activeEventId];
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
        militaryPower: state.undergroundStrength * 2,
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
        militaryPower: state.militaryPower + 1000,
        logs: [...state.logs, { year: state.year, message: 'Trained IDF infantry. +1000 military power', type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_TANKS: {
      const costs = ACTION_COSTS.buildTanks;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        militaryPower: state.militaryPower + 2000,
        logs: [...state.logs, { year: state.year, message: 'Built armored units. +2000 military power', type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_JETS: {
      const costs = ACTION_COSTS.buildJets;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        militaryPower: state.militaryPower + 3000,
        logs: [...state.logs, { year: state.year, message: 'Built air force jets. +3000 military power', type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.LAUNCH_PLAYER_INVASION: {
      const { targetRegion } = action.payload;
      const region = state.regions[targetRegion];
      const enemyNation = region ? state.nations[region.owner] : null;
      const costs = ACTION_COSTS.launchInvasion;
      if (!region || region.owner === 'player' || !enemyNation || !enemyNation.isAtWar) return state;
      if (!canAfford(state.resources, costs)) return state;
      const strength = calcMilitaryPower(state);
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nextInvasionSeq: state.nextInvasionSeq + 1,
        invasions: [
          ...state.invasions,
          {
            id: `inv_player_${state.turnNumber}_${state.nextInvasionSeq}`,
            targetRegion,
            strength,
            morale: 100,
            supply: 100,
            active: true,
            isPlayerAttacker: true
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
      const { nationId } = action.payload;
      const nation = state.nations[nationId];
      const costs = ACTION_COSTS.declareWar;
      if (!nation || nation.isAtWar) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [nationId]: { ...nation, isAtWar: true, hostility: 100, relationStatus: RelationStatus.WAR } },
        wars: [...state.wars, { id: `war_${nationId}_${state.year}`, enemy: nationId, startYear: state.year, active: true }],
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
      if (!tech || !techState || techState.researched || tech.yearAvailable > state.year) return state;
      const hasPrereqs = tech.prerequisites.every(p => state.techTree[p]?.researched);
      if (!hasPrereqs) return state;
      const costs = { money: tech.cost.money, techPoints: tech.cost.techPoints, actionPoints: ACTION_COSTS.researchTechActionPoints };
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        techTree: { ...state.techTree, [techId]: { ...techState, researched: true } },
        logs: [...state.logs, { year: state.year, message: `Researched: ${tech.name}`, type: LogTypes.TECH }]
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
      const incoming = action.payload || {};
      return { ...fresh, ...incoming, gameStatus: incoming.gameStatus || GameStatus.ACTIVE };
    }

    case ActionTypes.RESET_GAME:
      return createInitialState();

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

  const addLog = useCallback((message, type = LogTypes.ACTION) => {
    dispatch({ type: ActionTypes.ADD_LOG, payload: { message, type } });
  }, []);

  // Turn/event resolution now needs no payload from the component — the reducer always
  // operates on the true latest state, so there is no stale-closure window to race.
  const advanceTurn = useCallback(() => {
    dispatch({ type: ActionTypes.ADVANCE_TURN });
  }, []);

  const resolveEvent = useCallback((optionIndex) => {
    dispatch({ type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex } });
  }, []);

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
    resolveEvent,
    exportSave,
    importSave
  }), [state, addLog, advanceTurn, resolveEvent, exportSave, importSave]);

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};

export default GameContext;
