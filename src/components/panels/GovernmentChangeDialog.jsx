// src/components/panels/GovernmentChangeDialog.jsx
// The confirm step for a change of government (playtest audit I140, conflicts D9): the same
// preview the Government card reads (engine/governmentPreview.js runs the real reducer on a copy),
// shown before anything happens: the cost, stability and authority before and after, whether laws
// lock, the reforms you lose, and the reforms of the new government, which YOU pick (one per age
// tier). Cancel is the first focus and Escape; nothing is applied until "Change government".
// A decision card: it goes through the interaction registry, so it never opens over another card.
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes } from '../../data/types';
import { getNationCapital } from '../../data/regions';
import { previewGovernmentChange } from '../../engine/governmentPreview';
import { AUTHORITY_NO_LAWS } from '../../engine/authority';
import { Button } from '../ui/atlas';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { t as tNow, ageName, isolateLtr } from '../../i18n';
import { useT } from '../../i18n/useT';
import { getActiveReforms } from '../../data/government';
import { governmentName, reformName, reformDescription } from '../../i18n/gameText';
import { costLine } from './empireText';

const costText = costLine;

// The type waiting for its confirm card. Kept here, not in the Empire tab: on a phone the card takes the
// screen and tucks the tab away (it unmounts), which would take the card with it. The card is drawn by
// <GovernmentChangeDialog /> inside NationOverviewSheet, which stays mounted.
let pendingType = null;
const listeners = new Set();
export const openGovernmentChange = (typeId) => { pendingType = typeId; listeners.forEach((fn) => fn()); };
const usePendingType = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => pendingType, () => null);
const Row = ({ label, children, tone = '' }) => (
  <div className="flex items-baseline justify-between gap-3 text-[12.5px]"><span className="text-fa-muted">{label}</span><span className={`fa-num text-end ${tone}`}>{children}</span></div>
);

const GovernmentChangeDialog = () => {
  useT(); // redraw when the language changes
  const typeId = usePendingType();
  const onClose = () => openGovernmentChange(null);
  const { state, dispatch } = useGame();
  const { triggerEffect } = useEffects();
  const [picks, setPicks] = useState({}); // { [ageId]: reformId }; a tier left out takes its first choice
  const base = useMemo(() => (typeId ? previewGovernmentChange(state, typeId, picks) : null), [state, typeId, picks]);
  const open = !!typeId && !!base?.ok;
  const turn = useInteraction('government-change', open, { priority: PRIORITY.event + 5, user: true, label: base?.typeName ? tNow('wait.changeGov', { type: governmentName(typeId, base.typeName) }) : null });
  const cancelRef = useRef(null);
  const shown = open && turn.shown;
  useEffect(() => { setPicks({}); }, [typeId]);
  useEffect(() => {
    if (!shown) return undefined;
    cancelRef.current?.focus?.();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); openGovernmentChange(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [shown]);
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
          <h2 id="gov-change-title" className="fa-heading text-[19px] pl:text-[16px] leading-tight">{tNow('p1.gcd.title', { name: governmentName(typeId, p.typeName) })}</h2>
          <div className="text-[12px] text-fa-muted">{tNow('p1.gcd.nothing')}</div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pl:px-3 py-2 space-y-1.5">
          <Row label={tNow('p1.gcd.cost')} tone={p.affordable ? '' : 'text-fa-danger-text'}>{costText(p.cost)}{p.affordable ? '' : tNow('p1.gcd.cannotAfford')}</Row>
          <Row label={tNow('p1.auth.stability')} tone={p.stabilityChange < 0 ? 'text-fa-danger-text' : ''}>{tNow('p1.gcd.fromTo', { from: isolateLtr(p.before.stability), to: isolateLtr(p.after.stability) })}</Row>
          <Row label={tNow('p1.dom.authority')} tone={p.authorityChange < 0 ? 'text-fa-danger-text' : ''}>{tNow('p1.gcd.fromTo', { from: p.before.authority, to: p.after.authority })}</Row>
          {p.locksLaws && <div className="text-[12px] text-fa-danger-text rounded border border-fa-danger px-2 py-1" data-testid="gov-change-locks">{tNow('p1.gcd.locks', { n: AUTHORITY_NO_LAWS })}</div>}
          {!p.locksLaws && !p.after.canEnactLaws && <div className="text-[12px] text-amber-300" data-testid="gov-change-locked-already">{tNow('p1.gcd.stays', { n: AUTHORITY_NO_LAWS })}</div>}
          {p.reformsLost.length > 0 && <Row label={tNow('p1.gcd.youLose')}>{getActiveReforms(state.nations[state.playerNationId]).map((r) => reformName(r.id, r.name)).join(', ')}</Row>}
          {p.reformSlots.length > 0 && (
            <div className="pt-1 space-y-1.5" data-testid="gov-change-reforms">
              <div className="fa-label">{tNow('p1.gcd.chooseReforms')}</div>
              {p.reformSlots.map((slot) => (
                <div key={slot.ageId} role="radiogroup" aria-label={tNow('p1.gcd.slotReform', { age: ageName(slot.ageId, slot.ageName) })} className="space-y-1">
                  <div className="text-[11px] text-fa-muted">{ageName(slot.ageId, slot.ageName)}</div>
                  {slot.options.map((o) => {
                    const on = o.id === slot.chosen;
                    return (
                      <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setPicks((cur) => ({ ...cur, [slot.ageId]: o.id }))} data-testid={`gov-reform-${o.id}`}
                        className={`w-full min-h-[44px] text-start fa-option px-2.5 py-1 ${on ? 'fa-selected' : ''}`}>
                        <div className="text-[13px] font-semibold leading-tight">{reformName(o.id, o.name)}</div>
                        <div className="text-[11.5px] text-fa-muted leading-snug">{reformDescription(o.id, o.description)}</div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pl:px-3 py-2 border-t border-fa-line">
          <Button ref={cancelRef} onClick={onClose} className="!min-h-[44px]" data-testid="gov-change-cancel">{tNow('p1.gcd.cancel')}</Button>
          <Button variant="primary" onClick={confirm} disabled={!p.affordable} className="!min-h-[44px]" data-testid="gov-change-ok">{tNow('p1.gcd.ok')}</Button>
        </div>
      </div>
    </div>
  ), document.body);
};

export default GovernmentChangeDialog;
