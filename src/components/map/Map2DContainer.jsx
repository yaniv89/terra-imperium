// src/components/map/Map2DContainer.jsx
// Sizing wrapper for the flat map: measures its box (ResizeObserver) and draws the WebGL map
// (gl/GLMapView.jsx, loaded on first use with three.js), or the old SVG map (Map2DView.jsx) when
// the "old map drawing" setting is on (mapPrefs.js), when `renderer="svg"` is asked for (the
// world map window), or when this browser has no WebGL2.
import React, { Suspense, useEffect, useRef, useState } from 'react';
import Map2DView from './Map2DView';
import { useMapPrefs } from './mapPrefs';

const GLMapView = React.lazy(() => import('./gl/GLMapView'));
let webgl2 = null;
const hasWebGL2 = () => {
  if (webgl2 == null) { try { webgl2 = !!document.createElement('canvas').getContext('webgl2'); } catch { webgl2 = false; } }
  return webgl2;
};

const Map2DContainer = ({
  selectedRegion, onSelectRegion, onAmbiguousTap = null, hudOffset = false, initialFocusRegionId = null, focusRegionId = null,
  navigateTarget = null, onViewportChange = null, selectedTile = null, onSelectTile = null, onSelectArmy = null, lens = 'political', selectedArmy = null,
  renderer = null }) => {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const prefs = useMapPrefs();
  const [glFailed, setGlFailed] = useState(false);
  const useGL = (renderer || prefs.renderer) === 'webgl' && !glFailed && hasWebGL2();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const props = {
    width: size.width, height: size.height, selectedRegion, onSelectRegion, onAmbiguousTap, hudOffset, initialFocusRegionId, focusRegionId,
    navigateTarget, onViewportChange, selectedTile, selectedArmy, onSelectTile, onSelectArmy, lens
  };
  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-900">
      {size.width > 0 && size.height > 0 && (useGL
        ? <Suspense fallback={<div className="w-full h-full" style={{ background: '#0f172a' }} />}><GLMapView {...props} onFail={() => setGlFailed(true)} /></Suspense>
        : <Map2DView {...props} />)}
    </div>
  );
};

export default Map2DContainer;
