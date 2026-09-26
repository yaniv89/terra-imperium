// src/App.jsx
// Main application component - Terra Imperium

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameProvider, useGame, hasExistingSave } from './context/GameContext';
import { EffectsProvider, useEffects } from './context/EffectsContext';
import { GameHeader, StartScreen } from './components/ui';
import { MapContainer } from './components/map';
import { ActionPanel, ActionPanelTabs, LogTrigger, LogDrawer } from './components/panels';
import { EventModal, GameOverModal, BattleSummaryToast, AccountModal, ConflictChooserModal, OnboardingOverlay, AgeAdvanceBanner, NationEliminatedBanner } from './components/modals';
import AdminPage from './components/admin/AdminPage';
import { GameStatus, LogTypes, ActionTypes } from './data/types';
import { HISTORICAL_EVENTS } from './data/events';
import { EVENT_CHAINS } from './data/eventChains';
import { AGES } from './data/ages';
import { getNationCapital } from './data/regions';
import { useCloudSync } from './hooks/useCloudSync';
import { getSupabaseClient, isCloudSaveConfigured } from './services/supabaseClient';
import { getCurrentUser, onAuthStateChange, getProfile } from './services/auth';

const AGE_ADVANCE_BANNER_MS = 5000;

// Main game layout component
const GameLayout = () => {
  const { state, dispatch, resolveEvent, resetGame, meta, completeOnboarding } = useGame();
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
  const [showStartScreen, setShowStartScreen] = useState(() => !hasExistingSave());

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
    const timer = setTimeout(() => setAgeBanner(null), AGE_ADVANCE_BANNER_MS);
    return () => clearTimeout(timer);
  }, [state.age, state.turnNumber, state.playerNationId, triggerEffect]);

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
    const timer = setTimeout(() => setEliminatedNationName(null), AGE_ADVANCE_BANNER_MS);
    return () => clearTimeout(timer);
  }, [state.playerEliminatedNationId, state.nations]);

  // Post-turn battle summary (Phase 9) — surfaces newly-added combat/crisis log lines as a
  // dismissible toast. prevLogCountRef starts at the CURRENT length so loading a save with an
  // existing history never spuriously toasts on mount; only logs added after that count.
  const prevLogCountRef = useRef(state.logs.length);
  const [battleSummary, setBattleSummary] = useState(null);
  useEffect(() => {
    const newLogs = state.logs.slice(prevLogCountRef.current);
    prevLogCountRef.current = state.logs.length;
    const combatLogs = newLogs.filter(l => l.type === LogTypes.COMBAT || l.type === LogTypes.CRISIS);
    if (combatLogs.length > 0) setBattleSummary(combatLogs);
  }, [state.logs]);

  // Handle game reset. No confirmation needed once the run has already ended (Victory/Defeat) —
  // there's nothing left to lose. Routes back through the start screen so the player can pick a
  // new nation/speed/difficulty rather than silently restarting as whatever they last played.
  const handleReset = useCallback(() => {
    const alreadyOver = state.gameStatus !== GameStatus.ACTIVE;
    if (alreadyOver || window.confirm('Reset game? All progress will be lost.')) {
      setShowStartScreen(true);
      setSelectedRegion(null);
      setBattleSummary(null);
    }
  }, [state.gameStatus]);

  const handleStart = useCallback((options) => {
    resetGame(options);
    setShowStartScreen(false);
  }, [resetGame]);

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

  if (showStartScreen) {
    return <StartScreen onStart={handleStart} />;
  }

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col overflow-y-scroll">
      {/* Header with resources and controls */}
      <GameHeader onReset={handleReset} onOpenSettings={() => setShowAccount(true)} cloudStatus={client ? cloudSync.status : null} />

      {/* Main content area. Below `lg` (phones/narrow tablets), this is no longer one long
          scrolling page: the globe and tab bar stay put (both `shrink-0`) and only the middle
          zone (action panel content + event log) scrolls, so switching tabs or reading the log
          never requires scrolling back up past the globe. At `lg`+, nothing here changed from
          before — same side-by-side globe + fixed-width panel column, tabs above content. */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 min-h-0 overflow-hidden lg:overflow-y-scroll">
        {/* Left/Top: Map — a globe/flat-2D-map toggle (MapContainer), plus a corner minimap that
            opens the flat map full-screen. Fixed, modest height on mobile (shrink-0) instead of
            flex-1, so it can't eat space the action panel/tab bar need; still flex-[2] of the row
            on desktop. */}
        <div className="relative shrink-0 h-[32vh] min-h-[200px] lg:h-auto lg:shrink lg:flex-[2] lg:min-h-0 order-1">
          <MapContainer
            selectedRegion={selectedRegion}
            onSelectRegion={handleSelectRegion}
          />
        </div>

        {/* Right/Bottom: Action Panel tabs, content, and Log Console. */}
        <div className="flex flex-col flex-1 min-h-0 lg:w-96 xl:w-[420px] lg:flex-none order-2">
          {/* Tabs: order-2 (after content) on mobile so they land pinned at the bottom of this
              column once the content zone below claims all the remaining space; order-1 (their
              natural position, above content) on desktop, unchanged from before. */}
          <div className="order-2 lg:order-1 shrink-0">
            <ActionPanelTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* Middle zone: action panel content, with a slim log trigger pinned below it (the
              log's actual content only exists in the LogDrawer overlay below, opened on demand —
              see this file's own header comment on LogTrigger/LogDrawer for why). */}
          <div className="order-1 lg:order-2 flex-1 min-h-0 flex flex-col gap-2">
            <ActionPanel activeTab={activeTab} selectedRegion={selectedRegion} />
            <div className="shrink-0 px-2 lg:px-0">
              <LogTrigger onClick={handleOpenLogDrawer} unreadCount={Math.max(0, state.logs.length - lastSeenLogCountRef.current)} />
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal - overlays everything when active. A procedural event (Phase 6) is carried
          in full on the state itself rather than looked up by id from HISTORICAL_EVENTS. A chain
          event (Phase 10) is looked up by id too, but from EVENT_CHAINS. */}
      <EventModal
        event={state.activeEventId
          ? (HISTORICAL_EVENTS[state.activeEventId] || EVENT_CHAINS[state.activeEventId])
          : state.activeProceduralEvent}
        onResolve={resolveEvent}
      />

      {/* Game Over screen - overlays everything once the run ends */}
      <GameOverModal
        status={state.gameStatus}
        state={state}
        onReset={handleReset}
        onContinue={handleContinueAfterVictory}
      />

      {/* Post-turn battle summary (Phase 9) - non-blocking, dismissible toast */}
      <BattleSummaryToast entries={battleSummary} onDismiss={() => setBattleSummary(null)} />

      {/* Age Advance banner - non-blocking, auto-dismisses (plan §10.5's "showpiece") */}
      <AgeAdvanceBanner ageName={ageBanner} onDismiss={() => setAgeBanner(null)} />

      {/* Nation Eliminated banner - non-blocking, auto-dismisses */}
      <NationEliminatedBanner nationName={eliminatedNationName} onDismiss={() => setEliminatedNationName(null)} />

      {/* Event Log drawer - the log's actual content, opened on demand from LogTrigger above */}
      <LogDrawer open={logDrawerOpen} onClose={() => setLogDrawerOpen(false)} />

      {/* Cloud saves + account (plan §M0.5) - opened from GameHeader's Cloud button */}
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
      <ConflictChooserModal conflict={cloudSync.conflict} onChoose={cloudSync.resolveConflict} />

      {/* Onboarding (Phase H) - once ever, per browser, for a genuinely new player. Sits above
          the event modal (z-[70] vs z-50) as a defensive measure, though a fresh game's turn 0
          can't have a scripted/procedural event pending yet in practice. */}
      {!meta.hasSeenOnboarding && <OnboardingOverlay onComplete={completeOnboarding} />}
    </div>
  );
};

// Root App component with provider
const App = () => {
  return (
    <GameProvider>
      <EffectsProvider>
        <GameLayout />
      </EffectsProvider>
    </GameProvider>
  );
};

export default App;
