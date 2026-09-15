// src/App.jsx
// Main application component - Rise of Zion game

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { GameHeader } from './components/ui';
import { GameMap } from './components/map';
import { ActionPanel, LogConsole } from './components/panels';
import { EventModal, GameOverModal, BattleSummaryToast } from './components/modals';
import { GameStatus, LogTypes } from './data/types';
import { HISTORICAL_EVENTS } from './data/events';

// Main game layout component
const GameLayout = () => {
  const { state, resolveEvent, resetGame } = useGame();
  const [selectedRegion, setSelectedRegion] = useState(null);

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
        <div className="flex-1 lg:flex-[2] min-h-[250px] lg:min-h-0 order-1">
          <GameMap 
            selectedRegion={selectedRegion} 
            onSelectRegion={handleSelectRegion} 
          />
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
          in full on the state itself rather than looked up by id from HISTORICAL_EVENTS. */}
      <EventModal
        event={state.activeEventId ? HISTORICAL_EVENTS[state.activeEventId] : state.activeProceduralEvent}
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
