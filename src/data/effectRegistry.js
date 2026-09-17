// src/data/effectRegistry.js
// Maps each action type to how EffectsContext (triggerEffect) should render it: which motion
// primitive draws it, its color palette (base -> hot), its projectile/glyph silhouette, and the
// per-primitive parameters that shape its choreography. See plan §10.5 — this is the
// combinatorial grammar (~12 motion primitives x palette x glyph) meant to give every action a
// distinct, recognizable effect without one-off bespoke rendering code per action.
//
// Two primitives are implemented in src/components/globe/GlobeEffectsOverlay.jsx:
//  - `arc`: a 3D ballistic/ground trajectory ending in a ring-burst impact. Used for anything that
//    travels between two regions — strikes, invasions, army movement, fleets, and diplomacy/trade
//    that visibly crosses the map between two capitals.
//  - `pulse`: a stationary effect centred on one region — a glyph pops in, concentric rings expand
//    outward, and a scatter of motes drift up and fade. Used for single-region actions (build a
//    building, recruit a unit, research a tech) that have no natural "from"/"to" geography.
// The other 10 primitives (rise/ring/build/flow/wipe/burst/plant/form/drift/fracture) remain
// unimplemented and ship alongside the actions that most need their specific motion, rather than
// being stubbed out ahead of time.
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
  },
  amphibious_assault: {
    primitive: 'arc',
    palette: { base: '#22d3ee', hot: '#ecfeff' },
    head: 'chevron',
    archPow: 1,
    ease: 'smooth',
    trailWidth: 3.6,
    fireball: 0.55,
    rings: 2,
    debris: 9,
    // A single landing wave rather than ground_invasion's pincer — everything comes off the sea.
    projectiles: [
      { lateral: 0, loft: 0.3, delay: 0, scale: 1.05, spread: 0 }
    ]
  },
  naval_engagement: {
    primitive: 'arc',
    palette: { base: '#1d4ed8', hot: '#bfdbfe' },
    head: 'dart',
    archPow: 0.5,
    ease: 'accelerate',
    trailWidth: 2.6,
    fireball: 0.6,
    rings: 2,
    debris: 11,
    // Two fleets closing on each other — broadsides converging from both directions at once.
    projectiles: [
      { lateral: -0.5, loft: 0.2, delay: 0, scale: 0.95, spread: -0.5 },
      { lateral: 0.5, loft: 0.2, delay: 60, scale: 0.95, spread: 0.5 }
    ]
  },
  asat_strike: {
    primitive: 'arc',
    palette: { base: '#a855f7', hot: '#f3e8ff' },
    head: 'dart',
    archPow: 1.4,
    ease: 'accelerate',
    trailWidth: 2.2,
    fireball: 0.45,
    rings: 2,
    debris: 14, // orbital debris cascade — deliberately busier than a normal impact
    projectiles: [{ lateral: 0, loft: 1.4, delay: 0, scale: 0.8, spread: 0 }]
  },
  move_army: {
    primitive: 'arc',
    palette: { base: '#4ade80', hot: '#ecfdf5' },
    head: 'chevron',
    archPow: 0.35,
    ease: 'smooth',
    trailWidth: 2.4,
    // A peaceful redeployment, not a strike — a soft dust settle at the destination, no explosion.
    fireball: 0.12,
    rings: 1,
    debris: 3,
    projectiles: [{ lateral: 0.15, loft: 0.14, delay: 0, scale: 0.85, spread: 0 }]
  },
  declare_war: {
    primitive: 'arc',
    palette: { base: '#dc2626', hot: '#fecaca' },
    head: 'warhead',
    archPow: 1.1,
    ease: 'accelerate',
    trailWidth: 3,
    fireball: 0.8,
    rings: 3,
    debris: 13,
    projectiles: [{ lateral: 0, loft: 0.8, delay: 0, scale: 1, spread: 0 }]
  },
  sue_for_peace: {
    primitive: 'arc',
    palette: { base: '#84cc16', hot: '#ecfccb' },
    head: 'dart',
    archPow: 0.4,
    ease: 'smooth',
    trailWidth: 2,
    fireball: 0.18,
    rings: 1,
    debris: 2,
    projectiles: [{ lateral: 0.1, loft: 0.3, delay: 0, scale: 0.8, spread: 0 }]
  },
  trade_agreement: {
    primitive: 'arc',
    palette: { base: '#fbbf24', hot: '#fffbeb' },
    head: 'dart',
    archPow: 0.4,
    ease: 'smooth',
    trailWidth: 2.2,
    fireball: 0.14,
    rings: 1,
    debris: 3,
    projectiles: [{ lateral: -0.2, loft: 0.28, delay: 0, scale: 0.8, spread: 0 }]
  },
  gift_bribe: {
    primitive: 'arc',
    palette: { base: '#eab308', hot: '#fef9c3' },
    head: 'dart',
    archPow: 0.4,
    ease: 'smooth',
    trailWidth: 1.8,
    fireball: 0.1,
    rings: 1,
    debris: 2,
    projectiles: [{ lateral: 0.05, loft: 0.24, delay: 0, scale: 0.7, spread: 0 }]
  },

  // ---- pulse primitive: single-region actions with no natural "from"/"to" geography ----
  recruit_unit: { primitive: 'pulse', palette: { base: '#22c55e', hot: '#dcfce7' }, glyph: 'square', rings: 2, motes: 8 },
  promote_unit: { primitive: 'pulse', palette: { base: '#fbbf24', hot: '#fffbeb' }, glyph: 'star', rings: 1, motes: 5 },
  suppress_rebellion: { primitive: 'pulse', palette: { base: '#f87171', hot: '#fef2f2' }, glyph: 'square', rings: 2, motes: 0 },
  construct_building: { primitive: 'pulse', palette: { base: '#f59e0b', hot: '#fef3c7' }, glyph: 'triangle', rings: 3, motes: 5 },
  develop_resource_site: { primitive: 'pulse', palette: { base: '#fb923c', hot: '#ffedd5' }, glyph: 'diamond', rings: 2, motes: 10 },
  build_infrastructure: { primitive: 'pulse', palette: { base: '#38bdf8', hot: '#e0f2fe' }, glyph: 'circle', rings: 3, motes: 4 },
  build_defenses: { primitive: 'pulse', palette: { base: '#94a3b8', hot: '#f1f5f9' }, glyph: 'square', rings: 2, motes: 0 },
  construct_wonder: { primitive: 'pulse', palette: { base: '#facc15', hot: '#fffbeb' }, glyph: 'star', rings: 4, motes: 12 },
  gain_control: { primitive: 'pulse', palette: { base: '#60a5fa', hot: '#dbeafe' }, glyph: 'circle', rings: 2, motes: 0 },
  settle_colonize: { primitive: 'pulse', palette: { base: '#fbbf24', hot: '#fef9c3' }, glyph: 'triangle', rings: 2, motes: 6 },
  research_tech: { primitive: 'pulse', palette: { base: '#a78bfa', hot: '#ede9fe' }, glyph: 'circle', rings: 2, motes: 6 },
  launch_satellite: { primitive: 'pulse', palette: { base: '#22d3ee', hot: '#ecfeff' }, glyph: 'triangle', rings: 3, motes: 8 }
};

const DEFAULT_EFFECT_TYPE = 'missile_strike';

export const getEffectSpec = (actionType) => EFFECT_REGISTRY[actionType] || EFFECT_REGISTRY[DEFAULT_EFFECT_TYPE];
