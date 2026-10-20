// src/components/ui/ConfirmActionDialog.jsx
// The second tap for a costly one-tap action (mobile audit H-08): a card with the costs and what
// it does, "Cancel" focused first and on Escape, and nothing happens until the confirm button.
// The same shape as GovernmentChangeDialog. A decision card: it goes through the interaction
// registry, so it never opens over another card. One host in App.jsx; any panel calls askConfirm.
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './atlas';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { useT } from '../../i18n/useT';
import { t as tNow } from '../../i18n/core';

let pending = null; // { id, title, rows, notes, confirmLabel, onConfirm }
const listeners = new Set();
const set = (next) => { pending = next; listeners.forEach((fn) => fn()); };
/** Open the card for `spec` (confirmSpecs.js) with `onConfirm`, run only on the confirm button. */
export const askConfirm = (spec, onConfirm) => { if (spec) set({ ...spec, onConfirm }); };
export const closeConfirm = () => set(null);
const usePending = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => pending, () => null);

const TONE = { bad: 'text-fa-danger-text' };

const ConfirmActionDialog = () => {
  useT();
  const spec = usePending();
  const interaction = useInteraction('confirm-action', !!spec, { priority: PRIORITY.event + 5, user: true, label: spec?.title || null });
  const cancelRef = useRef(null);
  const shown = !!spec && interaction.shown;
  useEffect(() => {
    if (!shown) return undefined;
    cancelRef.current?.focus?.();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeConfirm(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [shown]);
  if (!shown || typeof document === 'undefined') return null;
  const confirm = () => { const run = spec.onConfirm; closeConfirm(); run?.(); };
  return createPortal((
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-2" data-testid="confirm-action-dialog">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-title"
        className="fa-panel !bg-fa-panel shadow-2xl w-[min(26rem,calc(100vw-1rem))] max-h-[calc(100dvh-1rem)] flex flex-col">
        <div className="px-4 pt-3 pb-2 pl:px-3 pl:pt-2 border-b border-fa-line">
          <h2 id="confirm-action-title" className="fa-heading text-[19px] pl:text-[16px] leading-tight">{spec.title}</h2>
          <div className="text-[12px] text-fa-muted">{tNow('cf.nothing')}</div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pl:px-3 py-2 space-y-1.5">
          {spec.rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 text-[12.5px]"><span className="text-fa-muted">{r.label}</span><span className={`fa-num text-end ${TONE[r.tone] || ''}`}>{r.value}</span></div>
          ))}
          {spec.notes.map((n) => <div key={n} className="text-[12px] text-fa-muted leading-snug">{n}</div>)}
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pl:px-3 py-2 border-t border-fa-line">
          <Button ref={cancelRef} onClick={closeConfirm} className="!min-h-[44px]" data-testid="confirm-action-cancel">{tNow('cf.cancel')}</Button>
          <Button variant="primary" onClick={confirm} className="!min-h-[44px]" data-testid="confirm-action-ok">{spec.confirmLabel}</Button>
        </div>
      </div>
    </div>
  ), document.body);
};

export default ConfirmActionDialog;
