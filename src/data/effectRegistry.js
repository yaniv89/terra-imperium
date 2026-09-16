// src/data/effectRegistry.js
// Maps each action type to how EffectsContext (triggerEffect) should render it: which motion
// primitive draws it, its color palette (base -> hot), its projectile/glyph silhouette, and the
// per-primitive parameters that shape its choreography. See plan §10.5 — this is the
// combinatorial grammar (~12 motion primitives x palette x glyph) meant to give every action a
// distinct, recognizable effect without one-off bespoke rendering code per action.
//
// Only the `arc` primitive (a 3D ballistic/ground trajectory ending in a ring-burst impact,
// src/components/globe/GlobeEffectsOverlay.jsx) is implemented so far — it's what the existing
// missile/air-strike/invasion effects already are, now looked up by action type instead of a
// fixed switch. The other 11 primitives (pulse/rise/ring/build/flow/wipe/burst/plant/form/drift/
// fracture) ship alongside the actions that need them, phase by phase, rather than being stubbed
// out ahead of time — Phase A has no actions wired to trigger effects yet (Domestic/Military/
// Diplomacy are read-only placeholders until Phases B/C/D), so these three entries exist as the
// registry's shape and reference implementation, ready for real callers to use.
export const EFFECT_REGISTRY = {
  missile_strike: {
    primitive: 'arc',
    palette: { base: '#f87171', hot: '#fee2e2' },
    head: 'warhead',
    archPow: 1,
    ease: 'accelerate',
    trailWidth: 3.2,
    fireball: 1,
    rings: 3,
    debris: 12,
    projectiles: [{ lateral: 0, loft: 1, delay: 0, scale: 1, spread: 0 }]
  },
  air_strike: {
    primitive: 'arc',
    palette: { base: '#fb923c', hot: '#fef3c7' },
    head: 'dart',
    // <1 puts the apex early: the flight climbs out fast and spends most of its time in a long
    // shallow dive onto the target, which is what an air strike should look like.
    archPow: 0.7,
    ease: 'accelerate',
    trailWidth: 2.4,
    fireball: 0.85,
    rings: 2,
    debris: 10,
    projectiles: [
      { lateral: -0.62, loft: 0.6, delay: 0, scale: 0.85, spread: -1 },
      { lateral: 0.04, loft: 0.82, delay: 125, scale: 1, spread: 0.3 },
      { lateral: 0.66, loft: 0.58, delay: 250, scale: 0.85, spread: 1 }
    ]
  },
  ground_invasion: {
    primitive: 'arc',
    palette: { base: '#60a5fa', hot: '#dbeafe' },
    head: 'chevron',
    archPow: 1,
    // Ground forces don't accelerate like a warhead — they roll forward at a steady pace.
    ease: 'smooth',
    trailWidth: 3.8,
    fireball: 0.4,
    rings: 2,
    debris: 8,
    projectiles: [
      { lateral: -0.8, loft: 0.24, delay: 0, scale: 1, spread: -0.9 },
      { lateral: 0.8, loft: 0.24, delay: 90, scale: 1, spread: 0.9 }
    ]
  }
};

const DEFAULT_EFFECT_TYPE = 'missile_strike';

export const getEffectSpec = (actionType) => EFFECT_REGISTRY[actionType] || EFFECT_REGISTRY[DEFAULT_EFFECT_TYPE];
