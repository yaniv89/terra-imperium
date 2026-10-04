// src/context/GameContext.jsx
// Game state management using React Context and useReducer.
//
// Turn resolution and event resolution are delegated to pure functions in src/engine/ —
// the reducer's job is validation + a single atomic state transition per dispatch.

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ActionTypes, LogTypes } from '../data/types';
import { ACHIEVEMENTS, checkAchievements } from '../data/achievements';
import { loadMeta, saveMeta } from '../utils/metaProgression';
// The reducer + initial-state factory now live in src/engine/gameReducer.js (Phase F, plan §10) so
// they're importable, unmodified, from a server-authoritative context too — re-exported here so
// every existing `from '../context/GameContext'` import site keeps working unchanged.
import { createInitialState, gameReducer } from '../engine/gameReducer';
import { migrateSave, CURRENT_SAVE_VERSION, saveProblem } from '../engine/saveMigrations';

export { createInitialState, gameReducer };

// ============ PERSISTENCE ============
const STORAGE_KEY = 'terra-imperium-save-v1';
// The storage key is just a stable namespace (kept so existing local saves and cloud rows aren't
// orphaned by a rename). The envelope's `version` MUST be the real state shape version
// (saveMigrations.js's CURRENT_SAVE_VERSION): it used to be a hard-coded 1, which made every load
// re-run the v1→v2 migration and wipe the ADM/DIP/MIL pools.
const SAVE_VERSION = CURRENT_SAVE_VERSION;

// Lazily load a saved game, falling back to a fresh one. migrateSave handles version upgrades and
// backfills any field a newer build added that this save predates; a save it can't read at all
// (corrupt, or from a future build) is left untouched in storage and a fresh game starts instead —
// see saveMigrations.js's own header for why this never deletes anything.
// A save this build cannot read is set aside under OLD_SAVE_KEY before the fresh game's first
// autosave would overwrite it (the save v7 screen offers it for download); the raw text and the
// reason are kept for that screen. Never deleted here.
export const OLD_SAVE_KEY = 'terra-imperium-save-old';
export const OLD_SAVE_NOTICE_KEY = 'terra-imperium-save-old-notice';
let pendingSaveProblem = null; // { reason, raw } for the session, once a load failed
export const getPendingSaveProblem = () => pendingSaveProblem;
export const dismissSaveProblem = () => { pendingSaveProblem = null; try { localStorage.setItem(OLD_SAVE_NOTICE_KEY, 'seen'); } catch (e) { /* storage unavailable */ } };
export const getOldSaveText = () => { try { return localStorage.getItem(OLD_SAVE_KEY); } catch (e) { return null; } };

const loadOrCreateState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    const migrated = migrateSave(parsed);
    if (migrated) return migrated.state;
    const reason = saveProblem(parsed) || 'corrupt';
    if (!localStorage.getItem(OLD_SAVE_KEY)) localStorage.setItem(OLD_SAVE_KEY, raw);
    if (localStorage.getItem(OLD_SAVE_NOTICE_KEY) !== 'seen') pendingSaveProblem = { reason, raw };
    return createInitialState();
  } catch (e) {
    return createInitialState();
  }
};

// Pure, side-effect-visible-only-via-read check: true if a save already exists. Used by the app
// shell to decide whether to show the country-select/difficulty/speed start screen (a brand new
// player, or one whose save is gone) or go straight to GameLayout.
export const hasExistingSave = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return false;
    return saveProblem(JSON.parse(raw)) === null; // a save this build cannot read is no save to resume: pick a nation
  } catch (e) {
    return false;
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
  // Dev builds only: read the state and dispatch from the console or a browser check.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__game = { state, dispatch };
    return () => { delete window.__game; };
  }, [state]);
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

  const completeOnboarding = useCallback(() => {
    setMeta(prev => {
      const updated = { ...prev, hasSeenOnboarding: true };
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
        scenario: options.scenario,
        rngSeed: options.scenario?.seed,
        guided: !!options.guided,
        doctrineId: meta.selectedDoctrine,
        difficultyId: options.difficultyId || meta.difficulty
      }
    });
  }, [meta.selectedDoctrine, meta.difficulty]);

  const exportSave = useCallback(() => {
    return JSON.stringify({ version: SAVE_VERSION, state, savedAt: Date.now() }, null, 2);
  }, [state]);

  // Returns true, or the reason it could not load ('tooOld', 'oldGrid', 'tooNew', 'corrupt'; saveMigrations.js).
  const importSave = useCallback((jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      const migrated = migrateSave(parsed);
      if (!migrated) return saveProblem(parsed) || 'corrupt';
      dispatch({ type: ActionTypes.LOAD_GAME, payload: migrated.state });
      return true;
    } catch (e) {
      return 'corrupt';
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
    selectDifficulty,
    completeOnboarding
  }), [state, addLog, advanceTurn, fastForward, resolveEvent, resetGame, exportSave, importSave, meta, selectDoctrine, selectDifficulty, completeOnboarding]);

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};

export default GameContext;
