// src/components/ui/CrisisBanner.jsx
// The running history crisis (differentiation plan U32): for a few turns after one starts, a notice
// under the top bar tells its story and who it hit. A notice (useInteraction), so on a phone it
// waits as a chip while a decision card has the screen. The crisis's own decision card comes from
// the event deck; this only follows the crisis.
import React, { useState } from 'react';
import { Flame, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { useT } from '../../i18n/useT';
import { CRISES } from '../../data/crises';

export const BANNER_TURNS = 5;

/** The crisis still on the banner at this turn, as { crisis, turn, nations }, or null. */
export const activeCrisis = (state) => {
  const h = state.crises?.history?.at(-1);
  if (!h || (state.turnNumber || 0) - h.turn > BANNER_TURNS) return null;
  const crisis = CRISES.find((c) => c.id === h.id);
  return crisis && { crisis, turn: h.turn, nations: h.nations };
};

const CrisisBanner = () => {
  const { state } = useGame();
  const { t, dt } = useT();
  const [gone, setGone] = useState(null); // the turn of the crisis the player dismissed
  const a = activeCrisis(state);
  const open = !!a && gone !== a.turn;
  const base = a ? `evt.crisis_${a.crisis.id}` : '';
  const title = a ? dt(`${base}.title`, a.crisis.card.title) : '';
  const { shown } = useInteraction('crisis-banner', open, { priority: PRIORITY.notice, kind: 'notice', label: t('crisis.wait', { title }), testId: 'crisis-banner-chip' });
  if (!open || !shown) return null;
  const you = a.nations.includes(state.playerNationId);
  return (
    <div role="status" className="pointer-events-auto fa-panel !bg-fa-panel shadow-xl p-2 w-[min(19rem,calc(100vw-1.5rem-var(--rail-inset,0px)))] text-[12px] space-y-1" data-testid="crisis-banner">
      <div className="flex items-start gap-1.5">
        <Flame className="w-4 h-4 mt-0.5 shrink-0 text-fa-danger-text" aria-hidden="true" />
        <div className="min-w-0 flex-1 font-semibold leading-tight">{title}</div>
        <button type="button" onClick={() => setGone(a.turn)} aria-label={t('crisis.dismiss')} className="w-8 h-8 -mt-1 -me-1 shrink-0 flex items-center justify-center rounded hover:bg-fa-raised"><X size={14} aria-hidden="true" /></button>
      </div>
      <div className="text-fa-muted leading-snug">{dt(`${base}.desc`, a.crisis.card.desc)}</div>
      <div className="text-fa-muted leading-snug">{t(you ? 'crisis.hitYou' : 'crisis.hitOthers', { n: a.nations.length })}</div>
    </div>
  );
};

export default CrisisBanner;
