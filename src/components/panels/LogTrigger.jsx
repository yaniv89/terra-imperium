// src/components/panels/LogTrigger.jsx
// A small floating button that opens the full log in LogDrawer.jsx (an overlay that takes zero
// layout space while closed), replacing the old always-embedded LogConsole panel. Now that the map
// is the app's full-bleed base layer with no sidebar column left for this to sit at the bottom of
// (plan feedback: "combine the map and the play panel"), it floats over the map instead: bottom-
// left on desktop (clear of PanelDrawer's right-docked panel), top-right under GameHeader on
// mobile (clear of PanelDrawer's bottom tab bar) via the --header-height custom property GameHeader
// publishes.
import React from 'react';
import { ScrollText } from 'lucide-react';

const LogTrigger = ({ onClick, unreadCount = 0 }) => (
  <button
    onClick={onClick}
    className="fixed z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900/90 backdrop-blur-md
               border border-slate-700 shadow-xl text-slate-300 hover:bg-slate-800 transition-colors
               right-3 top-[calc(env(safe-area-inset-top)+var(--header-height,4.5rem)+0.5rem)]
               lg:top-auto lg:right-auto lg:bottom-4 lg:left-4"
    aria-label="Open event log"
  >
    <ScrollText className="w-4 h-4 text-slate-400 shrink-0" />
    <span className="hidden sm:inline text-xs font-semibold">Event Log</span>
    {unreadCount > 0 && (
      <span className="text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )}
  </button>
);

export default LogTrigger;
