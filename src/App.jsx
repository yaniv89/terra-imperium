// src/App.jsx
// Main application component - Rise of Zion game

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Map as MapIcon, Globe as GlobeIcon } from 'lucide-react';
import { GameProvider, useGame } from './context/GameContext';
import { GameHeader } from './components/ui';
import { GameMap } from './components/map';
import { GlobeContainer, GlobeCountryInfo } from './components/globe';
import { ActionPanel, LogConsole } from './components/panels';
import { EventModal, GameOverModal, BattleSummaryToast } from './components/modals';
import { GameStatus, LogTypes } from './data/types';
import { HISTORICAL_EVENTS } from './data/events';
import { EVENT_CHAINS } from './data/eventChains';

// Main game layout component
const GameLayout = () => {
  const { state, resolveEvent, resetGame } = useGame();
  const [selectedRegion, setSelectedRegion] = useState(null);
  // Globe View (Phase 12) — a separate, read-only preview of the whole-earth renderer alongside
  // the flat map that's still the actual gameplay surface. selectedCountryId is intentionally
  // its own piece of state, not reused from selectedRegion: the two ids come from unrelated
  // datasets (real-world ISO codes vs. the hand-authored 28 regions) until Phase 13 unifies them.
  const [mapView, setMapView] = useState('flat');
  const [selectedCountryId, setSelectedCountryId] = useState(null);

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
  // there's nothing left to lose. Goes through resetGame() (not a raw dispatch) so the player's
  // selected starting doctrine — meta-progression, Phase 6 — is carried into the new game.
  const handleReset = useCallback(() => {
    const alreadyOver = state.gameStatus !== GameStatus.ACTIVE;
    if (alreadyOver || window.confirm('Reset game? All progress will be lost.')) {
      resetGame();
      setSelectedRegion(null);
      setBattleSummary(null);
    }
  }, [resetGame, state.gameStatus]);

  // Handle region selection
  const handleSelectRegion = useCallback((regionId) => {
    setSelectedRegion(regionId);
  }, []);

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col overflow-y-scroll">
      {/* Header with resources and controls */}
      <GameHeader onReset={handleReset} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 overflow-y-scroll min-h-0">
        {/* Left/Top: Map */}
        <div className="relative flex-1 lg:flex-[2] min-h-[250px] lg:min-h-0 order-1">
          {mapView === 'flat' ? (
            <GameMap
              selectedRegion={selectedRegion}
              onSelectRegion={handleSelectRegion}
            />
          ) : (
            <>
              <GlobeContainer
                selectedCountryId={selectedCountryId}
                onSelectCountry={setSelectedCountryId}
              />
              <GlobeCountryInfo
                countryId={selectedCountryId}
                onClose={() => setSelectedCountryId(null)}
              />
            </>
          )}

          {/* Flat map / globe toggle (Phase 12) — Globe View is a preview of the eventual
              whole-earth renderer; the flat map remains the actual gameplay surface until
              Phase 13 rebuilds regions on top of the real world data. */}
          <div className="absolute bottom-2 left-2 z-10 flex rounded-lg overflow-hidden border border-slate-700 shadow-lg">
            <button
              onClick={() => setMapView('flat')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                mapView === 'flat' ? 'bg-blue-600 text-white' : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              Map
            </button>
            <button
              onClick={() => setMapView('globe')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                mapView === 'globe' ? 'bg-blue-600 text-white' : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <GlobeIcon className="w-3.5 h-3.5" />
              Globe (Preview)
            </button>
          </div>
        </div>

        {/* Right/Bottom: Action Panel and Log Console */}
        <div className="flex flex-col gap-2 lg:w-96 xl:w-[420px] order-2 min-h-[300px] lg:min-h-0 lg:h-full">
          {/* Action Panel with tabs */}
          <div className="flex-1 min-h-[200px] lg:min-h-0">
            <ActionPanel selectedRegion={selectedRegion} />
          </div>

          {/* Log Console */}
          <div className="h-48 lg:h-56 shrink-0">
            <LogConsole maxHeight="h-full" />
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
      />

      {/* Post-turn battle summary (Phase 9) - non-blocking, dismissible toast */}
      <BattleSummaryToast entries={battleSummary} onDismiss={() => setBattleSummary(null)} />
    </div>
  );
};

// Root App component with provider
const App = () => {
  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
};

export default App;
