// src/components/panels/LogTrigger.jsx
// A slim, single-row replacement for the old always-embedded LogConsole panel (which claimed a
// fixed h-48/h-56 chunk of the action-panel column even "collapsed"). This is the only piece that
// lives inline now; clicking it opens the full log in LogDrawer.jsx, an overlay that takes zero
// layout space while closed.
import React from 'react';
import { ScrollText, ChevronUp } from 'lucide-react';

const LogTrigger = ({ onClick, unreadCount = 0 }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800
               hover:bg-slate-900 transition-colors shrink-0"
  >
    <span className="flex items-center gap-2 min-w-0">
      <ScrollText className="w-4 h-4 text-slate-500 shrink-0" />
      <span className="text-xs font-semibold text-slate-400">Event Log</span>
      {unreadCount > 0 && (
        <span className="text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </span>
    <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
  </button>
);

export default LogTrigger;
