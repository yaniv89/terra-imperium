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
import { runTurnInWorker, turnWorkerAvailable } from '../services/turnClient';
import { soundsForTransition } from '../audio/worldSounds';
import { isCurrentWorld, currentWorldSpec, rememberWorldSpec, PENDING_START_KEY } from '../worldgen/worldLoader';
import { normalizeSpec, EARTH_SPEC } from '../worldgen/spec';
import { playSounds } from '../audio/sfx';

export { createInitialState, gameReducer };

// ============ PERSISTENCE ============
const STORAGE_KEY = 'terra-imperium-save-v1';
// The storage key is just a stable namespace (kept so existing local saves and cloud rows aren't
// orphaned by a rename). The envelope's `version` MUST be the real state shape version
// (saveMigrations.js's CURRENT_SAVE_VERSION): it used to be a hard-coded 1, which made every load
// re-run the v1→v2 migration and wipe the ADM/DIP/MIL pools.
const SAVE_VERSION = CURRENT_SAVE_VERSION;
const AUTOSAVE_IDLE_MS = 1500;

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

// One world per page load (src/worldgen/worldLoader.js): a game on another world than the one this
// page booted into is never built here. The page remembers that world and reloads into it (once:
// RELOAD_GUARD stops a loop), and a new game waits in PENDING_START_KEY meanwhile.
const RELOAD_GUARD = 'terra-imperium-world-reload';
export const reloadIntoWorld = (spec) => {
  rememberWorldSpec(spec);
  try {
    if (sessionStorage.getItem(RELOAD_GUARD) === JSON.stringify(normalizeSpec(spec))) return false;
    sessionStorage.setItem(RELOAD_GUARD, JSON.stringify(normalizeSpec(spec)));
  } catch (e) { /* storage unavailable */ }
  window.location.reload();
  return true;
};
/** A new game waiting for this page's world (StartScreen chose another world and reloaded). */
// Read once per page (React's StrictMode runs state initialisers twice in development).
let pendingStartTaken;
export const takePendingStart = () => {
  if (pendingStartTaken !== undefined) return pendingStartTaken;
  pendingStartTaken = readPendingStart();
  return pendingStartTaken;
};
const readPendingStart = () => {
  try {
    const raw = localStorage.getItem(PENDING_START_KEY);
    if (!raw) return null;
    const options = JSON.parse(raw);
    if (!isCurrentWorld(options?.scenario?.map)) return null;
    localStorage.removeItem(PENDING_START_KEY);
    return options;
  } catch (e) { return null; }
};
// The state behind the start screen when there is no game to resume: a small game on this page's
// world (the legacy Earth world on Earth, as before).
const placeholderState = () => {
  const spec = currentWorldSpec();
  if (spec.kind !== 'generated') return createInitialState();
  return createInitialState({ playerNationId: 'akkad', rngSeed: 1, scenario: { mode: 'peoples', size: 'small', seed: 1, map: spec } });
};

const loadOrCreateState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return placeholderState();
    const parsed = JSON.parse(raw);
    const migrated = migrateSave(parsed);
    if (migrated) {
      const map = migrated.state.scenario?.map || EARTH_SPEC;
      if (!isCurrentWorld(map)) {
        // The save is on another world: boot into it. A pending new game replaces it anyway.
        if (!localStorage.getItem(PENDING_START_KEY)) reloadIntoWorld(map);
        return placeholderState();
      }
      const hash = currentWorldSpec().worldHash;
      if (map.kind === 'generated' && map.worldHash && hash && map.worldHash !== hash) {
        if (localStorage.getItem(OLD_SAVE_NOTICE_KEY) !== 'seen') pendingSaveProblem = { reason: 'worldMismatch', raw };
        if (!localStorage.getItem(OLD_SAVE_KEY)) localStorage.setItem(OLD_SAVE_KEY, raw);
        return placeholderState();
      }
      return migrated.state;
    }
    const reason = saveProblem(parsed) || 'corrupt';
    if (!localStorage.getItem(OLD_SAVE_KEY)) localStorage.setItem(OLD_SAVE_KEY, raw);
    if (localStorage.getItem(OLD_SAVE_NOTICE_KEY) !== 'seen') pendingSaveProblem = { reason, raw };
    return placeholderState();
  } catch (e) {
    return placeholderState();
  }
};

