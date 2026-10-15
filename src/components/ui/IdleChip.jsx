// src/components/ui/IdleChip.jsx
// "Idle N" (playtest audit I157, the user's request): ONE chip for every army that can still move
// and every settler without a destination; each tap selects the next one and flies the map to it,
// in a stable order (promptStack.js over nextPromptModel.js). It sits beside End Turn, not with
// the "needs you" chips under the top bar: the army or tile card it opens covers that corner, and
// a chip under the card could not be tapped again to go on to the next unit.
import React, { useMemo, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GameStatus } from '../../data/types';
import { nextPrompts } from './nextPromptModel';
import { goToPrompt, chipLabel } from './promptActions';
import { stackPrompts, nextInStack, stackLabel, stackHint } from './promptStack';
import { useT } from '../../i18n/useT';

const IdleChip = ({ className = '' }) => {
  const { state } = useGame();
  const { t, lang } = useT();
  // The model reads the current language through t(): recompute when it changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stack = useMemo(() => (state.gameStatus === GameStatus.ACTIVE ? stackPrompts(nextPrompts(state)).find((s) => s.key === 'idle') || null : null), [state, lang]);
  const last = useRef(null);
  if (!stack) return null;
  const single = (p) => chipLabel(state, p);
  const go = () => {
    const p = nextInStack(stack, last.current);
    if (!p) return;
    last.current = p.id;
    goToPrompt(state, p);
  };
  const hint = stackHint(stack, single) || t('chip.tapToGo', { label: stack.items[0].label });
  return (
    <button type="button" onClick={go} title={hint} aria-label={hint} data-testid="idle-chip" data-count={stack.count}
      className={`fa-btn fa-btn-secondary !bg-fa-panel shadow-xl gap-1.5 !px-3 !min-h-[50px] pl:!min-h-[44px] whitespace-nowrap shrink-0 ${className}`}>
      <span>{stackLabel(stack, single)}</span>
      <ChevronRight className="rtl:-scale-x-100 w-4 h-4 shrink-0 text-fa-muted" aria-hidden="true" />
    </button>
  );
};

export default IdleChip;
