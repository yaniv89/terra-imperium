// src/components/map/CombatEffectsLayer.jsx
// Phase 14: renders transient missile/air-strike effects (see CombatEffectsContext) as an SVG
// overlay in the same 1000x800 viewBox as the region paths in mapPaths.js. Effects are stored by
// region id in the context; this layer is what resolves fromRegionId/toRegionId into flat-map
// x/y (a region's existing labelX/labelY) — the globe's equivalent (GlobeView.jsx) resolves the
// same ids into lat/lng instead, via regionCoordinates.js.
//
// Driven by CSS transitions/keyframes rather than SVG SMIL (<animate>): SMIL's timeline proved
// unreliable in headless/automated rendering during testing (a declared 0.7s duration completed
// in under 150ms), while CSS transitions on SVG geometry properties (cx/cy/r are CSS-animatable
// per SVG2 in evergreen browsers) behave consistently and are the same mechanism already used
// everywhere else in this app's UI.
import React, { useEffect, useState } from 'react';
import { MAP_PATHS } from '../../data/mapPaths';

const COLORS = {
  missile: '#f87171', // red-400
  airstrike: '#fb923c', // orange-400
  invasion: '#60a5fa' // blue-400
};

export const TRAVEL_MS = 700;
export const BURST_MS = 600;
const FADE_MS = 300;

// Total time an effect needs to stay mounted — CombatEffectsContext's EFFECT_LIFETIME_MS must be
// at least this long, or the group would be unmounted mid-fade.
export const COMBAT_EFFECT_DURATION_MS = TRAVEL_MS + BURST_MS + FADE_MS;

const anchorFor = (regionId) => {
  const path = MAP_PATHS[regionId];
  return path ? { x: path.labelX, y: path.labelY } : null;
};

const CombatEffect = ({ type, from, to }) => {
  const color = COLORS[type] || COLORS.missile;
  const [traveling, setTraveling] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Committing the `from` position first, then flipping to `to` a frame later, is what makes
    // the CSS transition actually animate instead of snapping instantly — a well-known gotcha
    // where changing a transitioned property in the same paint as its initial value skips the
    // transition entirely.
    let raf2;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setTraveling(true)); });
    const burstTimer = setTimeout(() => setShowBurst(true), TRAVEL_MS);
    const fadeTimer = setTimeout(() => setFading(true), TRAVEL_MS + BURST_MS);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(burstTimer);
      clearTimeout(fadeTimer);
    };
  }, []);

  const pos = traveling ? to : from;
  const transitionStyle = { transition: `all ${TRAVEL_MS}ms ease-in-out` };

  return (
    <g
      className="pointer-events-none"
      style={{ transition: `opacity ${FADE_MS}ms ease-out`, opacity: fading ? 0 : 1 }}
    >
      {/* Trail: a line that "draws" itself from source to target */}
      <line
        x1={from.x} y1={from.y} x2={pos.x} y2={pos.y}
        stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.9"
        style={transitionStyle}
      />
      <line
        x1={from.x} y1={from.y} x2={pos.x} y2={pos.y}
        stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"
        style={transitionStyle}
      />

      {/* Warhead: a bright dot leading the trail, replaced by the burst once it arrives */}
      {!showBurst && (
        <circle cx={pos.x} cy={pos.y} r="7" fill={color} stroke="white" strokeWidth="1.5" style={transitionStyle} />
      )}

      {/* Burst: an expanding, fading ring at the target once the trail arrives */}
      {showBurst && (
        <circle cx={to.x} cy={to.y} r="0" fill="none" stroke={color} strokeWidth="3" className="combat-burst-ring" />
      )}
    </g>
  );
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const CombatEffectsLayer = ({ effects }) => {
  // The actual combat outcome is always conveyed through the log/battle-summary toast regardless
  // — this layer is a pure enhancement, safe to fully suppress for a reduced-motion preference.
  if (!effects || effects.length === 0 || prefersReducedMotion()) return null;
  return (
    <g>
      {effects.map((e) => {
        const from = anchorFor(e.fromRegionId);
        const to = anchorFor(e.toRegionId);
        if (!from || !to) return null; // a region with no flat-map path (shouldn't happen for the 28 game regions)
        return <CombatEffect key={e.id} type={e.type} from={from} to={to} />;
      })}
    </g>
  );
};

export default CombatEffectsLayer;
