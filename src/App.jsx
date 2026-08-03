// src/App.jsx
// Main application component - Rise of Zion game

import React, { useState, useCallback } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { GameHeader } from './components/ui';
import { GameMap } from './components/map';
import { ActionPanel, LogConsole } from './components/panels';
import { EventModal, GameOverModal } from './components/modals';
import { ActionTypes, GameStatus } from './data/types';
import { HISTORICAL_EVENTS } from './data/events';

// Main game layout component
const GameLayout = () => {
  const { state, dispatch, resolveEvent } = useGame();
  const [selectedRegion, setSelectedRegion] = useState(null);

  // Handle game reset. No confirmation needed once the run has already ended (Victory/Defeat) —
  // there's nothing left to lose.
  const handleReset = useCallback(() => {
    const alreadyOver = state.gameStatus !== GameStatus.ACTIVE;
    if (alreadyOver || window.confirm('Reset game? All progress will be lost.')) {
      dispatch({ type: ActionTypes.RESET_GAME });
      setSelectedRegion(null);
    }
  }, [dispatch, state.gameStatus]);

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

      {/* Event Modal - overlays everything when active */}
      <EventModal
        event={state.activeEventId ? HISTORICAL_EVENTS[state.activeEventId] : null}
        onResolve={resolveEvent}
      />

      {/* Game Over screen - overlays everything once the run ends */}
      <GameOverModal
        status={state.gameStatus}
        state={state}
        onReset={handleReset}
      />
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
