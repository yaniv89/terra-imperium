// src/components/globe/GlobeEffectsOverlay.jsx
// Action animations on the 3D globe: supplies the shared EffectsLayer (src/effects/) with a
// projector built from the globe's own camera, and exports the camera-choreography helpers
// GlobeView uses (where to frame an effect, when its big moment lands).
//
// WHY SVG AND NOT THREE.JS: react-globe.gl's built-in arcs/rings and custom Three.js objects were
// both built and verified to be constructed correctly, yet neither painted a pixel under this
// environment's software WebGL renderer. So effects are an SVG overlay — but trajectories are still
// genuinely three-dimensional (computed on the sphere in src/effects/engine.js and projected
// through the globe's own getScreenCoords every frame), so they bend over the Earth's curvature,
// follow the camera, and clip at the horizon like real 3D objects.
import React, { useCallback } from 'react';
import { REGION_COORDINATES } from '../../data/regionCoordinates';
import EffectsLayer from '../../effects/EffectsLayer';
import { latLngToVec, vecToLatLng, normalize, dot, clamp, DEG } from '../../effects/engine';
import { getImpactDelay as sceneImpactDelay, getEffectDuration } from '../../effects/scenes';

// When the effect's key moment lands — GlobeView punches the camera in and shakes it then.
export const getImpactDelay = (actionType) => sceneImpactDelay(actionType);
export { getEffectDuration };

// Where to put the camera so the whole effect is in frame: for a two-place effect, the midpoint,
// pulled back far enough that both ends share the screen; for a one-place effect, a close-up.
export const getFramingPov = (fromRegionId, toRegionId) => {
  const from = REGION_COORDINATES[fromRegionId];
  const to = REGION_COORDINATES[toRegionId];
  if (!to) return null;
  if (!from) return { lat: to.lat, lng: to.lng, altitude: 0.45 };
  const a = latLngToVec(from.lat, from.lng);
  const b = latLngToVec(to.lat, to.lng);
  const angle = Math.acos(clamp(dot(a, b), -1, 1));
  const mid = vecToLatLng(normalize({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }));
  return { lat: mid.lat, lng: mid.lng, altitude: clamp(0.3 + angle * 0.85, 0.3, 1.3) };
};

const GlobeEffectsOverlay = ({ globeRef, width, height, effects, ageId }) => {
  const getProjector = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return null;
    const radius = (globe.getGlobeRadius && globe.getGlobeRadius()) || 100;
    const camera = globe.camera && globe.camera();
    const camPos = camera && camera.position;
    const camDist = camPos ? Math.hypot(camPos.x, camPos.y, camPos.z) : 0;
    // Effects are sized in screen pixels, so they track how big the globe currently looks.
    let zoom = 1;
    if (camera && camDist > radius && height) {
      const focal = height / (2 * Math.tan(((camera.fov || 50) * DEG) / 2));
      zoom = clamp(((radius / camDist) * focal) / 420, 0.7, 1.7);
    }
    return {
      zoom,
      project: (lat, lng, alt = 0) => {
        // Hidden behind the limb exactly when P·C < R² (C = camera, R = radius).
        const dir = latLngToVec(lat, lng);
        const visible = !camPos || camDist <= radius || dot(dir, camPos) * radius * (1 + alt) >= radius * radius;
        const sc = globe.getScreenCoords(lat, lng, alt);
        return { x: sc?.x, y: sc?.y, visible: visible && !!sc && Number.isFinite(sc.x) && Number.isFinite(sc.y) };
      }
    };
  }, [globeRef, height]);

  return <EffectsLayer effects={effects} getProjector={getProjector} width={width} height={height} ageId={ageId} testId="globe-effects" />;
};

export default GlobeEffectsOverlay;
