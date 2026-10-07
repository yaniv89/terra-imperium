// src/components/ui/TurnDock.jsx
// End Turn, bottom right in one thumb reach (plans/UI-DESIGN.md rule 2, W10), a Civilization-style
// call to action (endTurnModel.js over src/engine/turnBlockers.js):
//   Blocker         something must be answered first: the button names it ("Choose production:
//                   Kish", "Choose research", "Answer: Gutium demands tribute", "Defend Uruk:
//                   Command or Auto") with a "+N" badge for the rest; a tap opens exactly that
//   Ready           "End Turn", a tap ends the turn. Units that can still move never block; with
//                   the "warn me" setting on, the first tap shows them and reads "End anyway? N
//                   waiting", the second ends the turn (it disarms by itself)
//   The world moves while the turn worker runs, a progress strip instead of the button
// Enter presses the button (the first blocker, or the end of the turn) when nothing is being typed.
// Sits left of the tab rail (--rail-inset) and above the bottom bar of a phone held upright.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Hammer, FlaskConical, Scroll, Shield, Feather, Bell, Swords, HeartHandshake, Coins } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { softHints, WARN_ARM_MS } from './nextPromptModel';
import { endTurnButton, endTurnPress } from './endTurnModel';
import { goToPrompt, goToBlocker, chipLabel } from './promptActions';

const KIND_ICON = { city: Hammer, research: FlaskConical, demand: Scroll, tribute: Coins, join: HeartHandshake, peace: Feather, defense: Shield, event: Bell, battle: Swords };

const TurnDock = () => {
  const { state, advanceTurn, turnPending } = useGame();
  const isMobile = useIsMobile();
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), WARN_ARM_MS); return () => clearTimeout(t); }, [armed]);
  const btn = endTurnButton(state, { turnPending, armed });
  const hints = useMemo(() => (armed ? softHints(state) : []), [armed, state]);
  // A blocker that turns up disarms the soft confirmation.
  useEffect(() => { if (btn.mode === 'blocker' && armed) setArmed(false); }, [btn.mode, armed]);

  const press = () => {
    const r = endTurnPress(state, { turnPending, armed });
    if (r.go) { goToBlocker(state, r.go); return; }
    if (r.arm) { setArmed(true); return; }
    if (r.end) { setArmed(false); advanceTurn(); }
  };
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target?.tagName || '') || e.target?.isContentEditable) return;
      e.preventDefault();
      pressRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (btn.mode === 'hidden') return null;
  const blocking = btn.mode === 'blocker';
  const Icon = blocking ? KIND_ICON[btn.blocker.kind] || Bell : null;

  return (
    <div data-testid="turn-dock"
      className={`fixed z-20 flex flex-col items-end gap-2 pointer-events-none
        ${isMobile ? 'right-3 bottom-[calc(var(--panel-bar-height,4rem)+0.75rem)]' : 'right-[calc(var(--rail-inset,0px)+0.75rem)] bottom-[max(env(safe-area-inset-bottom),0.75rem)]'}`}>
      {armed && hints.length > 0 && (
        <div className="pointer-events-auto fa-panel p-2 w-[min(17rem,60vw)] shadow-2xl" role="status" data-testid="end-turn-warnings">
          <div className="fa-label mb-1.5">{hints.length} still waiting</div>
          <div className="flex flex-wrap gap-1.5">
            {hints.slice(0, 4).map((p) => (
              <button key={p.id} type="button" onClick={() => { setArmed(false); goToPrompt(state, p); }} className="fa-chip max-w-full truncate">{chipLabel(state, p)}</button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-stretch gap-2 pointer-events-auto">
        {btn.mode === 'moving' ? (
          <div className="fa-panel h-[50px] pl:h-11 min-w-[11rem] px-4 flex flex-col justify-center shadow-xl" role="status" aria-live="polite" data-testid="world-moves">
            <span className="text-[13px] font-semibold">The world moves…</span>
            <span className="fa-bar mt-1.5 relative" style={{ height: 4 }}><span className="absolute inset-y-0 w-1/3 bg-fa-text animate-[worldMoves_1.1s_ease-in-out_infinite]" /></span>
          </div>
        ) : (
          <button
            type="button"
            onClick={press}
            data-testid="end-turn"
            data-mode={btn.mode}
            data-blocker={blocking ? btn.blocker.kind : undefined}
            data-armed={armed ? '1' : '0'}
            data-turn-pending="0"
            aria-label={blocking ? `${btn.label}${btn.count > 1 ? `, ${btn.count - 1} more before the turn can end` : ', then the turn can end'}` : btn.label}
            title={blocking ? `${btn.label}${btn.count > 1 ? ` (${btn.count - 1} more)` : ''}` : undefined}
            className={`fa-btn fa-btn-primary fa-btn-hero !min-h-[50px] pl:!min-h-[44px] shadow-xl gap-2 min-w-0
              ${blocking ? '!px-3.5 !text-[15px] pl:!text-[14px] max-w-[min(22rem,52vw)] pl:max-w-[min(17rem,40vw)]' : '!px-5'}`}
          >
            {Icon && <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />}
            <span className="truncate min-w-0">{btn.label}</span>
            {btn.badge && (
              <span className="fa-num shrink-0 text-[11px] font-semibold bg-fa-ink text-fa-brass rounded-full px-2 py-0.5" aria-hidden="true" data-testid="end-turn-badge">{btn.badge}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default TurnDock;
