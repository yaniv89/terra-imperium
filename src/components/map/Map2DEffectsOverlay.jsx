// src/components/map/Map2DEffectsOverlay.jsx
// Action animations on the flat map: the same scenes as the globe (src/effects/), fed a projector
// built from the d3 equirectangular projection plus the live pan/zoom transform. Altitude (a lofted
// strike, a rocket, a gift lobbed across the map) is drawn as a lift up the screen, sized to the
// projection's own pixels-per-radian so arcs keep the same proportions as on the globe.
import React, { useCallback, useRef } from 'react';
import EffectsLayer from '../../effects/EffectsLayer';
import { clamp } from '../../effects/engine';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const Map2DEffectsOverlay = ({ effects, projection, transform, width, height, ageId }) => {
  // The rAF loop reads the latest projection/transform through a ref, so panning never rebuilds
  // an effect mid-animation.
  const live = useRef({ projection, transform });
  live.current = { projection, transform };

  const getProjector = useCallback(() => {
    const { projection: proj, transform: tf } = live.current;
    if (!proj) return null;
    const pxPerRadian = proj.scale() * tf.k;
    return {
      // At the default focus zoom (k=5) effects are drawn at their natural size.
      zoom: clamp(0.75 + tf.k * 0.05, 0.75, 1.5),
      project: (lat, lng, alt = 0) => {
        const p = proj([lng, lat]);
        if (!p) return { x: NaN, y: NaN, visible: false };
        return { x: p[0] * tf.k + tf.x, y: p[1] * tf.k + tf.y - alt * pxPerRadian * 0.6, visible: true };
      }
    };
  }, []);

  if (prefersReducedMotion()) return null;
  return <EffectsLayer effects={effects} getProjector={getProjector} width={width} height={height} ageId={ageId} testId="map2d-effects" />;
};

export default Map2DEffectsOverlay;
