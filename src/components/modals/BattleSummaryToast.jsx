// src/components/modals/BattleSummaryToast.jsx
// Post-turn battle summary (Phase 9) — previously the only feedback after End Turn was the
// scrolling log console, easy to miss during an active war. This surfaces just the newly-added
// combat/crisis log lines as a transient, dismissible toast instead of a blocking modal, so it
// never interrupts play (and can be suppressed wholesale later for a fast-forward mode without
// needing a redesign).

import React from 'react';
import { Swords, X } from 'lucide-react';

const BattleSummaryToast = ({ entries, onDismiss }) => {
  if (!entries || entries.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[90vw] bg-fa-panel border border-orange-500/40 rounded-lg shadow-2xl animate-toast-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-fa-line">
        <div className="flex items-center gap-1.5 text-fa-enemy text-xs font-semibold">
          <Swords className="w-3.5 h-3.5" />
          Battle Report
        </div>
        <button onClick={onDismiss} className="text-fa-muted hover:text-fa-text">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto p-2 space-y-1">
        {entries.map((entry, i) => (
          <div
            key={i}
            className={`text-[11px] px-2 py-1 rounded ${
              entry.type === 'crisis' ? 'bg-red-500/10 text-fa-danger-text' : 'bg-fa-raised/60 text-fa-text'
            }`}
          >
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BattleSummaryToast;
