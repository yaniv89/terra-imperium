// src/components/ui/WaitingChips.jsx
// The decisions that wait behind the one on screen (playtest audit X16, I153, I154): an attack to
// answer, a peace offer, the pre-battle card of an army that arrived, a tribute demand, a first
// contact. One chip each above the "needs you" chips, the most pressing first; a tap brings that
// card up (the one it replaces becomes a chip in turn). Nothing waits: nothing is drawn.
import React from 'react';
import { ChevronRight, Hourglass } from 'lucide-react';
import { useWaitingChips, interactions } from '../../hooks/useExclusivePanel';

const SHOWN = 2;

const WaitingChips = () => {
  const chips = useWaitingChips();
  if (!chips.length) return null;
  const shown = chips.slice(0, SHOWN);
  const more = chips.length - shown.length;
  return (
    <div className="flex flex-col items-start gap-1.5 pointer-events-none" data-testid="waiting-chips" aria-label="Decisions that wait">
      {shown.map((c) => (
        <button key={c.id} type="button" onClick={() => interactions.promote(c.id)} data-testid={c.testId || `waiting-${c.id}`} title={`${c.label}. Tap to bring it back`}
          className={`pointer-events-auto flex items-center gap-1.5 min-h-[32px] max-w-[min(20rem,44vw)] pl-2 pr-2.5 rounded-full bg-fa-panel/95 text-fa-text text-[12px] font-semibold border shadow-lg hover:bg-fa-raised ${c.tone === 'danger' ? 'border-fa-danger' : 'border-fa-brass'}`}>
          <Hourglass className={`w-3.5 h-3.5 shrink-0 ${c.tone === 'danger' ? 'text-fa-danger-text' : 'text-fa-brass'}`} aria-hidden="true" />
          <span className="truncate">{c.label}</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-fa-muted" aria-hidden="true" />
        </button>
      ))}
      {more > 0 && (
        <button type="button" onClick={() => interactions.promote(chips[SHOWN].id)} aria-label={`${more} more wait: show the next`}
          className="pointer-events-auto min-h-[32px] px-3 rounded-full bg-fa-panel/95 border border-fa-line text-fa-muted text-[12px] font-semibold hover:text-fa-text">
          +{more} more
        </button>
      )}
    </div>
  );
};

export default WaitingChips;
