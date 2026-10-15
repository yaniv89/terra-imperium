// src/App.jsx
// Main application component - Terra Imperium

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { GameProvider, useGame, hasExistingSave, takePendingStart, setLaunchHold, stashCurrentGame, readSaveText, removeSave, AUTOSAVE_KEY, PREVIOUS_SAVE_KEY } from './context/GameContext';
import TitleScreen from './components/ui/TitleScreen';
import { launchScreen, describeSave } from './utils/launchDecision';
import { EffectsProvider, useEffects } from './context/EffectsContext';
import { MapInsetsProvider } from './context/MapInsetsContext';
import { StartScreen } from './components/ui';
import WorldTopBar from './components/ui/WorldTopBar';
import TurnDock from './components/ui/TurnDock';
import NextPrompt from './components/ui/NextPrompt';
import MapGoals from './components/map/MapGoals';
import SettingsSheet from './components/ui/SettingsSheet';
import TurnReportSheet from './components/ui/TurnReportSheet';
import NationOverviewSheet from './components/ui/NationOverviewSheet';
import { OPEN_SETTINGS } from './components/ui/uiEvents';
import { SELECT_REGION, openCityOnMap } from './components/map/marchEvents';
import WaitingChips from './components/ui/WaitingChips';
import ConfirmDialog from './components/ui/ConfirmDialog';
import { useAutoDismiss } from './hooks/useAutoDismiss';
import FirstContactCard from './components/modals/FirstContactCard';
import { MapContainer } from './components/map';
import { PanelDrawer, LogTrigger, LogDrawer } from './components/panels';
import { EventModal, GameOverModal, AccountModal, ConflictChooserModal, OnboardingOverlay, AgeAdvanceBanner, NationEliminatedBanner, OldSaveNotice } from './components/modals';
import AdminPage from './components/admin/AdminPage';

// The commanded-battle screen (three.js + the sim worker) only downloads when a battle starts.
const TacticalBattleHost = lazyWithReload(() => import('./components/battle/TacticalBattleHost'));
import { GameStatus, ActionTypes } from './data/types';
import { HISTORICAL_EVENTS } from './data/events';
import { EVENT_CHAINS } from './data/eventChains';
import { AGES } from './data/ages';
import { getNationCapital } from './data/regions';
import DefenseSheet from './components/battle/DefenseSheet';
import BattleReportsHost from './components/battle/BattleReportsHost';
import ResearchChoiceSheet from './components/modals/ResearchChoiceSheet';
import PeaceOfferSheet from './components/battle/PeaceOfferSheet';
import { useCloudSync } from './hooks/useCloudSync';
import { startMusic } from './audio/music';
import { unlockSfx } from './audio/sfx';
import { installUiSounds } from './audio/uiSounds';
import { getSupabaseClient, isCloudSaveConfigured } from './services/supabaseClient';
import { getCurrentUser, onAuthStateChange, getProfile } from './services/auth';
import { lazyWithReload } from './utils/lazyWithReload';
import RotateOverlay from './components/ui/RotateOverlay';
import InstallHint from './components/ui/InstallHint';
import TurnDebugLog, { turnDebugOn } from './components/ui/TurnDebugLog';
import CityRail from './components/city/CityRail';
import IndependentsHost from './components/independents/IndependentsHost';
import CaptureCard from './components/capture/CaptureCard';
import { noteScreen } from './utils/crashLog';

const AGE_ADVANCE_BANNER_MS = 5000;

// The saved games the title screen lists: the autosave, and the game before it (New game and Load
// keep the game being left there). A slot this build cannot read still shows, marked as old.
const readTitleSlots = () => [
  { id: 'autosave', key: AUTOSAVE_KEY, label: 'Last game (autosave)', info: describeSave(readSaveText(AUTOSAVE_KEY)) },
  { id: 'previous', key: PREVIOUS_SAVE_KEY, label: 'Game before it', info: describeSave(readSaveText(PREVIOUS_SAVE_KEY)) }
].filter((s) => s.info.status !== 'none');

