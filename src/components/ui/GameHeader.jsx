// src/components/ui/GameHeader.jsx
// Main game header with title, nation, age/year, resources, and end turn button

import React, { useRef, useState } from 'react';
import { Globe2, Calendar, RotateCcw, FastForward, Download, Upload, Cloud, CloudOff, CloudCog, WifiOff, AlertTriangle, MoreVertical } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GameStatus } from '../../data/types';
import { AGES } from '../../data/ages';
import ResourceBar from './ResourceBar';

// plan §M0.5's header cloud status icon: guest/idle (not signed in — nothing to sync), synced,
// syncing, offline (queued, will retry), conflict/error (needs attention, red).
const CLOUD_STATUS = {
  guest: { Icon: CloudOff, className: 'text-slate-500', title: 'Not saved — sign in to save to the cloud' },
  idle: { Icon: CloudOff, className: 'text-slate-500', title: 'Not saved — sign in to save to the cloud' },
  syncing: { Icon: CloudCog, className: 'text-blue-400 animate-pulse', title: 'Syncing...' },
  synced: { Icon: Cloud, className: 'text-green-400', title: 'Saved to the cloud' },
  offline: { Icon: WifiOff, className: 'text-amber-400', title: 'Offline — will sync when back online' },
  conflict: { Icon: AlertTriangle, className: 'text-red-400', title: 'Save conflict — click to resolve' },
  error: { Icon: AlertTriangle, className: 'text-red-400', title: 'Cloud sync error — click to retry' }
};

const GameHeader = ({ onReset, onOpenSettings, cloudStatus }) => {
  const { state, advanceTurn, fastForward, exportSave, importSave } = useGame();
  const fileInputRef = useRef(null);
  // Export/Import/Cloud/Reset are rarely used mid-turn compared to End Turn, so on narrow
  // screens they collapse into this overflow menu instead of competing for header width with
  // the nation name/date (which were colliding/truncating before this existed).
  const [showMenu, setShowMenu] = useState(false);

  const isGameOver = state.gameStatus !== GameStatus.ACTIVE;
  const cloudInfo = CLOUD_STATUS[cloudStatus] || CLOUD_STATUS.guest;
  const CloudIcon = cloudInfo.Icon;
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

          {/* min-w-0 + truncate: on a narrow screen this chip used to overflow and collide with
              the date chip on its right instead of shrinking. */}
          <div className="min-w-0 px-2 py-0.5 rounded border text-xs font-semibold truncate bg-blue-500/20 text-blue-300 border-blue-500/50">
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

          {/* Export/Import/Cloud/Reset: full icon row at sm+ (unchanged), collapsed into a single
              overflow menu below sm — these are rarely touched mid-turn, unlike End Turn, so
              they're the first thing to give up header width on a phone. */}
          <div className="hidden sm:flex items-center gap-2">
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
            <button
              onClick={onOpenSettings}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
              title={cloudInfo.title}
            >
              <CloudIcon className={`w-4 h-4 ${cloudInfo.className}`} />
            </button>
            <button
              onClick={onReset}
              className="p-1.5 sm:p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              title="Reset Game"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />

          <div className="relative sm:hidden">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="p-1.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
              title="More"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-40 py-1">
                  <button
                    onClick={() => { handleExport(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    <Download className="w-4 h-4" /> Export Save
                  </button>
                  <button
                    onClick={() => { handleImportClick(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    <Upload className="w-4 h-4" /> Import Save
                  </button>
                  <button
                    onClick={() => { onOpenSettings(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    <CloudIcon className={`w-4 h-4 ${cloudInfo.className}`} /> {cloudInfo.title}
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); onReset(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-slate-700"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset Game
                  </button>
                </div>
              </>
            )}
          </div>
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
          {/* Always labeled — this is the single most-repeated action in the game and must never
              degrade to an unlabeled color block on a narrow screen. */}
          <span className="whitespace-nowrap">End Turn</span>
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
