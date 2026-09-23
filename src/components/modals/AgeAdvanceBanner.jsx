// src/components/modals/AgeAdvanceBanner.jsx
// The calendar age (src/data/ages.js's AGE_ORDER) used to advance completely silently — no log
// line, no animation, nothing — so a player had no way to notice the world had moved into a new
// age at all (plan §10.5's "Age Advance — the showpiece" was never built). App.jsx's GameLayout
// diffs state.age turn-over-turn and shows this non-blocking banner (plus triggers the
// 'age_advance' globe pulse, src/data/effectRegistry.js) the turn it changes; resolveTurn.js
// itself only adds the matching log line, since it's pure and has no access to EffectsContext.
import React from 'react';
import { Sparkles } from 'lucide-react';

const AgeAdvanceBanner = ({ ageName, onDismiss }) => {
  if (!ageName) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-3 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 border border-amber-300/60 rounded-full shadow-2xl shadow-amber-900/40 pl-4 pr-2 py-2">
        <Sparkles className="w-4 h-4 text-amber-50 shrink-0" />
        <div className="text-sm font-semibold text-amber-50 tracking-wide whitespace-nowrap">
          A new era dawns — {ageName}
        </div>
        <button
          onClick={onDismiss}
          className="w-5 h-5 flex items-center justify-center rounded-full text-amber-100/80 hover:text-white hover:bg-black/10 text-xs shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default AgeAdvanceBanner;