// Pure, side-effect-visible-only-via-read check: true if a save already exists. Used by the app
// shell to decide whether to show the country-select/difficulty/speed start screen (a brand new
// player, or one whose save is gone) or go straight to GameLayout.
export const hasExistingSave = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return false;
    if (pendingSaveProblem?.reason === 'worldMismatch') return false;
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
  const [state, reducerDispatch] = useReducer(gameReducer, null, loadOrCreateState);
  const stateRef = useRef(state); // the latest state, for the autosave and the turn worker
  stateRef.current = state;
  // Sound (src/audio/ACTIONS.md): every dispatch goes through here so the change it makes can be
  // heard. The sounds are chosen from the state before and after (worldSounds.js, pure) and played
  // by sfx.js after the render; the reducer and the game logic never wait on them.
  const lastActionRef = useRef(null);
  const soundPrevRef = useRef(state);
  const dispatch = useCallback((action) => { lastActionRef.current = action; reducerDispatch(action); }, []);
  useEffect(() => {
    const prev = soundPrevRef.current; soundPrevRef.current = state;
    const action = lastActionRef.current; lastActionRef.current = null;
    if (prev === state || !action) return;
    try { playSounds(soundsForTransition(prev, state, action)); } catch (e) { /* sound never breaks the game */ }
  }, [state]);
  // Dev builds only: read the state and dispatch from the console or a browser check.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__game = { state, dispatch };
    return () => { delete window.__game; };
  }, [state, dispatch]);
  // Meta-progression (achievements + selected starting doctrine/difficulty) lives in its OWN
  // localStorage key, deliberately separate from the per-save game state — see
  // src/utils/metaProgression.js. Lazy-init reads storage once on mount, matching
  // loadOrCreateState's pattern for the save.
  const [meta, setMeta] = useState(() => loadMeta());

  // Autosave. The whole state is plain JSON (no Dates/Maps/class instances), so this is a
  // straight serialize — the only thing intentionally NOT embedded is event *content*
  // (we store activeEventId, not the event object, so a future content patch can't leave a
  // save holding stale copy).
  // Written when the game goes quiet (AUTOSAVE_IDLE_MS after the last change) and when the page is
  // hidden or closed, not after every action: serialising the whole world took tens of ms of the
  // main thread on each army move.
  const saveNow = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, state: stateRef.current, savedAt: Date.now() }));
    } catch (e) {
      // Storage unavailable or full — autosave is best-effort, never fatal.
    }
  }, []);
  useEffect(() => {
    const id = setTimeout(saveNow, AUTOSAVE_IDLE_MS);
    return () => clearTimeout(id);
  }, [state, saveNow]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') saveNow(); };
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('pagehide', saveNow); document.removeEventListener('visibilitychange', onHide); };
  }, [saveNow]);

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
      reducerDispatch({
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
    reducerDispatch({ type: ActionTypes.ADD_LOG, payload: { message, type } });
  }, []);

  // The turn runs in a Web Worker (src/services/turnClient.js, plans/rts-world-review.md 6.4), so
  // the map stays responsive while the world moves; the result is applied only if the game is
  // still where the turn started (APPLY_TURN_RESULT). Without workers, or if the worker fails,
  // the turn runs here as before. `turnPending` lets the header show "The world moves".
  const pendingRef = useRef(false);
  const [turnPending, setTurnPending] = useState(false);
  const runTurn = useCallback(async (type) => {
    if (pendingRef.current) return;
    playSounds(['turn-end']);
    const from = stateRef.current;
    if (!turnWorkerAvailable()) { dispatch({ type }); return; }
    pendingRef.current = true; setTurnPending(true);
    const resolved = await runTurnInWorker(from, { type });
    pendingRef.current = false; setTurnPending(false);
    if (resolved) dispatch({ type: ActionTypes.APPLY_TURN_RESULT, payload: { from, state: resolved } });
    else if (stateRef.current === from) dispatch({ type });
  }, [dispatch]);
  const advanceTurn = useCallback(() => runTurn(ActionTypes.ADVANCE_TURN), [runTurn]);
  const fastForward = useCallback(() => runTurn(ActionTypes.FAST_FORWARD), [runTurn]);

  const resolveEvent = useCallback((optionIndex) => {
    dispatch({ type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex } });
  }, [dispatch]);

  // Starts a new game as `playerNationId` at the chosen `gameSpeed`, layering in the player's
  // persisted starting doctrine and (if the start screen picked one) difficulty — see the
  // country-select + difficulty + speed start screen this feeds.
  const resetGame = useCallback((options = {}) => {
    // A game on another world: remember it, keep the choices and reload into that world; the new
    // page starts it (App.jsx, takePendingStart).
    const map = options.scenario?.map || EARTH_SPEC;
    if (!isCurrentWorld(map)) {
      try { localStorage.setItem(PENDING_START_KEY, JSON.stringify(options)); } catch (e) { /* storage unavailable */ }
      reloadIntoWorld(map);
      return;
    }
    rememberWorldSpec(map);
    dispatch({
      type: ActionTypes.RESET_GAME,
      payload: {
        playerNationId: options.playerNationId,
        gameSpeed: options.gameSpeed,
        scenario: options.scenario,
        rngSeed: options.scenario?.seed,
        guided: !!options.guided,
        exploredWorld: !!options.exploredWorld, // the "explored world" option: no fog of war (engine/fog.js)
        doctrineId: meta.selectedDoctrine,
        difficultyId: options.difficultyId || meta.difficulty
      }
    });
  }, [meta.selectedDoctrine, meta.difficulty, dispatch]);

  const exportSave = useCallback(() => {
    return JSON.stringify({ version: SAVE_VERSION, state, savedAt: Date.now() }, null, 2);
  }, [state]);

  // Returns true, or the reason it could not load ('tooOld', 'oldGrid', 'tooNew', 'corrupt'; saveMigrations.js).
  const importSave = useCallback((jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      const migrated = migrateSave(parsed);
      if (!migrated) return saveProblem(parsed) || 'corrupt';
      const map = migrated.state.scenario?.map || EARTH_SPEC;
      if (!isCurrentWorld(map)) {
        // Another world: store the save as the current game and boot into its world.
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, state: migrated.state, savedAt: Date.now() }));
        reloadIntoWorld(map);
        return true;
      }
      dispatch({ type: ActionTypes.LOAD_GAME, payload: migrated.state });
      return true;
    } catch (e) {
      return 'corrupt';
    }
  }, [dispatch]);

  const contextValue = useMemo(() => ({
    state,
    dispatch,
    addLog,
    advanceTurn,
    fastForward,
    turnPending,
    resolveEvent,
    resetGame,
    exportSave,
    importSave,
    meta,
    selectDoctrine,
    selectDifficulty,
    completeOnboarding
  }), [state, dispatch, addLog, advanceTurn, fastForward, turnPending, resolveEvent, resetGame, exportSave, importSave, meta, selectDoctrine, selectDifficulty, completeOnboarding]);

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};

export default GameContext;
