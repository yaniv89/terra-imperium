// src/hooks/useIsMobile.js
// Tracks whether the viewport is below the `lg` breakpoint (1024px) — the same breakpoint
// App.jsx's GameLayout already uses to switch from the side-by-side desktop layout to a stacked
// mobile one. CSS alone (Tailwind's `lg:` classes) handles most of that switch, but a few things
// need to change their DEFAULT STATE rather than just their size/visibility (e.g. the event log
// starting collapsed on a phone) — this hook is for exactly those cases.
import { useState, useEffect } from 'react';

const QUERY = '(max-width: 1023px)';

export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
};
