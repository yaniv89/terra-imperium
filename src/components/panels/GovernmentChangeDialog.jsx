// src/components/panels/GovernmentChangeDialog.jsx
// The confirm step for a change of government (playtest audit I140, conflicts D9): the same
// preview the Government card reads (engine/governmentPreview.js runs the real reducer on a copy),
// shown before anything happens: the cost, stability and authority before and after, whether laws
// lock, the reforms you lose, and the reforms of the new government, which YOU pick (one per age
// tier). Cancel is the first focus and Escape; nothing is applied until "Change government".
// A decision card: it goes through the interaction registry, so it never opens over another card.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { getNationCapital } from '../../data/regions';
import { previewGovernmentChange } from '../../engine/governmentPreview';
import { AUTHORITY_NO_LAWS } from '../../engine/authority';
import { Button } from '../ui/atlas';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';

const costText = (cost) => Object.entries(cost || {}).map(([k, v]) => `${v} ${k.toUpperCase()}`).join(', ');
const Row = ({ label, children, tone = '' }) => (
  <div className="flex items-baseline justify-between gap-3 text-[12.5px]"><span className="text-fa-muted">{label}</span><span className={`fa-num text-right ${tone}`}>{children}</span></div>
);

const GovernmentChangeDialog = ({ typeId, onClose }) => {
  const { state, dispatch } = useGame();
  const { triggerEffect } = useEffects();
  const [picks, setPicks] = useState({}); // { [ageId]: reformId }; a tier left out takes its first choice
  const base = useMemo(() => (typeId ? previewGovernmentChange(state, typeId, picks) : null), [state, typeId, picks]);
  const open = !!typeId && !!base?.ok;
  const turn = useInteraction('government-change', open, { priority: PRIORITY.event + 5, user: true, label: base?.typeName ? `Change to ${base.typeName}` : null });
  const cancelRef = useRef(null);
  const shown = open && turn.shown;
  useEffect(() => { setPicks({}); }, [typeId]);
  useEffect(() => {
    if (!shown) return undefined;
    cancelRef.current?.focus?.();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose?.(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [shown, onClose]);
  if (!shown || typeof document === 'undefined') return null;

  const p = base;
  const confirm = () => {
    if (!p.affordable) return;
    triggerEffect('change_government_type', { region: getNationCapital(state.playerNationId) });
    const chosen = Object.fromEntries(p.reformSlots.map((s) => [s.ageId, s.chosen]));
    dispatch({ type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId, reforms: chosen } });
    onClose?.();
  };

  return createPortal((
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-2" data-testid="government-change-dialog">
      <div role="alertdialog" aria-modal="true" aria-labelledby="gov-change-title"
        className="fa-panel !bg-fa-panel shadow-2xl w-[min(30rem,calc(100vw-1rem))] max-h-[calc(100dvh-1rem)] flex flex-col">
        <div className="px-4 pt-3 pb-2 pl:px-3 pl:pt-2 border-b border-fa-line">
          <h2 id="gov-change-title" className="fa-heading text-[19px] pl:text-[16px] leading-tight">Become a {p.typeName}?</h2>
          <div className="text-[12px] text-fa-muted">Nothing changes until you confirm.</div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pl:px-3 py-2 space-y-1.5">
          <Row label="Cost" tone={p.affordable ? '' : 'text-fa-danger-text'}>{costText(p.cost)}{p.affordable ? '' : ' (you cannot afford it yet)'}</Row>
          <Row label="Stability" tone={p.stabilityChange < 0 ? 'text-fa-danger-text' : ''}>{p.before.stability} to {p.after.stability}</Row>
          <Row label="Authority" tone={p.authorityChange < 0 ? 'text-fa-danger-text' : ''}>{p.before.authority} to {p.after.authority}</Row>
          {p.locksLaws && <div className="text-[12px] text-fa-danger-text rounded border border-fa-danger px-2 py-1" data-testid="gov-change-locks">Authority falls under {AUTHORITY_NO_LAWS}: you cannot enact any law until it recovers.</div>}
          {!p.locksLaws && !p.after.canEnactLaws && <div className="text-[12px] text-amber-300" data-testid="gov-change-locked-already">Authority stays under {AUTHORITY_NO_LAWS}: laws stay locked.</div>}
          {p.reformsLost.length > 0 && <Row label="You lose">{p.reformsLost.join(', ')}</Row>}
          {p.reformSlots.length > 0 && (
            <div className="pt-1 space-y-1.5" data-testid="gov-change-reforms">
              <div className="fa-label">Choose its reforms</div>
              {p.reformSlots.map((slot) => (
                <div key={slot.ageId} role="radiogroup" aria-label={`${slot.ageName} reform`} className="space-y-1">
                  <div className="text-[11px] text-fa-muted">{slot.ageName}</div>
                  {slot.options.map((o) => {
                    const on = o.id === slot.chosen;
                    return (
                      <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setPicks((cur) => ({ ...cur, [slot.ageId]: o.id }))} data-testid={`gov-reform-${o.id}`}
                        className={`w-full min-h-[44px] text-left fa-option px-2.5 py-1 ${on ? 'fa-selected' : ''}`}>
                        <div className="text-[13px] font-semibold leading-tight">{o.name}</div>
                        <div className="text-[11.5px] text-fa-muted leading-snug">{o.description}</div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pl:px-3 py-2 border-t border-fa-line">
          <Button ref={cancelRef} onClick={onClose} className="!min-h-[44px]" data-testid="gov-change-cancel">Cancel</Button>
          <Button variant="primary" onClick={confirm} disabled={!p.affordable} className="!min-h-[44px]" data-testid="gov-change-ok">Change government</Button>
        </div>
      </div>
    </div>
  ), document.body);
};

export default GovernmentChangeDialog;
