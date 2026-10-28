// src/hooks/useScrollHint.js
// A row of chips or tabs that scrolls sideways with its scrollbar hidden: while chips hide past an
// edge the row gets data-more="start" / "end" and index.css fades that edge, so a clipped chip reads
// as "more this way" (newcomer playtest step 14: the Advisor and Ideas chips were cut with no hint).
import { useEffect, useRef } from 'react';

export const scrollHintOf = ({ scrollWidth, clientWidth, scrollLeft }) => {
  const max = scrollWidth - clientWidth;
  const at = Math.abs(scrollLeft); // right to left: scrollLeft runs from 0 down to -max
  return max <= 1 ? '' : [at > 1 ? 'start' : '', at < max - 1 ? 'end' : ''].filter(Boolean).join(' ');
};

export const useScrollHint = () => {
  const ref = useRef(null);
  // Every render: the chips can change, and the row can mount later (a tab of the city sheet).
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => { el.dataset.more = scrollHintOf(el); };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => { ro?.disconnect(); el.removeEventListener('scroll', update); };
  });
  return ref;
};
