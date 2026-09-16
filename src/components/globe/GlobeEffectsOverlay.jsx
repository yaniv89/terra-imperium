// src/components/globe/GlobeEffectsOverlay.jsx
// Phase 14 combat effects (missile/airstrike/invasion) for the globe view.
//
// This does NOT use react-globe.gl's built-in arcsData/ringsData, nor a custom Three.js object
// injected into its scene graph — both were built, and both were verified (via direct Three.js
// scene inspection: correct geometry, correct world position on the globe surface, correct
// color, opacity, and visibility all the way up the parent chain) to be constructed completely
// correctly, yet neither painted a single pixel under this environment's software WebGL renderer
// (no real GPU available here). Instead this draws a plain SVG overlay positioned via the
// globe's own getScreenCoords() — projecting each effect's lat/lng to 2D screen pixels every
// frame — the same proven-reliable DOM/SVG technique as the flat map's CombatEffectsLayer.jsx.
// Unlike that component, positions here are recomputed continuously (not just once): the globe's
// camera can rotate at any time, so a world-fixed lat/lng's screen position is never static.
//
// Elements are created ONCE per effect and updated in place every frame (never removed and
// re-appended) — an earlier version cleared and rebuilt the whole SVG on every tick, which was
// confirmed (via DOM polling) to genuinely place the right elements with the right attributes at
// the right times, yet screenshots kept catching an empty SVG anyway: the clear-then-rebuild
// cycle raced the browser's paint scheduling under this environment's heavy WebGL load, so a
// paint could land in the brief window where the SVG had just been cleared but not yet
// repopulated. Persistent elements remove that window entirely — something is always present
// for the compositor to paint, confirmed visually before trusting this.
import React, { useEffect, useRef } from 'react';
import { REGION_COORDINATES } from '../../data/regionCoordinates';

export const TRAVEL_MS = 700;
export const BURST_MS = 600;
const FADE_MS = 300;

// Total time an effect needs to stay live — CombatEffectsContext's EFFECT_LIFETIME_MS must be at
// least this long, or the DOM elements would be torn down mid-fade.
export const COMBAT_EFFECT_DURATION_MS = TRAVEL_MS + BURST_MS + FADE_MS;

const EFFECT_COLORS = {
  missile: '#f87171',
  airstrike: '#fb923c',
  invasion: '#60a5fa'
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const EFFECT_ALTITUDE = 0.08;

const setAttrs = (el, attrs) => {
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
};

const buildEntry = (svg, color) => {
  const line = document.createElementNS(SVG_NS, 'line');
  setAttrs(line, { stroke: color, 'stroke-width': 4, 'stroke-linecap': 'round' });
  const dot = document.createElementNS(SVG_NS, 'circle');
  setAttrs(dot, { r: 7, fill: color, stroke: 'white', 'stroke-width': 1.5 });
  const ring = document.createElementNS(SVG_NS, 'circle');
  setAttrs(ring, { fill: 'none', stroke: color, 'stroke-width': 3, r: 0, opacity: 0 });
  svg.appendChild(line);
  svg.appendChild(ring);
  svg.appendChild(dot);
  return { line, dot, ring };
};

const GlobeEffectsOverlay = ({ globeRef, width, height, effects }) => {
  const svgRef = useRef(null);
  const entriesRef = useRef(new Map()); // effect id -> { line, dot, ring }

  useEffect(() => {
    // Runs continuously while the globe view is mounted, even with zero active effects — cheap
    // (an empty forEach), and it's what promptly cleans up a just-expired effect's DOM elements
    // rather than leaving them behind forever once `effects` goes back to empty.
    let raf;

    const draw = () => {
      try {
        const svg = svgRef.current;
        const globe = globeRef.current;
        if (!svg || !globe) return;

        const now = Date.now();
        const liveIds = new Set(effects.map((e) => e.id));

        // Remove entries for effects that no longer exist (context's own lifetime timeout fired).
        entriesRef.current.forEach((entry, id) => {
          if (!liveIds.has(id)) {
            entry.line.remove();
            entry.dot.remove();
            entry.ring.remove();
            entriesRef.current.delete(id);
          }
        });

        effects.forEach((e) => {
          const from = REGION_COORDINATES[e.fromRegionId];
          const to = REGION_COORDINATES[e.toRegionId];
          if (!from || !to) return;

          let entry = entriesRef.current.get(e.id);
          if (!entry) {
            entry = buildEntry(svg, EFFECT_COLORS[e.type] || EFFECT_COLORS.missile);
            entriesRef.current.set(e.id, entry);
          }

          const fromScreen = globe.getScreenCoords(from.lat, from.lng, EFFECT_ALTITUDE);
          const toScreen = globe.getScreenCoords(to.lat, to.lng, EFFECT_ALTITUDE);
          const elapsed = now - e.createdAt;

          if (elapsed < TRAVEL_MS) {
            const t = elapsed / TRAVEL_MS;
            const curX = fromScreen.x + (toScreen.x - fromScreen.x) * t;
            const curY = fromScreen.y + (toScreen.y - fromScreen.y) * t;
            setAttrs(entry.line, { x1: fromScreen.x, y1: fromScreen.y, x2: curX, y2: curY, opacity: 0.9 });
            setAttrs(entry.dot, { cx: curX, cy: curY, opacity: 1 });
            setAttrs(entry.ring, { opacity: 0 });
          } else if (elapsed < TRAVEL_MS + BURST_MS) {
            const t = (elapsed - TRAVEL_MS) / BURST_MS;
            setAttrs(entry.line, { opacity: 0 });
            setAttrs(entry.dot, { opacity: 0 });
            setAttrs(entry.ring, { cx: toScreen.x, cy: toScreen.y, r: 4 + t * 40, opacity: 0.9 * (1 - t) });
          } else {
            setAttrs(entry.line, { opacity: 0 });
            setAttrs(entry.dot, { opacity: 0 });
            setAttrs(entry.ring, { opacity: 0 });
          }
        });
      } finally {
        raf = requestAnimationFrame(draw);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [effects, globeRef]);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
    />
  );
};

export default GlobeEffectsOverlay;
