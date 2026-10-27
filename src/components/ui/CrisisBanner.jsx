// src/components/ui/CrisisBanner.jsx
// The history crisis (differentiation plan U32): for a few turns after one starts, a notice under the
// top bar tells its story and who it hit. Before one strikes the player (crises.js crisisComing,
// follow-up 25) the same notice warns: what is coming, in how many turns, and what softens it. A
// notice (useInteraction), so on a phone it waits as a chip while a decision card has the screen.
// The crisis's own decision card comes from the event deck: during the warning its Decide now button
// opens it early (ANSWER_CRISIS_EARLY); unanswered, it opens when the crisis strikes.
import React, { useState } from 'react';
import { Flame, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { useT } from '../../i18n/useT';
import { CRISES } from '../../data/crises';
import { crisisComing } from '../../engine/crises';
import { ActionTypes } from '../../data/types';

export const BANNER_TURNS = 5;

/** The crisis still on the banner at this turn, as { crisis, turn, nations }, or null. */
export const activeCrisis = (state) => {
  const h = state.crises?.history?.at(-1);
  if (!h || (state.turnNumber || 0) - h.turn > BANNER_TURNS) return null;
  const crisis = CRISES.find((c) => c.id === h.id);
  return crisis && { crisis, turn: h.turn, nations: h.nations };
};

const CrisisBanner = () => {
  const { state, dispatch } = useGame();
  const { t, dt } = useT();
  const [gone, setGone] = useState(null); // the notice the player dismissed
  const coming = crisisComing(state);
  const a = coming || activeCrisis(state);
  const key = a ? `${coming ? 'coming' : 'hit'}:${a.turn}` : null;
  const open = !!a && gone !== key;
  const base = a ? `evt.crisis_${a.crisis.id}` : '';
  const title = a ? dt(`${base}.title`, a.crisis.card.title) : '';
  const { shown } = useInteraction('crisis-banner', open, { priority: PRIORITY.notice, kind: 'notice', label: t('crisis.wait', { title }), testId: 'crisis-banner-chip' });
  if (!open || !shown) return null;
  const you = a.nations.includes(state.playerNationId);
  return (
    <div role="status" className="pointer-events-auto fa-panel !bg-fa-panel shadow-xl p-2 w-[min(19rem,calc(100vw-1.5rem-var(--rail-inset,0px)))] text-[12px] space-y-1" data-testid="crisis-banner" data-coming={coming ? 'true' : undefined}>
      <div className="flex items-start gap-1.5">
        <Flame className="w-4 h-4 mt-0.5 shrink-0 text-fa-danger-text" aria-hidden="true" />
        <div className="min-w-0 flex-1 font-semibold leading-tight">{title}</div>
        <button type="button" onClick={() => setGone(key)} aria-label={t('crisis.dismiss')} className="w-8 h-8 -mt-1 -me-1 shrink-0 flex items-center justify-center rounded hover:bg-fa-raised"><X size={14} aria-hidden="true" /></button>
      </div>
      {coming ? (
        <>
          <div className="leading-snug">{t('crisis.coming', { count: Math.max(1, coming.turn - (state.turnNumber || 0)), n: coming.nations.length })}</div>
          <div className="text-fa-muted leading-snug">{t(`crisis.soften.${a.crisis.effect}`)}</div>
          {!coming.answered && <button type="button" onClick={() => dispatch({ type: ActionTypes.ANSWER_CRISIS_EARLY })} className="fa-btn fa-btn-primary !min-h-[44px] !px-3 text-[12px]" data-testid="crisis-answer-now">{t('crisis.answerNow')}</button>}
        </>
      ) : (
        <>
          <div className="text-fa-muted leading-snug">{dt(`${base}.desc`, a.crisis.card.desc)}</div>
          <div className="text-fa-muted leading-snug">{t(you ? 'crisis.hitYou' : 'crisis.hitOthers', { n: a.nations.length })}</div>
        </>
      )}
    </div>
  );
};

export default CrisisBanner;
