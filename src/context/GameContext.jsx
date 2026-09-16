// src/context/GameContext.jsx
// Game state management using React Context and useReducer.
//
// Turn resolution and event resolution are delegated to pure functions in src/engine/ —
// the reducer's job is validation + a single atomic state transition per dispatch.

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { GameStatus, ActionTypes, RelationStatus, LogTypes } from '../data/types';
import { REGIONS_DATA } from '../data/regions';
import { WORLD_NATIONS } from '../data/worldNations';
import { TECH_TREE } from '../data/techTree';
import { HISTORICAL_EVENTS } from '../data/events';
import { EVENT_CHAINS } from '../data/eventChains';
import { START_YEAR, getCalendarAgeId } from '../data/ages';
import { createEmptyResourcePool } from '../data/resources';
import { resolveTurn } from '../engine/resolveTurn';
import { applyEventEffects } from '../engine/applyEventEffects';
import { randomSeed } from '../utils/rng';
import { ACHIEVEMENTS, checkAchievements } from '../data/achievements';
import { applyStartingDoctrine } from '../data/startingDoctrines';
import { applyDifficulty } from '../data/difficulty';
import { loadMeta, saveMeta } from '../utils/metaProgression';

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
      isOccupied: false
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
      hostilityFloor: 0
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

    // Wars and invasions — the combat/invasion resolution engine that reads these is Phase C work.
    wars: [],
    invasions: [],
    nextInvasionSeq: 0,
    counterAttackWindows: {},
    hiredCommanders: [],

    // Events
    activeEventId: null,
    activeProceduralEvent: null,
    proceduralEventCooldown: 0,
    pendingEventChains: [],
    firedEvents: {},

    // Persistent effect from event choices, applied to combat once combat exists again (Phase C).
    eventDefenseBonus: 0,

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
