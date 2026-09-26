// src/components/panels/LogDrawer.jsx
// The event log's actual content (LogConsole), shown as a dismissible overlay opened from
// LogTrigger.jsx rather than an always-embedded panel. Bottom sheet on mobile (consistent with
// RegionInfoModal's own mobile treatment), a right-docked panel at `lg`+ where there's width to
// spare without covering the map/action panel.
import React from 'react';
import { X } from 'lucide-react';
import LogConsole from './LogConsole';

const LogDrawer = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex lg:justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full lg:w-96 h-[70vh] lg:h-full mt-auto lg:mt-0 rounded-t-2xl lg:rounded-none
                   flex flex-col bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 shrink-0 lg:hidden">
          <span className="text-xs font-semibold text-slate-400">Event Log</span>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white" aria-label="Close log">
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="hidden lg:flex items-center justify-center absolute -left-9 top-2 p-1.5 bg-slate-950 border border-slate-800 rounded-lg
                     text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="Close log"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex-1 min-h-0">
          <LogConsole />
        </div>
      </div>
    </div>
  );
};

export default LogDrawer;
