// src/context/CombatEffectsContext.jsx
// Phase 14: transient visual effects (missile arcs, air strike bursts) triggered by player
// actions. Deliberately a SEPARATE context from GameContext — these are pure animation state
// (auto-expiring, never persisted, never read by the reducer), not game state, so they don't
// belong in a save file or in resolveTurn's deterministic, pure state transitions.
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { COMBAT_EFFECT_DURATION_MS } from '../components/map/CombatEffectsLayer';

const CombatEffectsContext = createContext(null);

// How long an effect stays mounted before removing itself — must be >= the total CSS animation
// duration in CombatEffectsLayer.jsx, or the shape would visibly snap away mid-motion. A little
// slack on top absorbs rAF/timer scheduling jitter between the two.
const EFFECT_LIFETIME_MS = COMBAT_EFFECT_DURATION_MS + 100;

export const CombatEffectsProvider = ({ children }) => {
  const [effects, setEffects] = useState([]);
  const nextId = useRef(0);

  const triggerEffect = useCallback((type, from, to) => {
    if (!from || !to) return; // a missing coordinate (e.g. no adjacent owned region found) is a no-op, not a crash
    const id = nextId.current++;
    setEffects((prev) => [...prev, { id, type, from, to }]);
    setTimeout(() => {
      setEffects((prev) => prev.filter((e) => e.id !== id));
    }, EFFECT_LIFETIME_MS);
  }, []);

  return (
    <CombatEffectsContext.Provider value={{ effects, triggerEffect }}>
      {children}
    </CombatEffectsContext.Provider>
  );
};

export const useCombatEffects = () => {
  const ctx = useContext(CombatEffectsContext);
  if (!ctx) throw new Error('useCombatEffects must be used within a CombatEffectsProvider');
  return ctx;
};
