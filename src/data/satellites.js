// src/data/satellites.js
// The Space Race's orbital layer (plan §10.4 Layer 1). Persistent per-nation satellites, unlocked
// mid-Modern-Age — gated on the real Sputnik year, matching this game's existing pattern of
// grounding age-gates in real history (see navalReach.js's per-age sea lane reach, build-world-
// regions.mjs's real population/GDP formulas).
//
// Three of the plan's five described satellite effects name systems that don't exist yet in this
// codebase: there's no fog of war at all (every region's state is always fully visible to the
// player), missiles are Task 31's job, and there's no seasonal/winter attrition (only supply-range
// attrition). Rather than fake those, every satellite type below is honestly re-mapped onto real,
// already-working hooks: the same goldMult/hrMult/stabilityBonus getNationBonusTotal already sums
// for government/policies/wonders (src/utils/helpers.js), plus a flat per-turn diplomacyPoints/
// techPoints trickle calcIncome already knows how to apply generically.
//
// "Visibly orbiting the globe" (a persistent 3D orbital ring on GlobeView) is a real, separate
// rendering feature this task does not build — the data model, launch/strike actions and their
// real gameplay effects are complete and tested; the globe visualization is out of scope here the
// same way Task 23 scoped out AI counter-building until units existed to counter.
import { getEffectiveAgeId } from './ages';

export const SATELLITE_UNLOCK_YEAR = 1957; // Sputnik

export const SATELLITE_TYPES = {
  recon: {
    id: 'recon',
    name: 'Recon Satellite',
    description: 'Continuous overhead surveillance steadies the home front. +6 Stability, empire-wide.',
    effect: { stabilityBonus: 6 }
  },
  communications: {
    id: 'communications',
    name: 'Communications Satellite',
    description: 'Faster, more reliable contact with every embassy. +5 DIP/turn, +5% HR income.',
    effect: { hrMult: 0.05, dipPerTurn: 5 }
  },
  navigation: {
    id: 'navigation',
    name: 'Navigation Satellite',
    description: 'Precise positioning streamlines trade and logistics empire-wide. +8% Gold income.',
    effect: { goldMult: 0.08 }
  },
  weather: {
    id: 'weather',
    name: 'Weather Satellite',
    description: 'Accurate forecasting protects harvests from the worst surprises. +10% HR income.',
    effect: { hrMult: 0.1 }
  },
  spy: {
    id: 'spy',
    name: 'Spy Satellite',
    description: 'Passive intelligence-gathering feeds back into research. +5 Tech Points/turn.',
    effect: { techPointsPerTurn: 5 }
  }
};

export const SATELLITE_TYPE_IDS = Object.keys(SATELLITE_TYPES);

// True once a nation's effective age has reached Modern AND the calendar has reached the real
// year satellites became possible — the same one-age-ahead-rush ceiling every other age-gated
// system in this game shares still applies via getEffectiveAgeId itself.
export const canLaunchSatellite = (calendarAgeId, techAgeId, year) =>
  getEffectiveAgeId(calendarAgeId, techAgeId) === 'modern' && year >= SATELLITE_UNLOCK_YEAR;

// Orbital debris (plan §10.4's "shared-commons problem"): every ASAT strike raises the WORLD's
// debris level, degrading every nation's satellite effectiveness together — not just the target's
// — so overusing ASAT weapons is a real cost the whole space race shares, not a free way to
// cripple a rival for nothing. Decays slowly at peace (resolveTurn.js). Floors at 20%
// effectiveness rather than 0 so a maxed-out debris field never makes every satellite in orbit
// worthless outright.
export const MAX_ORBITAL_DEBRIS = 100;
export const getOrbitalEffectivenessMult = (debrisLevel) => Math.max(0.2, 1 - (debrisLevel || 0) / 125);

// Sums this nation's owned satellites' value for one effect key (goldMult/hrMult/stabilityBonus,
// each additive into getNationBonusTotal at the call site; diplomacyPointsPerTurn/techPointsPerTurn,
// additive directly into calcIncome), scaled by the shared orbital-debris effectiveness penalty.
export const getSatelliteEffectTotal = (satellites, nationId, effectKey, debrisLevel) => {
  const mult = getOrbitalEffectivenessMult(debrisLevel);
  return Object.values(satellites)
    .filter(s => s.ownerId === nationId)
    .reduce((sum, s) => sum + (SATELLITE_TYPES[s.typeId]?.effect?.[effectKey] || 0) * mult, 0);
};
