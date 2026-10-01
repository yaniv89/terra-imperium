// src/components/ui/GameHeader.jsx
// Main game header with title, nation, age/year, resources, and end turn button

import React, { useEffect, useRef, useState } from 'react';
import { useReportInset } from '../../context/MapInsetsContext';
import { Beaker, Globe2, Calendar, RotateCcw, FastForward, Download, Upload, Cloud, CloudOff, CloudCog, WifiOff, AlertTriangle, MoreVertical } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GameStatus } from '../../data/types';
import { AGES } from '../../data/ages';
import ResourceBar from './ResourceBar';
import { getResearchView } from '../panels/researchView';
import { openPanelTab } from '../panels/panelEvents';
import { useLayoutMode } from '../../hooks/useLayoutMode';

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

// Export/Import/Cloud/Reset folded into one "more" button (narrow screens and the phone top bar).
const OverflowMenu = ({ showMenu, setShowMenu, handleExport, handleImportClick, onOpenSettings, onReset, cloudInfo, CloudIcon }) => (
  <>
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
  </>
);

// The research being done, and how long it has left; tap for the Research tab (plan §2).
const ResearchPill = ({ state, compact }) => {
  const view = getResearchView(state);
  const label = view.current ? `${view.current.tech.name} · ${view.current.finishesIn === Infinity ? '?' : view.current.finishesIn}t` : 'Choose research';
  return (
    <button
      onClick={() => openPanelTab('tech')}
      data-testid="research-pill"
      title={view.current ? `Researching ${view.current.tech.name}: ${view.current.finishesIn} turns left at +${view.science} science a turn` : 'Nothing is being researched'}
      className={`shrink-0 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${compact ? 'max-w-[9rem]' : 'max-w-[14rem]'}
                  ${view.current ? 'bg-purple-500/15 border-purple-500/50 text-purple-200' : 'bg-amber-500/15 border-amber-500/50 text-amber-200 animate-pulse'}`}
    >
      <Beaker className="w-3 h-3 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
};

// End Turn and Fast Forward: the same two buttons in every layout.
const TurnButtons = ({ state, isGameOver, advanceTurn, fastForward }) => (
  <>
    <button
      onClick={advanceTurn}
      disabled={state.activeEventId !== null || isGameOver}
      className={`
        px-3 sm:px-4 py-1.5 sm:py-2 pl:px-3 pl:py-1.5 pl:text-xs rounded-lg font-bold text-xs sm:text-sm
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
      {state.pendingDefenses?.length > 0 && (
        <span className="ml-0.5 px-1.5 rounded-full bg-red-500 text-[10px] leading-4" title="Your regions are under attack — fight the assaults first">{state.pendingDefenses.length}</span>
      )}
    </button>

    {/* Fast Forward — resolves turns until an event, a war starting/ending, or the game
        ending, so the quiet stretches of a multi-century game don't need one click each. */}
    <button
      onClick={fastForward}
      disabled={state.activeEventId !== null || isGameOver}
      title="Fast-forward until something happens"
      className={`
        px-2.5 sm:px-3 py-1.5 sm:py-2 pl:px-2 pl:py-1.5 rounded-lg font-bold text-xs sm:text-sm
        bg-slate-700 hover:bg-slate-600
        text-slate-200 shadow-lg transition-all
        active:scale-95 flex items-center gap-1 shrink-0
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      <FastForward className="w-4 h-4" />
    </button>
  </>
);

const GameHeader = ({ onReset, onOpenSettings, cloudStatus }) => {
  const { state, advanceTurn, fastForward, exportSave, importSave } = useGame();
  const layoutMode = useLayoutMode();
  const fileInputRef = useRef(null);
  const headerRef = useRef(null);
  // Export/Import/Cloud/Reset are rarely used mid-turn compared to End Turn, so on narrow
  // screens they collapse into this overflow menu instead of competing for header width with
  // the nation name/date (which were colliding/truncating before this existed).
  const [showMenu, setShowMenu] = useState(false);

  // Now that the header floats over the full-bleed map (plan feedback: "combine the map and the
  // play panel") instead of pushing it down as a flex sibling, the map's own corner controls
  // (MapModeToggle, zoom buttons, RegionInfoModal's corner card) need to know how tall this
  // responsive, two-row header actually is so they can offset below it. Publishing it as a CSS
  // custom property on <html> means those consumers never need a hardcoded guess that drifts out
  // of sync whenever this header's own padding/rows change.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;
    // getBoundingClientRect (border box), not contentRect: contentRect leaves out the header's own
    // padding (incl. the safe-area inset), so everything offset by --header-height overlapped the
    // header's bottom edge — End Turn's lower half sat under the side panels.
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--header-height', `${Math.round(el.getBoundingClientRect().height)}px`);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [layoutMode]); // the phone-landscape bar is a different <header> element: observe the new one
  // The header floats over the map's top edge — reported so the map centres below it (plan §5.1).
  // Keyed by layout so the measurement restarts on the new element when the layout switches.
  useReportInset(`game-header-${layoutMode}`, 'top', headerRef);

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

  const menuProps = { showMenu, setShowMenu, handleExport, handleImportClick, onOpenSettings, onReset, cloudInfo, CloudIcon };
  const importInput = <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} className="hidden" />;

  // A phone held sideways: one slim row (about 44 px) so the map keeps the height. Nation, year,
  // the scrolling resource bar, End Turn and the overflow menu; the age name lives in the tooltip.
  if (layoutMode === 'phone-landscape') {
    return (
      <header
        ref={headerRef}
        className="fixed top-0 inset-x-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-700/50
                   pt-[env(safe-area-inset-top)] pl-[max(env(safe-area-inset-left),0.5rem)] pr-[max(env(safe-area-inset-right),0.5rem)]
                   flex items-center gap-2 h-[calc(2.75rem+env(safe-area-inset-top))]"
      >
        <Globe2 className="w-4 h-4 text-blue-400 shrink-0" />
        <div className="max-w-[7rem] px-1.5 py-0.5 rounded border text-[11px] font-semibold truncate bg-blue-500/20 text-blue-300 border-blue-500/50" title={`${playerNation?.name} · ${ageName}`}>
          {playerNation?.name}
        </div>
        <div className="shrink-0 bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-700" title={ageName}>
          <Calendar className="w-3 h-3 text-slate-400" />
          <span className="font-mono text-xs font-bold text-white">{yearLabel}</span>
        </div>
        <ResearchPill state={state} compact />
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
          <ResourceBar />
        </div>
        <TurnButtons state={state} isGameOver={isGameOver} advanceTurn={advanceTurn} fastForward={fastForward} />
        {importInput}
        <div className="relative shrink-0">
          <OverflowMenu {...menuProps} />
        </div>
      </header>
    );
  }

  return (
    <header
      ref={headerRef}
      className="fixed top-0 inset-x-0 z-20 bg-gradient-to-r from-slate-900/85 via-slate-800/80 to-slate-900/85
                 backdrop-blur-md border-b border-slate-700/50 p-2 sm:p-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]
                 sm:pt-[calc(env(safe-area-inset-top)+0.75rem)] flex flex-col gap-2 sm:gap-3"
    >
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
          <ResearchPill state={state} />
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

          {importInput}

          <div className="relative sm:hidden">
            <OverflowMenu {...menuProps} />
          </div>
        </div>
      </div>

      {/* Bottom Row: Resources and End Turn */}
      <div className="flex justify-between items-center gap-2 sm:gap-4">
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <ResourceBar />
        </div>

        <TurnButtons state={state} isGameOver={isGameOver} advanceTurn={advanceTurn} fastForward={fastForward} />
      </div>
    </header>
  );
};

export default GameHeader;
