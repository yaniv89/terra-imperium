// src/components/modals/NationEliminatedBanner.jsx
// Shown the turn the player's own conquests reduce a rival nation to zero regions
// (state.playerEliminatedNationId — see src/engine/elimination.js and resolveTurn.js). Mirrors
// AgeAdvanceBanner's non-blocking, auto-dismissing pattern, in a victory-themed emerald palette to
// read as a distinct, celebratory moment rather than the calendar's own routine age transition.
import React from 'react';
import { Crown } from 'lucide-react';
import { NATION_ELIMINATION_REWARD } from '../../engine/elimination';

const NationEliminatedBanner = ({ nationName, onDismiss }) => {
  if (!nationName) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 border border-emerald-300/60 rounded-full shadow-2xl shadow-emerald-900/40 pl-4 pr-2 py-2">
        <Crown className="w-4 h-4 text-emerald-50 shrink-0" />
        <div className="text-sm font-semibold text-emerald-50 tracking-wide whitespace-nowrap">
          {nationName} conquered — +{NATION_ELIMINATION_REWARD.gold} Gold, +{NATION_ELIMINATION_REWARD.diplomacyPoints} Diplomacy Points
        </div>
        <button
          onClick={onDismiss}
          className="w-5 h-5 flex items-center justify-center rounded-full text-emerald-100/80 hover:text-white hover:bg-black/10 text-xs shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default NationEliminatedBanner;