// Main game layout component
const GameLayout = () => {
  const { state, dispatch, resolveEvent, resetGame, importSave, meta, completeOnboarding } = useGame();
  const { triggerEffect } = useEffects();
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('domestic');
  // Event log (plan feedback: it used to be a permanently embedded panel eating real vertical
  // space even collapsed). LogTrigger shows how many log lines arrived since the drawer was last
  // opened; lastSeenLogCountRef only updates on open, not on every new log, so the badge doesn't
  // reset itself while the player just keeps playing with the drawer closed.
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const lastSeenLogCountRef = useRef(0);
  const handleOpenLogDrawer = useCallback(() => {
    lastSeenLogCountRef.current = state.logs.length;
    setLogDrawerOpen(true);
  }, [state.logs.length]);

  // Accounts & cloud saves (plan §M0.5). `client` is stable for the app's lifetime once cloud
  // saves are configured at all; `user`/`profile` track sign-in state so a guest never triggers
  // any of this. Cloud sync is purely additive on top of the existing local autosave above — a
  // guest keeps exactly today's local-only save/export, signing in only adds the cloud autosave +
  // 3 manual slots (src/components/modals/AccountModal.jsx) on top.
  const client = isCloudSaveConfigured ? getSupabaseClient() : null;
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (!client) return undefined;
    getCurrentUser(client).then(setUser).catch(() => {});
    return onAuthStateChange(client, setUser);
  }, [client]);
  useEffect(() => {
    if (!client || !user) { setProfile(null); return; }
    getProfile(client, user.id).then(setProfile).catch(() => {});
  }, [client, user]);

  const getPayload = useCallback(() => ({ version: 1, state }), [state]);
  const onAdoptState = useCallback((adoptedState) => {
    dispatch({ type: ActionTypes.LOAD_GAME, payload: adoptedState });
  }, [dispatch]);
  const cloudSync = useCloudSync({ client, user, getPayload, onAdoptState });

  // Every completed End Turn (turnNumber only ever counts up during real play — see the age-banner
  // effect above for why that's the reliable "did a turn actually happen" signal) queues the
  // latest state for the cloud autosave slot. No-op while signed out; useCloudSync itself is what
  // guards that.
  const prevTurnForSyncRef = useRef(state.turnNumber);
  useEffect(() => {
    if (state.turnNumber > prevTurnForSyncRef.current) cloudSync.syncNow(getPayload());
    prevTurnForSyncRef.current = state.turnNumber;
  }, [state.turnNumber, cloudSync, getPayload]);
  // A brand-new player (no save yet) sees the country-select/difficulty/speed start screen
  // before anything else; an existing save skips straight to the loaded game.
  // A new game chosen on another world before the reload into it (GameContext resetGame) starts
  // as soon as this page, booted into that world, is up.
  const [pendingStart] = useState(() => takePendingStart());
  // X26: with a readable save, every launch shows the title screen first (Continue, New game,
  // Load, Settings); the old save is never resumed behind the player's back. The decision is
  // src/utils/launchDecision.js. The autosave stays quiet until the player has chosen.
  const [launch] = useState(() => {
    const screen = launchScreen({ pendingStart: !!pendingStart, hasSave: hasExistingSave() });
    setLaunchHold(screen === 'title');
    return screen;
  });
  const [showTitle, setShowTitle] = useState(launch === 'title');
  const [cameFromTitle, setCameFromTitle] = useState(launch === 'title');
  const [showStartScreen, setShowStartScreen] = useState(launch === 'start');
  const [titleSlots, setTitleSlots] = useState(() => (launch === 'title' ? readTitleSlots() : []));
  // Where the player is, for the crash log (src/utils/crashLog.js; never shown to the player).
  const onBattle = !!state.pendingBattle;
  useEffect(() => {
    noteScreen(showTitle ? 'title' : showStartScreen ? 'start' : onBattle ? 'battle' : 'map', state.turnNumber);
  }, [showTitle, showStartScreen, onBattle, state.turnNumber]);

  // Age Advance banner + globe pulse (plan §10.5's "showpiece", previously never built — the
  // calendar age used to change with zero on-screen feedback). prevAgeRef starts at the CURRENT
  // age so loading a save mid-age never spuriously fires this on mount, matching
  // prevLogCountRef's pattern below. prevTurnRef additionally guards against a game RESET: a
  // fresh Bronze Age start after finishing a previous run in, say, the Modern Age would otherwise
  // look like an age change too — turnNumber only ever counts up during real play, so a turn
  // count that didn't increase means this is a new game, not a genuine advance.
  const prevAgeRef = useRef(state.age);
  const prevTurnRef = useRef(state.turnNumber);
  const [ageBanner, setAgeBanner] = useState(null);
  useEffect(() => {
    const isReset = state.turnNumber <= prevTurnRef.current;
    prevTurnRef.current = state.turnNumber;
    if (isReset || state.age === prevAgeRef.current) {
      prevAgeRef.current = state.age;
      return;
    }
    prevAgeRef.current = state.age;
    setAgeBanner(AGES[state.age]?.name || state.age);
    triggerEffect('age_advance', { region: getNationCapital(state.playerNationId) });
  }, [state.age, state.turnNumber, state.playerNationId, triggerEffect]);
  // Its five seconds run on their own clock: ending the next turn at once no longer cancels the
  // timer and leaves the banner over the top bar (playtest audit X19, I161). The news itself
  // stays in the log.
  useAutoDismiss(ageBanner, () => setAgeBanner(null), AGE_ADVANCE_BANNER_MS);

  // Nation Eliminated banner (h2's "small reward for winning the war" popup): resolveTurn.js sets
  // state.playerEliminatedNationId for exactly the one turn a player conquest reduces a rival to
  // zero regions (src/engine/elimination.js), then it reverts to null/undefined next turn.
  // prevEliminatedIdRef starts at the CURRENT value so loading a save that happens to have been
  // written mid-banner never spuriously fires this on mount, same reasoning as prevAgeRef above.
  const prevEliminatedIdRef = useRef(state.playerEliminatedNationId);
  const [eliminatedNationName, setEliminatedNationName] = useState(null);
  useEffect(() => {
    const isNewElimination = state.playerEliminatedNationId && state.playerEliminatedNationId !== prevEliminatedIdRef.current;
    prevEliminatedIdRef.current = state.playerEliminatedNationId;
    if (!isNewElimination) return;
    setEliminatedNationName(state.nations[state.playerEliminatedNationId]?.name || state.playerEliminatedNationId);
  }, [state.playerEliminatedNationId, state.nations]);
  // The same clock of its own (this effect reruns on every change to the nations).
  useAutoDismiss(eliminatedNationName, () => setEliminatedNationName(null), AGE_ADVANCE_BANNER_MS);

  // Handle game reset. No confirmation needed once the run has already ended (Victory/Defeat) —
  // there's nothing left to lose. Routes back through the start screen so the player can pick a
  // new nation/speed/difficulty rather than silently restarting as whatever they last played.
  // A game in progress asks first, in the game's own dialog (ConfirmDialog, playtest audit I166).
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const goToStart = useCallback(() => {
    setConfirmNewGame(false);
    setCameFromTitle(false);
    setShowStartScreen(true);
    setSelectedRegion(null);
  }, []);
  const handleReset = useCallback(() => {
    if (state.gameStatus !== GameStatus.ACTIVE) goToStart();
    else setConfirmNewGame(true);
  }, [state.gameStatus, goToStart]);
  const cancelNewGame = useCallback(() => setConfirmNewGame(false), []);

  const handleStart = useCallback((options) => {
    stashCurrentGame(); // the game being left stays under Load (X26)
    setLaunchHold(false);
    resetGame(options);
    setShowStartScreen(false);
  }, [resetGame]);

  // Title screen actions (X26).
  const leaveTitle = useCallback(() => { setLaunchHold(false); setShowTitle(false); }, []);
  const titleNewGame = useCallback(() => { setShowTitle(false); setShowStartScreen(true); }, []);
  const backToTitle = useCallback(() => { setTitleSlots(readTitleSlots()); setShowStartScreen(false); setShowTitle(true); }, []);
  const titleLoad = useCallback((key) => {
    if (key === AUTOSAVE_KEY) { leaveTitle(); return; }
    const raw = readSaveText(key);
    if (!raw) return;
    stashCurrentGame();
    const result = importSave(raw);
    if (result === true) leaveTitle();
  }, [importSave, leaveTitle]);
  const titleImport = useCallback((text) => {
    stashCurrentGame();
    const result = importSave(text);
    if (result === true) leaveTitle();
    return result;
  }, [importSave, leaveTitle]);
  const titleDelete = useCallback((key) => {
    removeSave(key);
    if (key === AUTOSAVE_KEY) {
      // The game in memory must not come back: promote the earlier game, then reload.
      const earlier = readSaveText(PREVIOUS_SAVE_KEY);
      if (earlier) { try { localStorage.setItem(AUTOSAVE_KEY, earlier); } catch (e) { /* storage unavailable */ } removeSave(PREVIOUS_SAVE_KEY); }
      window.location.reload();
      return;
    }
    setTitleSlots(readTitleSlots());
  }, []);
  const pendingStarted = useRef(false);
  useEffect(() => { if (pendingStart && !pendingStarted.current) { pendingStarted.current = true; handleStart(pendingStart); } }, [pendingStart, handleStart]);

  // Plan §M18: "Continue playing after victory" — an ambition win before END_YEAR isn't forced to
  // end the run; dismissing GameOverModal this way resumes play instead of resetting to the start
  // screen.
  const handleContinueAfterVictory = useCallback(() => {
    dispatch({ type: ActionTypes.CONTINUE_AFTER_VICTORY });
  }, [dispatch]);

  // Handle region selection
  const handleSelectRegion = useCallback((regionId) => {
    setSelectedRegion(regionId);
  }, []);
  // Any part of the UI can open a city (the city list, a "needs you" chip, the turn report).
  useEffect(() => {
    const onSelect = (e) => handleSelectRegion(e.detail || null);
    window.addEventListener(SELECT_REGION, onSelect);
    return () => window.removeEventListener(SELECT_REGION, onSelect);
  }, [handleSelectRegion]);
  // Settings (W12) open from Menu on the tab rail.
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => {
    const onOpen = () => setShowSettings(true);
    window.addEventListener(OPEN_SETTINGS, onOpen);
    return () => window.removeEventListener(OPEN_SETTINGS, onOpen);
  }, []);
  // Dev builds only: open a province from the console / browser tests (the globe is hard to click).
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__selectRegion = handleSelectRegion;
    return () => { delete window.__selectRegion; };
  }, [handleSelectRegion]);

  if (showTitle) {
    return (
      <>
        <TitleScreen slots={titleSlots} onContinue={leaveTitle} onNewGame={titleNewGame} onLoad={titleLoad} onDelete={titleDelete}
          onImportText={titleImport} onSettings={() => setShowSettings(true)} />
        <SettingsSheet open={showSettings} onClose={() => setShowSettings(false)} onOpenAccount={() => setShowSettings(false)} onReset={() => { setShowSettings(false); titleNewGame(); }} cloudLabel={null} />
      </>
    );
  }
  if (showStartScreen) {
    return <><StartScreen onStart={handleStart} onBackToTitle={cameFromTitle ? backToTitle : undefined} /><OldSaveNotice /></>;
  }

  return (
    <div className="h-[100dvh] w-full bg-fa-ink text-fa-text relative overflow-hidden">
      {/* Layer 0: the map is the entire game surface (plan feedback: "combine the map and the
          play panel into one surface" instead of two separate sections) — everything else below
          floats over it as a fixed/absolute overlay rather than claiming its own layout space. */}
      <div className="absolute inset-0">
        <MapContainer
          selectedRegion={selectedRegion}
          onSelectRegion={handleSelectRegion}
        />
      </div>

      {/* The one world top bar (plans/UI-DESIGN.md section 2), floating over the map's top edge. */}
      <WorldTopBar />

      {/* "Needs you" chips under the top bar (W02): tap one to jump there. */}
      {/* data-map-hud: the map's names keep clear of them (I081). */}
      <div className="fixed z-10 start-[calc(max(var(--safe-start),0.75rem)+var(--city-rail-w,0px))] top-[calc(var(--header-height,2.25rem)+0.625rem)] pointer-events-none needs-you">
        {state.gameStatus === GameStatus.ACTIVE && (
          <div className="flex flex-col items-start gap-1.5" data-map-hud="group">
            {/* Decisions that wait behind the one on screen (useExclusivePanel.js), then the chips. */}
            <WaitingChips />
            <NextPrompt />
            {/* The map's hint and the era goals under the chips, never under them (I083). */}
            <MapGoals />
          </div>
        )}
      </div>

      {/* First contact with a people (W03). */}
      <FirstContactCard />

      {/* End Turn, bottom right (W02, W10). */}
      <TurnDock />

      {/* Desktop: the city list rail on the left (plans/civ-map-rework.md E2). */}
      <CityRail onSelectRegion={openCityOnMap} />

      {/* Empire-management tabs/content: a collapsible right-docked drawer on desktop, a bottom
          tab bar + on-demand sheet on mobile (PanelDrawer.jsx) — floating over the map instead of
          a fixed sidebar column next to it. */}
      <PanelDrawer
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenLog={handleOpenLogDrawer}
        unreadLogs={Math.max(0, state.logs.length - lastSeenLogCountRef.current)}
      />

      {/* Event log trigger — a small floating button now that there's no sidebar column left for
          it to sit at the bottom of (the log's actual content only exists in the LogDrawer
          overlay below, opened on demand). */}
      <LogTrigger onClick={handleOpenLogDrawer} unreadCount={Math.max(0, state.logs.length - lastSeenLogCountRef.current)} />

      {/* Event Modal - overlays everything when active. A procedural event (Phase 6) is carried
          in full on the state itself rather than looked up by id from HISTORICAL_EVENTS. A chain
          event (Phase 10) is looked up by id too, but from EVENT_CHAINS. */}
      <EventModal
        event={state.activeEventId
          ? (HISTORICAL_EVENTS[state.activeEventId] || EVENT_CHAINS[state.activeEventId])
          : state.activeProceduralEvent}
        onResolve={resolveEvent}
        resources={state.resources}
        placeName={state.activeProceduralEvent?.cityId ? state.regions[state.activeProceduralEvent.cityId]?.name || null : null}
        cityId={state.activeProceduralEvent?.cityId || null}
      />

      {/* Game Over screen - overlays everything once the run ends */}
      <GameOverModal
        status={state.gameStatus}
        state={state}
        onReset={handleReset}
        onContinue={handleContinueAfterVictory}
      />

      {/* The turn report (W10): what the turn brought, grouped, with a place on each line.
          It replaces the old battle summary toast (battles are its first group). */}
      <TurnReportSheet />

      {/* The nation overview (W17), from the name on the top bar */}
      <NationOverviewSheet />

      {/* Age Advance banner - non-blocking, auto-dismisses (plan §10.5's "showpiece") */}
      <AgeAdvanceBanner ageName={ageBanner} onDismiss={() => setAgeBanner(null)} />

      {/* Nation Eliminated banner - non-blocking, auto-dismisses */}
      <NationEliminatedBanner nationName={eliminatedNationName} onDismiss={() => setEliminatedNationName(null)} />

      {/* Event Log drawer - the log's actual content, opened on demand from LogTrigger above */}
      <LogDrawer open={logDrawerOpen} onClose={() => setLogDrawerOpen(false)} />

      {/* Settings and saves (W12), from Menu on the tab rail */}
      <SettingsSheet open={showSettings} onClose={() => setShowSettings(false)} onOpenAccount={() => { setShowSettings(false); setShowAccount(true); }} onReset={handleReset} cloudLabel={client ? (cloudSync.status === 'synced' ? 'Cloud saves: saved' : 'Cloud saves and account') : null} />

      {/* Cloud saves + account (plan §M0.5) - opened from Settings */}
      <AccountModal
        open={showAccount}
        onClose={() => setShowAccount(false)}
        onOpenAdmin={() => { setShowAccount(false); setShowAdmin(true); }}
      />

      {/* Admin page (plan §M0.5) - only reachable via AccountModal's Admin button, which only
          renders for profile.role === 'admin'; the database's RLS is the real gate (see
          supabase/migrations/0003_accounts_saves_admin.sql), this is just the UI entry point. */}
      {user && profile?.role === 'admin' && (
        <AdminPage open={showAdmin} onClose={() => setShowAdmin(false)} client={client} adminId={user.id} />
      )}

      {/* Cross-device save conflict (plan §M0.5) - blocks play until resolved, since there is no
          silent merge between two diverged games. */}
      {/* Under attack (Tactical Battles plan §16) - assaults on your garrisons to fight before the turn ends */}
      <DefenseSheet />
      {/* An AI enemy's peace offer - the player always decides whether their war ends */}
      <PeaceOfferSheet />
      {/* Choose research at game start and when a tech is done (plan §2); waits for onboarding */}
      <ResearchChoiceSheet hidden={!meta.hasSeenOnboarding} />
      {/* Auto-resolve replays and battle report sheets (plan §6) */}
      <BattleReportsHost onShowRegion={handleSelectRegion} />
      {/* The independents' sheets: the city sheet, tribute demands and join offers (phase W4) */}
      <IndependentsHost />
      {/* The capture card: Conquer, Raze, Make tributary or Free after a city falls to you (decision 40) */}
      <CaptureCard />
      {state.pendingBattle && <Suspense fallback={<div className="fixed inset-0 z-[80] bg-slate-950 flex items-center justify-center text-slate-300 text-sm">Preparing the battlefield…</div>}><TacticalBattleHost /></Suspense>}
      <ConflictChooserModal conflict={cloudSync.conflict} onChoose={cloudSync.resolveConflict} />

      {/* New game, asked in the game's own words (playtest audit I166). */}
      <ConfirmDialog open={confirmNewGame} title="Start a new game?" confirmLabel="New game" cancelLabel="Keep playing" danger onConfirm={goToStart} onCancel={cancelNewGame} testId="new-game-confirm">
        <p>You go to the start screen to choose a people and a world.</p>
        <p>Your game as {state.nations[state.playerNationId]?.name || 'your people'} (turn {state.turnNumber}) stays saved on this device. When the new game begins it moves to Load on the title screen.</p>
      </ConfirmDialog>

      {/* Onboarding (Phase H) - once ever, per browser, for a genuinely new player. Sits above
          the event modal (z-[70] vs z-50) as a defensive measure, though a fresh game's turn 0
          can't have a scripted/procedural event pending yet in practice. */}
      {!meta.hasSeenOnboarding && <OnboardingOverlay onComplete={completeOnboarding} />}
    </div>
  );
};

// Root App component with provider
const App = () => {
  // Music (map mode only, src/audio/music.js) may start after the first user gesture.
  useEffect(() => {
    const go = () => { startMusic(); unlockSfx(); };
    window.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
    return () => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); };
  }, []);
  // Taps, tabs, toggles and sheets sound from one place (src/audio/uiSounds.js).
  useEffect(() => installUiSounds(), []);
  return (
    <>
    <RotateOverlay />
    <InstallHint />
    {turnDebugOn() && <TurnDebugLog />}
    <GameProvider>
      <EffectsProvider>
        <MapInsetsProvider>
          <GameLayout />
        </MapInsetsProvider>
      </EffectsProvider>
    </GameProvider>
    </>
  );
};

export default App;
