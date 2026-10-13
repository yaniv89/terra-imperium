// src/hooks/useAutoDismiss.js
// A banner that hides itself: `clear()` runs `ms` after `value` became something, and the clock
// depends on nothing else. The era banner's timer used to live in an effect that also watched the
// turn number (and the eliminated-nation banner's watched every nation), so ending a turn within
// the five seconds cancelled the timer for good and the banner sat over the top bar until tapped
// (playtest audit X19, I161).
import { useEffect, useRef } from 'react';

export const useAutoDismiss = (value, clear, ms) => {
  const clearRef = useRef(clear);
  clearRef.current = clear;
  useEffect(() => {
    if (value == null || value === false || value === '') return undefined;
    const timer = setTimeout(() => clearRef.current(), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
};
