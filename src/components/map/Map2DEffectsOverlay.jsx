// src/components/map/Map2DEffectsOverlay.jsx
// Plan §5.4: the flat map's own animation layer. GlobeEffectsOverlay only ever drew on the 3D globe,
// so every recruit/build/strike played nothing at all in flat-map mode. This is a deliberately
// lighter 2D rendition of the same EFFECT_REGISTRY grammar, driven by the same EffectsContext stream:
//  - `arc` (strikes, invasions, moves, diplomacy between capitals): a curved line drawn from the
//    source to the target over the arc's travel time, then impact rings at the target;
//  - `pulse` (single-region actions): the same unit/building/resource icon the globe shows pops in
//    over the region, with rings expanding outward.
// Pure CSS keyframes (src/index.css, `map2d-*`) — no rAF loop. Positions are recomputed from the
// live d3-zoom transform every render, so effects stay pinned to their region while the map pans
// (Map2DView pans to each new effect's target).
import React from 'react';
import { REGION_COORDINATES } from '../../data/regionCoordinates';
import { getEffectSpec } from '../../data/effectRegistry';
import { getUnitIconPath } from '../../data/unitIcons';
import { getBuildingIconPath, getExtractionIconPath } from '../../data/buildingIcons';
import { TRAVEL_MS } from '../globe/GlobeEffectsOverlay';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The icon art is authored on a 0..512 viewBox (game-icons.net); drawn ~28px wide here.
const ICON_SIZE = 28;
const iconTransform = `scale(${ICON_SIZE / 512}) translate(-256,-256)`;

const getGlyphPath = (spec, effect) => {
  if (spec.glyph === 'unit') return getUnitIconPath(effect.age || 'modern', effect.variant || 'infantry') || getUnitIconPath('modern', 'infantry');
  if (spec.glyph === 'building') return getBuildingIconPath(effect.variant, effect.age);
  if (spec.glyph === 'extraction') return getExtractionIconPath(effect.variant);
  return null;
};

const Rings = ({ x, y, color, count, delayMs }) => (
  <g transform={`translate(${x},${y})`}>
    {Array.from({ length: Math.max(1, count || 1) }).map((_, i) => (
      <circle
        key={i}
        r="10"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        className="map2d-ring"
        style={{ animationDelay: `${delayMs + i * 160}ms` }}
      />
    ))}
  </g>
);

const Map2DEffectsOverlay = ({ effects, projection, transform, width, height }) => {
  if (!projection || !effects?.length || prefersReducedMotion()) return null;
  const toScreen = (regionId) => {
    const c = REGION_COORDINATES[regionId];
    if (!c) return null;
    const p = projection([c.lng, c.lat]);
    if (!p) return null;
    return [p[0] * transform.k + transform.x, p[1] * transform.k + transform.y];
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      data-testid="map2d-effects"
    >
      {effects.map((effect) => {
        const spec = getEffectSpec(effect.actionType);
        const to = toScreen(effect.toRegionId);
        if (!to) return null;
        const base = spec.palette?.base || '#fbbf24';
        const hot = spec.palette?.hot || '#ffffff';
        const from = toScreen(effect.fromRegionId);

        if (spec.primitive === 'arc' && from && (from[0] !== to[0] || from[1] !== to[1])) {
          // A quadratic curve bowed "upward" (screen space) by a third of the distance, so a short
          // hop and a long strike both read as a trajectory rather than a flat line.
          const dx = to[0] - from[0];
          const dy = to[1] - from[1];
          const dist = Math.hypot(dx, dy);
          // Unit normal to the chord, flipped so it points up the screen (negative y).
          let nx = -dy / dist;
          let ny = dx / dist;
          if (ny > 0) { nx = -nx; ny = -ny; }
          const cx = (from[0] + to[0]) / 2 + nx * dist * 0.3;
          const cy = (from[1] + to[1]) / 2 + ny * dist * 0.3;
          const d = `M ${from[0]} ${from[1]} Q ${cx} ${cy} ${to[0]} ${to[1]}`;
          return (
            <g key={effect.id}>
              <path d={d} pathLength="1" fill="none" stroke={base} strokeWidth="3" strokeLinecap="round"
                className="map2d-draw" style={{ animationDuration: `${TRAVEL_MS}ms` }} />
              <circle cx={to[0]} cy={to[1]} r="5" fill={hot} className="map2d-flash" style={{ animationDelay: `${TRAVEL_MS}ms` }} />
              <Rings x={to[0]} y={to[1]} color={base} count={spec.rings} delayMs={TRAVEL_MS} />
            </g>
          );
        }

        const glyph = getGlyphPath(spec, effect);
        return (
          <g key={effect.id}>
            <Rings x={to[0]} y={to[1]} color={base} count={spec.rings} delayMs={0} />
            <g transform={`translate(${to[0]},${to[1] - 4})`}>
              <g className="map2d-pop">
                <circle r={ICON_SIZE / 2 + 4} fill="rgba(15,23,42,0.85)" stroke={base} strokeWidth="2" />
                {glyph
                  ? <g transform={iconTransform}><path d={glyph} fill={hot} /></g>
                  : <circle r="6" fill={hot} />}
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
};

export default Map2DEffectsOverlay;
