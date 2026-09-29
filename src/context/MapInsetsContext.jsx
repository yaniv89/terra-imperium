// src/context/MapInsetsContext.jsx
// How much of the screen each floating panel currently covers, per edge, so the map can centre
// things in the part of the screen that's still VISIBLE (plan §5.1, the "I can't see what my action
// does" fix). The map is a full-viewport layer with every panel floating over it — on a phone the
// Manage Region sheet alone covers the bottom ~65%, so the screen's own centre (where the camera
// used to put the region being acted on, and where its recruit/build/strike animation played) sat
// underneath the sheet.
//
// Any overlay reports itself with one hook — `useReportInset(key, edge, ref, active)` — which
// measures the element with a ResizeObserver, so sheets growing, shrinking ("auto-peek") or closing
// update the insets without any per-component bookkeeping. Several overlays on the same edge don't
// add up: they stack over the same strip of screen, so the edge's inset is the LARGEST one.
import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

const EDGES = ['top', 'bottom', 'left', 'right'];
const ZERO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

const MapInsetsContext = createContext({ insets: ZERO_INSETS, setInset: () => {} });

export const MapInsetsProvider = ({ children }) => {
  const [byKey, setByKey] = useState({});
  const setInset = useCallback((key, edge, px) => {
    setByKey((prev) => {
      if (px <= 0) {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key]?.edge === edge && prev[key]?.px === px) return prev;
      return { ...prev, [key]: { edge, px } };
    });
  }, []);
  const insets = useMemo(() => {
    const acc = { ...ZERO_INSETS };
    Object.values(byKey).forEach(({ edge, px }) => { if (EDGES.includes(edge)) acc[edge] = Math.max(acc[edge], px); });
    return acc;
  }, [byKey]);
  const value = useMemo(() => ({ insets, setInset }), [insets, setInset]);
  return <MapInsetsContext.Provider value={value}>{children}</MapInsetsContext.Provider>;
};

export const useMapInsets = () => useContext(MapInsetsContext).insets;

// `edge` is which side of the screen the element hugs; the reported size is its height for
// top/bottom and its width for left/right. `active: false` (e.g. a closed sheet, or a desktop-only
// layout on a phone) withdraws the report.
export const useReportInset = (key, edge, ref, active = true) => {
  const { setInset } = useContext(MapInsetsContext);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el || typeof ResizeObserver === 'undefined') {
      setInset(key, edge, 0);
      return undefined;
    }
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setInset(key, edge, Math.round(edge === 'left' || edge === 'right' ? rect.width : rect.height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { observer.disconnect(); setInset(key, edge, 0); };
  }, [key, edge, ref, active, setInset]);
};
