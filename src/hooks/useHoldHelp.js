// src/hooks/useHoldHelp.js
// Hold a finger on a UI element marked data-help="kind:id" (a glossary kind and id, U30) for HOLD_MS
// and the glossary entry opens. A drag past MOVE_PX, a lift or a second finger cancels it, so a pan
// never fires help; the click that follows a hold is swallowed. The battlefield canvas has no
// data-help, so a hold on ground keeps its own context action.
import { useEffect } from 'react';
import { openGlossary } from '../components/ui/uiEvents';
import { glossaryEntry } from '../data/glossary';

export const HOLD_MS = 500;
export const HOLD_MOVE_PX = 10;

/** "unit:bronze_spear" -> ['unit', 'bronze_spear'] when the glossary has it, else null. */
export const helpTarget = (el) => {
  const v = el?.closest?.('[data-help]')?.getAttribute('data-help') || '';
  const [kind, ...rest] = v.split(':');
  const id = rest.join(':');
  return glossaryEntry(kind, id) ? [kind, id] : null;
};

export const useHoldHelp = (doc = typeof document !== 'undefined' ? document : null) => {
  useEffect(() => {
    if (!doc) return undefined;
    let timer = null; let x0 = 0; let y0 = 0; let held = false;
    const stop = () => { clearTimeout(timer); timer = null; };
    const down = (e) => {
      stop();
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      const target = helpTarget(e.target);
      if (!target) return;
      x0 = e.clientX; y0 = e.clientY;
      timer = setTimeout(() => { held = true; openGlossary(...target); }, HOLD_MS);
    };
    const move = (e) => { if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > HOLD_MOVE_PX) stop(); };
    const click = (e) => { if (held) { held = false; e.preventDefault(); e.stopPropagation(); } };
    const menu = (e) => { if (timer || held) e.preventDefault(); }; // no browser menu over the help
    doc.addEventListener('pointerdown', down, true);
    doc.addEventListener('pointermove', move, true);
    doc.addEventListener('pointerup', stop, true);
    doc.addEventListener('pointercancel', stop, true);
    doc.addEventListener('click', click, true);
    doc.addEventListener('contextmenu', menu, true);
    return () => {
      stop();
      ['pointerdown', 'pointermove'].forEach((n) => doc.removeEventListener(n, n === 'pointerdown' ? down : move, true));
      doc.removeEventListener('pointerup', stop, true); doc.removeEventListener('pointercancel', stop, true);
      doc.removeEventListener('click', click, true); doc.removeEventListener('contextmenu', menu, true);
    };
  }, [doc]);
};
