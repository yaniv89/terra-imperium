// src/components/ui/NextPrompt.jsx
// The "needs you" chips (W02, plans/UI-DESIGN.md): under the top bar on the left, the first things
// that want a decision this turn, numbered; tapping one jumps there (a city card, an army sheet,
// the settlers' tile, the Research or Peoples tab). Chips stack by kind (promptStack.js, playtest
// audit I157): cities with nothing to build are ONE chip, "3 cities can build", and each tap goes
// to the next one; idle armies and settlers are the "Idle N" chip beside End Turn (IdleChip.jsx).
// At most three chips show; a "+N"
// chip opens the next ones. The guided start's step is always first. Hidden when nothing waits.
// End Turn names the first thing that must be answered (TurnDock.jsx, src/engine/turnBlockers.js).
import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, BookOpen } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { nextPrompts } from './nextPromptModel';
import { goToPrompt, chipLabel } from './promptActions';
import { stackPrompts, nextInStack, stackLabel, stackHint } from './promptStack';
import { useT } from '../../i18n/useT';

const SHOWN = 3;

const NextPrompt = () => {
  const { state } = useGame();
  const { t, lang } = useT();
  // The idle stack is its own chip beside End Turn (IdleChip.jsx), where the card it opens does
  // not cover it.
  // The model reads the current language through t(): recompute when it changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stacks = useMemo(() => stackPrompts(nextPrompts(state)).filter((s) => s.key !== 'idle'), [state, lang]);
  const [offset, setOffset] = useState(0);
  // Where each stack's cycle stands: the id of the prompt its last tap went to.
  const cursor = useRef({});
  if (!stacks.length) return null;
  const start = offset < stacks.length ? offset : 0;
  const shown = stacks.slice(start, start + SHOWN);
  const more = stacks.length - (start + shown.length);
  const single = (p) => (p.kind === 'guide' ? p.label : chipLabel(state, p));
  const go = (stack) => {
    const p = nextInStack(stack, cursor.current[stack.key]);
    if (!p) return;
    cursor.current[stack.key] = p.id;
    goToPrompt(state, p);
  };
  return (
    <div className="flex flex-col items-start gap-1.5 pointer-events-none" data-testid="next-prompt" data-kind={shown[0].items[0].kind}>
      {shown.map((s, i) => {
        const first = s.items[0];
        const label = stackLabel(s, single);
        const hint = stackHint(s, single) || (first.hint ? `${first.label}. ${first.hint}` : first.label);
        return (
          <button key={s.key} type="button" onClick={() => go(s)} title={hint} aria-label={s.count > 1 ? hint : undefined} data-count={s.count}
            className={`relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 pointer-events-auto flex items-center gap-1.5 min-h-[32px] max-w-[min(20rem,44vw,calc(100vw-var(--rail-inset,0px)-var(--safe-start,0px)-5rem))] ps-1.5 pe-2.5 rounded-full bg-fa-panel/95 text-fa-text text-[12px] font-semibold border ${s.kind === 'guide' ? 'border-fa-brass' : 'border-fa-line'} shadow-lg hover:bg-fa-raised`}>
            {s.kind === 'guide'
              ? <BookOpen className="w-4 h-4 shrink-0 text-fa-brass ms-0.5" aria-hidden="true" />
              : <span className="w-5 h-5 rounded-full bg-fa-text text-fa-ink fa-num text-[11px] flex items-center justify-center shrink-0" aria-hidden="true">{start + i + 1}</span>}
            <span className="truncate">{label}</span>
            <ChevronRight className="rtl:-scale-x-100 w-3.5 h-3.5 shrink-0 text-fa-muted" aria-hidden="true" />
          </button>
        );
      })}
      {(more > 0 || start > 0) && (
        <button type="button" onClick={() => setOffset(more > 0 ? start + SHOWN : 0)} aria-label={more >= 1 ? t('chip.showMore', { n: more }) : t('chip.backFirst')}
          className="relative before:content-[''] before:absolute before:-inset-y-1.5 before:inset-x-0 pointer-events-auto min-h-[32px] px-3 rounded-full bg-fa-panel/95 border border-fa-line text-fa-muted text-[12px] font-semibold hover:text-fa-text">
          {more >= 1 ? t('chip.plusN', { n: more }) : t('chip.backFirst')}
        </button>
      )}
    </div>
  );
};

export default NextPrompt;
