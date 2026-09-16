// src/components/ui/GameHeader.jsx
// Main game header with title, nation, age/year, resources, and end turn button

import React, { useRef } from 'react';
import { Globe2, Calendar, RotateCcw, FastForward, Download, Upload } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GameStatus } from '../../data/types';
import { AGES } from '../../data/ages';
import ResourceBar from './ResourceBar';

const GameHeader = ({ onReset }) => {
  const { state, advanceTurn, fastForward, exportSave, importSave } = useGame();
  const fileInputRef = useRef(null);

  const isGameOver = state.gameStatus !== GameStatus.ACTIVE;
  const playerNation = state.nations[state.playerNationId];
  const ageName = AGES[state.age]?.name || state.age;
  const yearLabel = state.year < 0 ? `${-state.year} BCE` : `${state.year} CE`;

  const handleExport = () => {
    const json = exportSave();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terra-imperium-${state.playerNationId}-${state.year}.json`;
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

  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 p-2 sm:p-3 flex flex-col gap-2 sm:gap-3 shrink-0">
      {/* Top Row: Title, Nation/Age, Year, Reset */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Globe2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-white whitespace-nowrap">
              <span className="hidden sm:inline">Terra Imperium</span>
              <span className="sm:hidden">TI</span>
            </h1>
          </div>

          <div className="px-2 py-0.5 rounded border text-xs font-semibold whitespace-nowrap bg-blue-500/20 text-blue-300 border-blue-500/50">
            {playerNation?.name}
          </div>

          <div className="hidden md:block px-2 py-0.5 rounded border text-xs font-semibold whitespace-nowrap bg-slate-700/50 text-slate-300 border-slate-600">
            {ageName}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-slate-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1.5 sm:gap-2 border border-slate-700">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
            <span className="font-mono text-sm sm:text-lg font-bold text-white">{yearLabel}</span>
          </div>

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
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <ResourceBar />
        </div>

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

        {/* Fast Forward — resolves turns until an event, a war starting/ending, or the game
            ending, so the quiet stretches of a multi-century game don't need one click each. */}
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
    </header>
  );
};

export default GameHeader;
