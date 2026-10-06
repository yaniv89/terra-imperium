// src/components/ui/TurnDock.jsx
// End Turn, bottom right in one thumb reach (plans/UI-DESIGN.md rule 2, W10's three states):
//   1 Ready         the brass End Turn with a count of what still waits ("2 left")
//   2 Warnings armed (the "warn me" setting) the first tap shows what waits as chips that jump
//                   there, the button turns into "Tap again to end anyway"; it disarms by itself
//   3 The world moves  while the turn worker runs, a progress strip instead of the button
// End Turn is never blocked by a prompt. Fast forward sits beside it. Enter ends the turn through
// the same gate when nothing is being typed. Sits left of the tab rail (--rail-inset) and above
// the bottom bar of a phone held upright (--panel-bar-height).
import React, { useEffect, useMemo, useState } from 'react';
import { FastForward } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GameStatus } from '../../data/types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { nextPrompts, endTurnWarnings, WARN_ARM_MS } from './nextPromptModel';
import { goToPrompt, chipLabel } from './promptActions';

const TurnDock = () => {
  const { state, advanceTurn, fastForward, turnPending } = useGame();
  const isMobile = useIsMobile();
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), WARN_ARM_MS); return () => clearTimeout(t); }, [armed]);
  const waiting = useMemo(() => nextPrompts(state).filter((p) => p.kind !== 'guide'), [state]);
  const warnings = endTurnWarnings(state);
  const isGameOver = state.gameStatus !== GameStatus.ACTIVE;
  const blocked = state.activeEventId !== null || isGameOver || turnPending;
  const endTurn = () => { if (blocked) return; if (warnings > 0 && !armed) { setArmed(true); return; } setArmed(false); advanceTurn(); };
  useEffect(() => {
    const onKey = (e) => { if (e.key !== 'Enter' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return; if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target?.tagName || '')) return; if (blocked) return; e.preventDefault(); endTurn(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (isGameOver) return null;
  const defenses = state.pendingDefenses?.length || 0;

  return (
    <div data-testid="turn-dock"
      className={`fixed z-20 flex flex-col items-end gap-2 pointer-events-none
        ${isMobile ? 'right-3 bottom-[calc(var(--panel-bar-height,4rem)+0.75rem)]' : 'right-[calc(var(--rail-inset,0px)+0.75rem)] bottom-[max(env(safe-area-inset-bottom),0.75rem)]'}`}>
      {armed && waiting.length > 0 && (
        <div className="pointer-events-auto fa-panel p-2 w-[min(17rem,60vw)] shadow-2xl" role="status" data-testid="end-turn-warnings">
          <div className="fa-label mb-1.5">{waiting.length} still waiting</div>
          <div className="flex flex-wrap gap-1.5">
            {waiting.slice(0, 4).map((p) => (
              <button key={p.id} type="button" onClick={() => { setArmed(false); goToPrompt(state, p); }} className="fa-chip max-w-full truncate">{chipLabel(state, p)}</button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-stretch gap-2 pointer-events-auto">
        <button type="button" onClick={fastForward} disabled={blocked} aria-label="Fast forward until something happens" title="Fast forward until something happens"
          className="fa-icon-btn !w-12 !h-[50px] shadow-xl disabled:opacity-45">
          <FastForward className="w-5 h-5" aria-hidden="true" />
        </button>
        {turnPending ? (
          <div className="fa-panel h-[50px] min-w-[11rem] px-4 flex flex-col justify-center shadow-xl" role="status" aria-live="polite">
            <span className="text-[13px] font-semibold">The world moves…</span>
            <span className="fa-bar mt-1.5 relative" style={{ height: 4 }}><span className="absolute inset-y-0 w-1/3 bg-fa-text animate-[worldMoves_1.1s_ease-in-out_infinite]" /></span>
          </div>
        ) : (
          <button
            type="button"
            onClick={endTurn}
            data-armed={armed ? '1' : '0'}
            data-turn-pending="0"
            disabled={state.activeEventId !== null}
            className="fa-btn fa-btn-primary fa-btn-hero !min-h-[50px] !px-5 shadow-xl gap-2.5"
          >
            <span className="whitespace-nowrap">{armed ? 'Tap again to end anyway' : 'End Turn'}</span>
            {!armed && waiting.length > 0 && (
              <span className="fa-num text-[11px] font-semibold bg-fa-ink text-fa-brass rounded-full px-2 py-0.5" aria-label={`${waiting.length} left`}>{waiting.length} left</span>
            )}
            {defenses > 0 && (
              <span className="fa-num text-[11px] bg-fa-danger text-fa-ink rounded-full px-2 py-0.5" title="Your cities are under attack: fight the assaults first">{defenses}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default TurnDock;
