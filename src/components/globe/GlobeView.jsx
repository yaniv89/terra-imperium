// src/components/globe/GlobeView.jsx
// Phase 12: an interactive whole-earth 3D globe (react-globe.gl / three.js) — orbit, pinch-zoom,
// and click, matching the "Google Earth, not a flat SVG" ask. This is a renderer, not yet the
// game surface: it shows the Middle East conflict in the flat map's own colors for continuity,
// but clicking a country only surfaces read-only info (see COUNTRY_HIGHLIGHT_COLORS /
// nationCountryMap.js). Fully rebuilding regions/adjacency on top of src/data/geo is Phase 13's
// job — but Phase 14's combat effects (missile/airstrike/invasion, see GlobeEffectsOverlay.jsx)
// ARE real, shared with the flat map via CombatEffectsContext and positioned with real lat/lng
// (regionCoordinates.js), so an action taken on either view animates on both.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { loadCountryFeatures } from '../../data/geo/loadWorldFeatures';
import { COUNTRY_HIGHLIGHT_COLORS } from './nationCountryMap';
import { REGION_COORDINATES } from '../../data/regionCoordinates';
import { useCombatEffects } from '../../context/CombatEffectsContext';
import GlobeEffectsOverlay from './GlobeEffectsOverlay';

const NEUTRAL_LAND_COLOR = '#334155'; // slate-700, matches the app's dark theme
const OCEAN_COLOR = '#0f172a'; // slate-900

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const GlobeView = ({ width, height, selectedCountryId, onSelectCountry }) => {
  const { effects } = useCombatEffects();
  const globeRef = useRef(null);
  const [features, setFeatures] = useState(null);
  // No globeImageUrl (no texture fetch, no external dependency, matches the stylized/game look
  // over photorealism) — react-globe.gl defaults an untextured globe to solid black, so oceans
  // are given an explicit deep-blue material instead to read clearly against land polygons.
  const globeMaterial = useMemo(() => new MeshPhongMaterial({ color: new Color('#0c2c4d') }), []);

  // The globe auto-rotates (below) — without this, a newly-triggered effect could land anywhere
  // on the sphere, including the far side facing away from the camera, making it invisible.
  // Flying the camera to the effect's target and pausing rotation is what actually makes the
  // animation something the player sees rather than something that technically fired offscreen.
  const lastEffectId = useRef(null);
  useEffect(() => {
    if (!effects || effects.length === 0) return;
    const latest = effects[effects.length - 1];
    if (latest.id === lastEffectId.current) return;
    lastEffectId.current = latest.id;
    const to = REGION_COORDINATES[latest.toRegionId];
    if (!to || !globeRef.current) return;
    const controls = globeRef.current.controls();
    if (controls) controls.autoRotate = false;
    // Close enough to actually see a short intra-country arc (e.g. Tel Aviv -> Negev is only
    // ~130km) rather than it disappearing into a single country-sized blob at a wider view.
    globeRef.current.pointOfView({ lat: to.lat, lng: to.lng, altitude: 0.4 }, 500);
  }, [effects]);

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
    <div className="relative w-full h-full">
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
      {!prefersReducedMotion() && (
        <GlobeEffectsOverlay globeRef={globeRef} width={width} height={height} effects={effects} />
      )}
    </div>
  );
};

export default GlobeView;
