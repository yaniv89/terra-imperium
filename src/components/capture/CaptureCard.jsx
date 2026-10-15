// src/components/capture/CaptureCard.jsx
// The capture card (decision 40, UI15; playtest audits I128, I129). After a won city battle,
// Command or Auto, and after a siege surrender, the player decides the city's fate once: Conquer,
// Raze, Make tributary or Free (src/engine/capture.js). Four choice tiles with their icons, what
// the chosen one does (or why it is not on offer: a choice that does not apply stays visible, greyed,
// and a tap on it shows the reason), and one brass button. It is a decision card: no backdrop
// closes it; "Look at the map first" sets it aside as a chip (useExclusivePanel.js) and End Turn
// waits for it (turnBlockers.js 'capture'). It shows after the battle's result screen: a commanded
// battle commits on Continue, and the card is the next thing on screen. The record lives in the
// save, so a reload brings the card back. Phone landscape first (844x390 and 844x340).
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Crown, Flame, Coins, Bird, MapPin } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { useInteraction, interactions, PRIORITY } from '../../hooks/useExclusivePanel';
import { focusRegion } from '../map/marchEvents';
import { Button, IconButton } from '../ui/atlas';
import GameIcon from '../ui/GameIcon';
import { captureCardModel } from './captureCardModel';
import { SHOW_CAPTURE } from './captureEvents';
import { t as tNow } from '../../i18n';

// The old glyphs, used only when the delivered icon is missing.
const FALLBACK = { conquer: Crown, raze: Flame, tributary: Coins, free: Bird };
const goLabel = (id, name) => (id === 'conquer' ? `Keep ${name}` : id === 'raze' ? `Raze ${name}` : id === 'tributary' ? 'Make it a tributary' : `Free ${name}`);

const CaptureCard = () => {
  const { state, dispatch } = useGame();
  const m = useMemo(() => (state.pendingBattle ? null : captureCardModel(state)), [state]);
  const [pick, setPick] = useState('conquer');
  useEffect(() => { setPick('conquer'); }, [m?.id]);
  useEffect(() => {
    const onShow = () => interactions.promote('capture');
    window.addEventListener(SHOW_CAPTURE, onShow);
    return () => window.removeEventListener(SHOW_CAPTURE, onShow);
  }, []);
  const turn = useInteraction('capture', !!m, { priority: PRIORITY.capture, label: m ? tNow('wait.capture', { name: m.name }) : null, testId: 'capture-chip', tone: 'danger' });
  if (!m || !turn.shown) return null;
  const chosen = m.choices.find((c) => c.id === pick) || m.choices[0];
  const go = () => {
    if (chosen.disabled) return;
    dispatch({ type: ActionTypes.RESOLVE_CAPTURE, payload: { captureId: m.id, choice: chosen.id } });
  };

  const card = (
    <div className="fixed inset-0 z-[70] bg-black/55 flex items-end sm:items-center justify-center pe-[var(--rail-w,0px)]" data-testid="capture-card-backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby="capture-title" data-testid="capture-card"
        className="fa-panel !bg-fa-panel shadow-2xl w-full sm:w-[min(40rem,calc(100vw-1rem-var(--rail-w,0px)))] max-h-[94dvh] sm:max-h-[calc(100dvh-1rem)] flex flex-col rounded-b-none sm:rounded-[10px]">
        <div className="relative flex items-center gap-2 px-3 pt-2 pb-1.5 pl:py-1 border-b border-fa-line overflow-hidden">
          <GameIcon group="ui" id="capture-header" size={0} className="!absolute inset-0 !w-full !h-full object-cover opacity-25 pointer-events-none" halo={false} />
          <div className="relative min-w-0 flex-1">
            <h2 id="capture-title" className="fa-heading text-[19px] pl:text-[16px] leading-tight truncate" data-testid="capture-title">{m.title}</h2>
            <div className="text-[12px] text-fa-muted leading-snug truncate">{m.how}{m.facts.length ? ` ${m.facts.join(' · ')}.` : ''} T{m.turn}</div>
          </div>
          <IconButton label={`Show ${m.name} on the map`} icon={MapPin} onClick={() => { turn.tuck(); focusRegion(m.cityId); }} className="relative shrink-0 !w-9 !h-9" data-testid="capture-show" />
          <IconButton label="Look at the map first: the choice waits as a chip" icon={ChevronDown} onClick={turn.tuck} className="relative shrink-0 !w-9 !h-9" data-testid="capture-later" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 pl:py-1.5 space-y-2 pl:space-y-1.5">
          <div role="radiogroup" aria-label="What becomes of the city" className="grid grid-cols-4 gap-2 pl:gap-1.5">
            {m.choices.map((c) => {
              const Glyph = FALLBACK[c.id];
              const on = c.id === chosen.id;
              return (
                <button key={c.id} type="button" role="radio" aria-checked={on} aria-disabled={c.disabled} onClick={() => setPick(c.id)} data-testid={`capture-choice-${c.id}`}
                  className={`fa-option flex flex-col items-center justify-center gap-1 px-1 py-1.5 min-h-[76px] pl:min-h-[62px] text-center ${on ? 'fa-selected' : ''} ${c.disabled ? 'opacity-55' : ''}`}>
                  <GameIcon group="ui" id={c.icon} size={36} disabled={c.disabled} className="pl:!w-7 pl:!h-7" fallback={<Glyph className={`w-7 h-7 ${c.disabled ? 'text-fa-muted' : ''}`} aria-hidden="true" />} />
                  <span className="text-[12.5px] pl:text-[12px] font-semibold leading-tight">{c.label}</span>
                </button>
              );
            })}
          </div>
          <div className="fa-card px-2.5 py-1.5" role="status" data-testid="capture-explain">
            <div className="fa-label">{chosen.label}</div>
            <div className="text-[12.5px] pl:text-[12px] leading-snug mt-0.5">{chosen.effect}</div>
            {chosen.disabled && <div className="text-[12px] text-fa-brass leading-snug mt-0.5" data-testid="capture-reason">Not on offer: {chosen.reason}</div>}
          </div>
          {m.waiting > 0 && <div className="text-[11px] text-fa-muted">{m.waiting} more cit{m.waiting === 1 ? 'y waits' : 'ies wait'} for your decision after this one.</div>}
        </div>

        <div className="px-2.5 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] border-t border-fa-line flex items-center gap-2">
          <div className="flex-1 min-w-0 text-[11px] text-fa-muted leading-snug">The turn waits for this choice. It cannot be undone.</div>
          <Button variant="primary" hero disabled={chosen.disabled} onClick={go} data-testid="capture-go" className="!min-h-[48px] !px-5 shrink-0">
            {goLabel(chosen.id, m.name)}
          </Button>
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? card : createPortal(card, document.body);
};

export default CaptureCard;
