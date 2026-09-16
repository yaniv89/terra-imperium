// src/context/EffectsContext.jsx
// Transient visual effects triggered by player/AI actions (plan §10.5) — missile arcs, air-strike
// bursts and ground invasions today via the `arc` primitive; every other action gets its own
// EFFECT_REGISTRY entry (src/data/effectRegistry.js) as its mechanics land. Deliberately a
// SEPARATE context from GameContext — these are pure animation state (auto-expiring, never
// persisted, never read by the reducer), not game state, so they don't belong in a save file or
// in resolveTurn's deterministic, pure state transitions.
//
// Effects are stored by REGION ID, not by screen coordinates: GlobeEffectsOverlay resolves
// {fromRegionId, toRegionId} into real lat/lng (regionCoordinates.js) and projects that onto the
// globe's current camera every frame.
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ARC_EFFECT_DURATION_MS } from '../components/globe/GlobeEffectsOverlay';

const EffectsContext = createContext(null);

// How long an effect stays mounted before removing itself — must be >= the total animation
// duration any implemented primitive uses, or a shape would visibly snap away mid-motion. A
// little slack on top absorbs rAF/timer scheduling jitter. Only the `arc` primitive exists today;
// this becomes a max() over every implemented primitive's own duration as more are added.
const EFFECT_LIFETIME_MS = ARC_EFFECT_DURATION_MS + 100;

export const EffectsProvider = ({ children }) => {
  const [effects, setEffects] = useState([]);
  const nextId = useRef(0);

  // `actionType` keys into EFFECT_REGISTRY. `from`/`to` are region ids describing the effect's
  // geography (an effect with no natural "from", e.g. an empire-wide policy pulse, can pass the
  // same id as `region` for both). `magnitude` is carried through for primitives that scale their
  // intensity by it — unused by the currently-implemented `arc` primitive, but part of the stable
  // trigger signature every future primitive reads from.
  const triggerEffect = useCallback((actionType, { from, to, region, magnitude } = {}) => {
    const fromRegionId = from || region;
    const toRegionId = to || region;
    if (!fromRegionId || !toRegionId) return; // no real geography to animate — a no-op, not a crash
    const id = nextId.current++;
    setEffects((prev) => [...prev, { id, actionType, fromRegionId, toRegionId, magnitude, createdAt: Date.now() }]);
    setTimeout(() => {
      setEffects((prev) => prev.filter((e) => e.id !== id));
    }, EFFECT_LIFETIME_MS);
  }, []);

  return (
    <EffectsContext.Provider value={{ effects, triggerEffect }}>
      {children}
    </EffectsContext.Provider>
  );
};

export const useEffects = () => {
  const ctx = useContext(EffectsContext);
  if (!ctx) throw new Error('useEffects must be used within an EffectsProvider');
  return ctx;
};
