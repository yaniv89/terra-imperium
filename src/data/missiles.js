// src/data/missiles.js
// Ballistic missiles and nuclear deterrence (plan §10.4 Layer 2). A missile strikes a region
// directly — no army, no supply line, no battle.js combat resolution — so its damage is applied
// straight to the target region's control/unrest and the target nation's militaryStrength, the
// same region/nation-level fields every other Domestic/Diplomacy action already reads and writes.
//
// Range is measured in land-adjacency hops (src/data/regions.js's distanceFromAnchor) from any of
// the striking nation's own regions — a real proxy for distance in a game where actual lat/lng
// coordinates don't exist yet, though a genuine simplification: real missiles don't care about
// land borders. ICBM and nuclear tiers sidestep this entirely with unlimited range (matching the
// plan's "ICBM (global)"), so islands and other hop-unreachable targets are still reachable by the
// tiers that should realistically reach them.
export const MISSILE_TIERS = {
  tactical: { id: 'tactical', name: 'Tactical Missile', range: 3, controlDamage: 10, unrestDamage: 15, militaryDamage: 100 },
  theatre: { id: 'theatre', name: 'Theatre Missile', range: 8, controlDamage: 20, unrestDamage: 25, militaryDamage: 250 },
  icbm: { id: 'icbm', name: 'ICBM', range: Infinity, controlDamage: 30, unrestDamage: 35, militaryDamage: 500 },
  // A nuclear warhead is delivered on an ICBM airframe (global range) but is tracked and built as
  // its own stockpile — real deterrence is about a distinct, expensive, consequential arsenal, not
  // just "a stronger ICBM".
  nuclear: { id: 'nuclear', name: 'Nuclear ICBM', range: Infinity, controlDamage: 60, unrestDamage: 80, militaryDamage: 1500 }
};

export const MISSILE_TIER_IDS = Object.keys(MISSILE_TIERS);

// ABM defense (plan: "intercepts incoming; never perfect"). Each level shaves 15% off incoming
// missile damage, capped at 5 levels — 75% reduction at maximum, never full immunity.
export const MAX_ABM_LEVEL = 5;
export const ABM_REDUCTION_PER_LEVEL = 0.15;
export const getAbmReductionMult = (abmLevel) => 1 - Math.min(MAX_ABM_LEVEL, abmLevel || 0) * ABM_REDUCTION_PER_LEVEL;

// A nuclear strike's "instant global condemnation" (plan) — every OTHER nation's hostility toward
// the striker jumps by this much, uncapped by the usual per-action nudges, reusing the exact
// pattern GameContext.jsx's unjustified-war branch already applies globally.
export const NUCLEAR_GLOBAL_HOSTILITY = 30;

// True if `targetRegionId` is within `tierId`'s range from any of `ownRegionIds` — Infinity-range
// tiers (icbm/nuclear) always return true without needing the hop search at all.
export const isMissileInRange = (tierId, ownRegionIds, targetRegionId, distanceFromAnchorFn) => {
  const tier = MISSILE_TIERS[tierId];
  if (!tier) return false;
  if (tier.range === Infinity) return true;
  const distance = distanceFromAnchorFn(ownRegionIds, targetRegionId);
  return distance !== null && distance <= tier.range;
};
