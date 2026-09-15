// src/components/ui/GameHeader.jsx
// Main game header with title, year, resources, and end turn button

import React, { useRef } from 'react';
import { Star, Calendar, RotateCcw, FastForward, Flag, Download, Upload } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GamePhases, GameStatus } from '../../data/types';
import { getAvgCoreControl } from '../../utils/helpers';
import ResourceBar from './ResourceBar';

const GameHeader = ({ onReset }) => {
  const { state, advanceTurn, fastForward, exportSave, importSave } = useGame();
  const fileInputRef = useRef(null);

  const isPreState = state.phase === GamePhases.PRE_STATE;
  const avgControl = getAvgCoreControl(state);
  const canDeclareIndependence = isPreState && avgControl >= 60;
  const isGameOver = state.gameStatus !== GameStatus.ACTIVE;

  const handleExport = () => {
    const json = exportSave();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rise-of-zion-${state.year}-${state.period === 0 ? 'H1' : 'H2'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importSave(String(reader.result));
      if (!ok) window.alert('Could not load that save file — it may be corrupted or from an incompatible version.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Phase styling
  const phaseConfig = {
    [GamePhases.PRE_STATE]: {
      label: 'The Yishuv',
      className: 'bg-amber-500/20 text-amber-300 border-amber-500/50'
    },
    [GamePhases.POST_STATE]: {
      label: 'State of Israel',
      className: 'bg-blue-500/20 text-blue-300 border-blue-500/50'
    }
  };

  const currentPhase = phaseConfig[state.phase] || phaseConfig[GamePhases.PRE_STATE];

  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 p-2 sm:p-3 flex flex-col gap-2 sm:gap-3 shrink-0">
      {/* Top Row: Title, Phase, Year, Reset */}
      <div className="flex justify-between items-center gap-2">
        {/* Left: Title and Phase */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Logo/Title */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Star className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-white whitespace-nowrap">
              <span className="hidden sm:inline">Rise of Zion</span>
              <span className="sm:hidden">RoZ</span>
            </h1>
          </div>

          {/* Phase Badge */}
          <div className={`px-2 py-0.5 rounded border text-xs font-semibold whitespace-nowrap ${currentPhase.className}`}>
            <span className="hidden sm:inline">{currentPhase.label}</span>
            <span className="sm:hidden">{isPreState ? 'Yishuv' : 'Israel'}</span>
          </div>

          {/* Independence indicator */}
          {canDeclareIndependence && (
            <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs font-semibold animate-pulse">
              <Flag className="w-3 h-3" />
              <span>Ready!</span>
            </div>
          )}
        </div>

        {/* Right: Year and Reset */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Year Display */}
          <div className="bg-slate-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1.5 sm:gap-2 border border-slate-700">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-sm sm:text-lg font-bold text-white">
                {state.year}
              </span>
              <span className="font-mono text-xs sm:text-sm font-medium text-slate-400">
                {state.period === 0 ? 'H1' : 'H2'}
              </span>
            </div>
          </div>

          {/* Save / Load */}
          <button
            onClick={handleExport}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
            title="Export Save"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleImportClick}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
            title="Import Save"
          >
            <Upload className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />

          {/* Reset Button */}
          <button
            onClick={onReset}
            className="p-1.5 sm:p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            title="Reset Game"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Row: Resources and End Turn */}
      <div className="flex justify-between items-center gap-2 sm:gap-4">
        {/* Resources */}
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <ResourceBar />
        </div>

        {/* End Turn Button */}
        <button
          onClick={advanceTurn}
          disabled={state.activeEventId !== null || isGameOver}
          className={`
            px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm
            bg-gradient-to-r from-blue-600 to-blue-500
            hover:from-blue-500 hover:to-blue-400
            text-white shadow-lg transition-all
            active:scale-95 flex items-center gap-1.5 sm:gap-2 shrink-0
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <span className="hidden sm:inline">End Turn</span>
        </button>

        {/* Fast Forward (Phase 10) — resolves turns until an event, a war starting/ending, or
            the game ending, so the quiet stretches of a 560-turn game don't need one click each. */}
        <button
          onClick={fastForward}
          disabled={state.activeEventId !== null || isGameOver}
          title="Fast-forward until something happens"
          className={`
            px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm
            bg-slate-700 hover:bg-slate-600
            text-slate-200 shadow-lg transition-all
            active:scale-95 flex items-center gap-1 shrink-0
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <FastForward className="w-4 h-4" />
        </button>
      </div>

      {/* Control Progress (Pre-state only) */}
      {isPreState && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Core Control:</span>
          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden max-w-[200px]">
            <div
              className={`h-full transition-all duration-500 ${avgControl >= 60 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${avgControl}%` }}
            />
          </div>
          <span className={`font-mono font-bold ${avgControl >= 60 ? 'text-green-400' : 'text-blue-400'}`}>
            {avgControl}%
          </span>
          <span className="text-slate-500">/ 60% for independence</span>
        </div>
      )}
    </header>
  );
};

export default GameHeader;