// src/components/ui/WhyTip.jsx
// A blocked control says why on tap (phones have no hover). `useWhy()` gives [why, bubble]:
// spread `why(blocked, reason, onClick)` on a button and render `bubble` beside it. With a reason
// the button stays tappable (aria-disabled, never the native `disabled`, which swallows the tap)
// and a tap shows the reason in a small bubble for a few seconds; without one it is a plain
// disabled button.
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { computePosition } from './Tooltip';

const SHOW_MS = 3500;

const Bubble = ({ rect, text }) => {
  const ref = useRef(null);
  const [at, setAt] = useState(null);
  useLayoutEffect(() => { if (ref.current) setAt(computePosition(rect, ref.current.getBoundingClientRect(), 'top')); }, [rect, text]);
  return createPortal(
    <div ref={ref} role="status" data-testid="why-tip"
      className="fixed z-[999] max-w-[min(20rem,90vw)] px-2.5 py-1.5 text-xs text-fa-text bg-fa-raised border border-fa-line rounded shadow-lg pointer-events-none whitespace-normal break-words"
      style={at ? { top: at.top, left: at.left } : { top: -9999, left: -9999, visibility: 'hidden' }}>
      {text}
    </div>,
    document.body
  );
};

export const useWhy = () => {
  const [tip, setTip] = useState(null);
  useEffect(() => {
    if (!tip) return undefined;
    const id = setTimeout(() => setTip(null), SHOW_MS);
    return () => clearTimeout(id);
  }, [tip]);
  const why = (blocked, reason, onClick) => (blocked && reason
    ? { 'aria-disabled': true, title: reason, onClick: (e) => { e.stopPropagation(); e.currentTarget.scrollIntoView?.({ block: 'nearest' }); setTip({ rect: e.currentTarget.getBoundingClientRect(), text: reason }); } }
    : { disabled: !!blocked, onClick });
  return [why, tip ? <Bubble rect={tip.rect} text={tip.text} /> : null];
};
