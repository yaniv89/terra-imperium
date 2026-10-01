// src/hooks/useExclusivePanel.js
// Side panels take turns when the screen can't fit two of them and still show the map: the tab
// panel (right, PanelDrawer) and the province panel (left, ProvinceModal) together covered 65 to
// 90% of a laptop or a landscape phone. Opening one tucks the other away; closing it brings the
// tucked one back. Wide screens keep both.
import { useEffect, useRef } from 'react';

const OPEN = 'ti:side-panel-open';
const CLOSE = 'ti:side-panel-close';
// Two side panels (about 380 + 450 px) only leave half the screen to the map from about here up.
export const EXCLUSIVE_BELOW_WIDTH = 1600;

const tooNarrow = () => typeof window !== 'undefined' && window.innerWidth < EXCLUSIVE_BELOW_WIDTH;

// `open`: whether this panel is showing. `tuck(true|false)`: hide it for another panel, or bring it
// back when that panel closes (only if it was this hook that tucked it).
export const useExclusivePanel = (id, open, tuck) => {
  const tuckedRef = useRef(false);
  const tuckRef = useRef(tuck);
  tuckRef.current = tuck;

  // Announce this panel opening and closing.
  useEffect(() => {
    if (!open) return undefined;
    window.dispatchEvent(new CustomEvent(OPEN, { detail: id }));
    return () => window.dispatchEvent(new CustomEvent(CLOSE, { detail: id }));
  }, [id, open]);

  useEffect(() => {
    const onOpen = (e) => {
      if (e.detail === id || !open || !tooNarrow()) return;
      tuckedRef.current = true;
      tuckRef.current(true);
    };
    const onClose = (e) => {
      if (e.detail === id || !tuckedRef.current) return;
      tuckedRef.current = false;
      tuckRef.current(false);
    };
    window.addEventListener(OPEN, onOpen);
    window.addEventListener(CLOSE, onClose);
    return () => { window.removeEventListener(OPEN, onOpen); window.removeEventListener(CLOSE, onClose); };
  }, [id, open]);
};
