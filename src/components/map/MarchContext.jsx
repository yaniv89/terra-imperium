// src/components/map/MarchContext.jsx
// March mode (plan §4d/4g): "March" on the region card, or a long press on an army banner, starts
// it; the next province tapped (or the one the banner is dropped on) becomes the target, the path
// is previewed on the map with turn numbers, and the March bar confirms or cancels. MapContainer
// provides it; both maps read it to draw the lines. Views outside it (the minimap) get null.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { planMarch } from '../../engine/routes';
import { getMarchLines } from '../../utils/marchLines';
import { START_MARCH } from './marchEvents';

const MarchContext = createContext(null);
export const useMarch = () => useContext(MarchContext);

export const MarchProvider = ({ children }) => {
  const { state } = useGame();
  // { from, target, dragging }
  const [march, setMarch] = useState(null);

  useEffect(() => {
    const onStart = (e) => setMarch({ from: e.detail, target: null });
    window.addEventListener(START_MARCH, onStart);
    return () => window.removeEventListener(START_MARCH, onStart);
  }, []);

  const plan = useMemo(() => (march?.from && march.target ? planMarch(state, march.from, march.target) : null), [state, march]);
  // The march mode ends by itself when its army is gone (moved, disbanded, beaten).
  const hasArmy = useMemo(() => !march || Object.values(state.units).some((u) => u.regionId === march.from && u.ownerId === state.playerNationId && u.domain !== 'naval' && !u.embarkedOn), [state.units, state.playerNationId, march]);
  useEffect(() => { if (!hasArmy) setMarch(null); }, [hasArmy]);

  const lines = useMemo(() => getMarchLines(state, plan), [state, plan]);
  const begin = useCallback((from, dragging = false) => setMarch({ from, target: null, dragging }), []);
  const aimAt = useCallback((target) => setMarch((m) => (m ? { ...m, target } : m)), []);
  const drop = useCallback((target) => setMarch((m) => (m ? { ...m, target, dragging: false } : m)), []);
  const cancel = useCallback(() => setMarch(null), []);

  const value = useMemo(() => ({ march, plan, lines, begin, aimAt, drop, cancel }), [march, plan, lines, begin, aimAt, drop, cancel]);
  return <MarchContext.Provider value={value}>{children}</MarchContext.Provider>;
};
