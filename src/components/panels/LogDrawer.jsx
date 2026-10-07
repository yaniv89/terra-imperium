// src/components/panels/LogDrawer.jsx
// The event log's actual content (LogConsole), shown as a dismissible overlay opened from
// LogTrigger.jsx rather than an always-embedded panel. Bottom sheet on mobile (consistent with
// RegionInfoModal's own mobile treatment), a right-docked panel at `lg`+ where there's width to
// spare without covering the map/action panel, and on a phone held sideways (`pl:`), where a
// bottom sheet would cover most of a 390 px tall screen.
import React from 'react';
import { X } from 'lucide-react';
import LogConsole from './LogConsole';

const LogDrawer = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex lg:justify-end pl:justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full lg:w-96 h-[70vh] lg:h-full mt-auto lg:mt-0 rounded-t-2xl lg:rounded-none
                   pl:w-[min(400px,56vw)] pl:h-full pl:mt-0 pl:rounded-none pl:border-t-0 pl:border-l
                   flex flex-col bg-fa-ink border-t lg:border-t-0 lg:border-l border-fa-line shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-fa-line shrink-0 lg:hidden">
          <span className="text-xs font-semibold text-fa-muted">Event Log</span>
          <button onClick={onClose} className="p-1 hover:bg-fa-raised rounded text-fa-muted hover:text-fa-text" aria-label="Close log">
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="hidden lg:flex items-center justify-center absolute -left-9 top-2 p-1.5 bg-fa-ink border border-fa-line rounded-lg
                     text-fa-muted hover:text-fa-text hover:bg-fa-raised"
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
