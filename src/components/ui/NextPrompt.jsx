// src/components/ui/NextPrompt.jsx
// The "needs you" chips (W02, plans/UI-DESIGN.md): under the top bar on the left, the first things
// that want a decision this turn, numbered; tapping one jumps there (a city card, an army sheet,
// the settlers' tile, the Research or Peoples tab). At most three show; a "+N" chip opens the next
// ones. The guided start's step is always first. Hidden when nothing waits. End Turn names the
// first thing that must be answered (TurnDock.jsx, src/engine/turnBlockers.js).
import React, { useMemo, useState } from 'react';
import { ChevronRight, BookOpen } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { nextPrompts } from './nextPromptModel';
import { goToPrompt, chipLabel } from './promptActions';

const SHOWN = 3;

const NextPrompt = () => {
  const { state } = useGame();
  const prompts = useMemo(() => nextPrompts(state), [state]);
  const [offset, setOffset] = useState(0);
  if (!prompts.length) return null;
  const start = offset < prompts.length ? offset : 0;
  const shown = prompts.slice(start, start + SHOWN);
  const more = prompts.length - (start + shown.length);
  return (
    <div className="flex flex-col items-start gap-1.5 pointer-events-none" data-testid="next-prompt" data-kind={shown[0].kind}>
      {shown.map((p, i) => (
        <button key={p.id} type="button" onClick={() => goToPrompt(state, p)} title={p.hint ? `${p.label}. ${p.hint}` : p.label}
          className={`pointer-events-auto flex items-center gap-1.5 min-h-[32px] max-w-[min(20rem,44vw)] pl-1.5 pr-2.5 rounded-full bg-fa-panel/95 text-fa-text text-[12px] font-semibold border ${p.kind === 'guide' ? 'border-fa-brass' : 'border-fa-line'} shadow-lg hover:bg-fa-raised`}>
          {p.kind === 'guide'
            ? <BookOpen className="w-4 h-4 shrink-0 text-fa-brass ml-0.5" aria-hidden="true" />
            : <span className="w-5 h-5 rounded-full bg-fa-text text-fa-ink fa-num text-[11px] flex items-center justify-center shrink-0" aria-hidden="true">{start + i + 1}</span>}
          <span className="truncate">{p.kind === 'guide' ? p.label : chipLabel(state, p)}</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-fa-muted" aria-hidden="true" />
        </button>
      ))}
      {(more > 0 || start > 0) && (
        <button type="button" onClick={() => setOffset(more > 0 ? start + SHOWN : 0)} aria-label={more > 0 ? `Show ${more} more` : 'Back to the first'}
          className="pointer-events-auto min-h-[32px] px-3 rounded-full bg-fa-panel/95 border border-fa-line text-fa-muted text-[12px] font-semibold hover:text-fa-text">
          {more > 0 ? `+${more} more` : 'Back to the first'}
        </button>
      )}
    </div>
  );
};

export default NextPrompt;
