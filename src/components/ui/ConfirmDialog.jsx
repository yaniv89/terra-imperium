// src/components/ui/ConfirmDialog.jsx
// An in-game "are you sure" (playtest audit I166: New Game used the browser's own confirm box,
// which a phone shows as a system alert with the page's address). A small card in the middle: a
// title, what happens, Cancel (the default: Escape and the first focus) and the action. A tap on
// the dimmed map does not answer it.
import React, { useEffect, useRef } from 'react';
import { Button } from './atlas';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';

const ConfirmDialog = ({ open, title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel, testId = 'confirm-dialog' }) => {
  const cancelRef = useRef(null);
  const turn = useInteraction(testId, open, { priority: PRIORITY.event + 5, user: true, label: title });
  const shown = turn.shown;
  useEffect(() => {
    if (!shown) return undefined;
    cancelRef.current?.focus?.();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel?.(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [shown, onCancel]);
  if (!open || !shown) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-3" data-testid={testId}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={`${testId}-title`} aria-describedby={`${testId}-text`}
        className="fa-panel !bg-fa-panel shadow-2xl w-[min(26rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 pl:p-3">
        <h2 id={`${testId}-title`} className="fa-heading text-[19px] pl:text-[17px] leading-tight">{title}</h2>
        <div id={`${testId}-text`} className="text-[13px] leading-snug text-fa-text mt-2 space-y-1.5">{children}</div>
        <div className="grid grid-cols-2 gap-2 mt-4 pl:mt-3">
          <Button ref={cancelRef} onClick={onCancel} className="!min-h-[44px]" data-testid={`${testId}-cancel`}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} className="!min-h-[44px]" data-testid={`${testId}-ok`}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
