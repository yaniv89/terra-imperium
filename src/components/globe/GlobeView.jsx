// src/components/globe/GlobeView.jsx
// Phase 12: an interactive whole-earth 3D globe (react-globe.gl / three.js) — orbit, pinch-zoom,
// and click, matching the "Google Earth, not a flat SVG" ask. This is a renderer, not yet the
// game surface: it shows the Middle East conflict in the flat map's own colors for continuity,
// but clicking a country only surfaces read-only info (see COUNTRY_HIGHLIGHT_COLORS /
// nationCountryMap.js). Binding real game actions to world geometry is Phase 13's job, once
// regions/adjacency are rebuilt on top of src/data/geo instead of the hand-authored 28 regions.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { loadCountryFeatures } from '../../data/geo/loadWorldFeatures';
import { COUNTRY_HIGHLIGHT_COLORS } from './nationCountryMap';

const NEUTRAL_LAND_COLOR = '#334155'; // slate-700, matches the app's dark theme
const OCEAN_COLOR = '#0f172a'; // slate-900

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const GlobeView = ({ width, height, selectedCountryId, onSelectCountry }) => {
  const globeRef = useRef(null);
  const [features, setFeatures] = useState(null);
  // No globeImageUrl (no texture fetch, no external dependency, matches the stylized/game look
  // over photorealism) — react-globe.gl defaults an untextured globe to solid black, so oceans
  // are given an explicit deep-blue material instead to read clearly against land polygons.
  const globeMaterial = useMemo(() => new MeshPhongMaterial({ color: new Color('#0c2c4d') }), []);

  useEffect(() => {
    let cancelled = false;
    loadCountryFeatures().then((f) => { if (!cancelled) setFeatures(f); });
    return () => { cancelled = true; };
  }, []);

  // Auto-rotate is a nice "alive" default for a menu-screen-style globe, but it's motion a
  // reduced-motion user explicitly asked not to see, and it should stop as soon as they've
  // actually grabbed the globe (dragging while it spins fights the user's own input).
  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (!controls) return;
    controls.autoRotate = !prefersReducedMotion();
    controls.autoRotateSpeed = 0.4;
    const stopOnInteract = () => { controls.autoRotate = false; };
    controls.addEventListener('start', stopOnInteract);
    return () => controls.removeEventListener('start', stopOnInteract);
  }, [features]);

  const capColor = (feature) => {
    if (feature.id === selectedCountryId) return '#fbbf24'; // amber-400, matches selection highlight elsewhere
    return COUNTRY_HIGHLIGHT_COLORS[feature.id] || NEUTRAL_LAND_COLOR;
  };

  if (!features) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
        Loading world map…
      </div>
    );
  }

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor={OCEAN_COLOR}
      showGlobe
      showAtmosphere
      atmosphereColor="#38bdf8"
      atmosphereAltitude={0.15}
      globeMaterial={globeMaterial}
      polygonsData={features}
      polygonCapColor={capColor}
      polygonSideColor={() => 'rgba(15, 23, 42, 0.6)'}
      polygonStrokeColor={() => '#0f172a'}
      polygonAltitude={(f) => (f.id === selectedCountryId ? 0.02 : 0.006)}
      polygonsTransitionDuration={200}
      polygonLabel={(f) => `
        <div style="background:#0f172a;color:#e2e8f0;padding:6px 10px;border-radius:6px;font:12px sans-serif;border:1px solid #334155">
          <strong>${f.properties.name}</strong>${f.properties.continent ? `<br/><span style="color:#94a3b8">${f.properties.continent}</span>` : ''}
        </div>
      `}
      onPolygonClick={(f) => onSelectCountry?.(f.id === selectedCountryId ? null : f.id)}
    />
  );
};

export default GlobeView;
