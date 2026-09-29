// src/effects/EffectsLayer.jsx
// The one renderer for every action animation, on both maps. The map supplies `getProjector`, a
// function returning — for the current frame — `{ project(lat, lng, alt) -> {x, y, visible}, zoom }`
// (GlobeEffectsOverlay: the globe camera with a horizon test; Map2DEffectsOverlay: the d3
// projection + current pan/zoom). Each effect gets a private SVG group (a "stage"), is built once
// by its scene, and is redrawn every animation frame from real elapsed time until EffectsContext
// expires it — see src/effects/engine.js for why elements are never torn down mid-life.
import React, { useEffect, useRef } from 'react';
import { REGION_COORDINATES } from '../data/regionCoordinates';
import { createStage } from './fx';
import { getScene } from './scenes';

const EffectsLayer = ({ effects, getProjector, width, height, ageId, testId }) => {
  const svgRef = useRef(null);
  const defsRef = useRef(null);
  const entriesRef = useRef(new Map());
  // Read through refs inside the rAF loop, so a re-render (new effects array, new projector, a pan)
  // never restarts the loop or rebuilds live effects.
  const effectsRef = useRef(effects);
  const projectorRef = useRef(getProjector);
  const ageRef = useRef(ageId);
  effectsRef.current = effects;
  projectorRef.current = getProjector;
  ageRef.current = ageId;

  useEffect(() => {
    let raf;
    const entries = entriesRef.current;
    const frame = () => {
      try {
        const svg = svgRef.current;
        const defs = defsRef.current;
        const list = effectsRef.current || [];
        if (!svg || !defs) return;
        const live = new Set(list.map((e) => e.id));
        entries.forEach((entry, id) => { if (!live.has(id)) { entry.stage.destroy(); entries.delete(id); } });
        if (list.length === 0) return;
        const projector = projectorRef.current && projectorRef.current();
        if (!projector) return;
        const now = Date.now();
        list.forEach((effect) => {
          const from = REGION_COORDINATES[effect.fromRegionId];
          const to = REGION_COORDINATES[effect.toRegionId];
          if (!from || !to) return;
          let entry = entries.get(effect.id);
          if (!entry) {
            const { scene, spec } = getScene(effect.actionType);
            const stage = createStage(svg, defs, effect.id);
            entry = { scene, spec, stage, state: scene.build(stage, effect, spec, { ageId: ageRef.current }) };
            entries.set(effect.id, entry);
          }
          const f = {
            t: now - effect.createdAt,
            from,
            to,
            z: projector.zoom,
            project: projector.project,
            src: projector.project(from.lat, from.lng, 0),
            dst: projector.project(to.lat, to.lng, 0),
            effect
          };
          if (f.t < 0 || f.t > entry.scene.duration + 200) { entry.stage.root.setAttribute('opacity', 0); return; }
          entry.stage.root.removeAttribute('opacity');
          entry.scene.draw(entry.state, f);
        });
      } catch (err) {
        // An animation bug must never take the game down with it.
        if (typeof console !== 'undefined') console.warn('Effect frame failed', err);
      } finally {
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      entries.forEach((entry) => entry.stage.destroy());
      entries.clear();
    };
  }, []);

  return (
    <svg ref={svgRef} className="absolute inset-0 pointer-events-none" width={width} height={height} data-testid={testId} style={{ overflow: 'visible' }}>
      <defs ref={defsRef} />
    </svg>
  );
};

export default EffectsLayer;
