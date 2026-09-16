// src/components/globe/GlobeView.jsx
// The 3D globe (react-globe.gl / three.js) IS the game's map — there is no flat SVG map anymore.
// Each of the 28 hand-authored game regions (src/data/regions.js) is rendered using real
// country/province geometry (see loadGameRegions.js), colored by live ownership/control exactly
// like the old flat map did, and clickable to drive the same selectedRegion/onSelectRegion contract
// the rest of the game (ActionPanel, RegionInfoModal) already expects. The rest of the world
// renders as a muted, non-interactive backdrop so the globe still reads as a whole planet.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { MeshBasicMaterial, Color } from 'three';
import { useGame } from '../../context/GameContext';
import { REGIONS_DATA } from '../../data/regions';
import { loadGameRegionFeatures } from '../../data/geo/loadGameRegions';
import { REGION_COORDINATES } from '../../data/regionCoordinates';
import { useCombatEffects } from '../../context/CombatEffectsContext';
import GlobeEffectsOverlay from './GlobeEffectsOverlay';
import { RegionInfoModal } from '../modals';
import MapLegend from './MapLegend';

const NEUTRAL_LAND_COLOR = '#334155'; // slate-700, matches the app's dark theme
const OCEAN_COLOR = '#0f172a'; // slate-900

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Mirrors the flat map's old RegionPath.getFillColor() heat-map-by-control logic exactly, so
// switching to the globe changed nothing about what the colors mean.
const fillColorFor = (regionState, nation) => {
  if (regionState.owner === 'player') {
    const control = regionState.control || 0;
    if (control >= 80) return '#4ade80';
    if (control >= 60) return '#84cc16';
    if (control >= 40) return '#facc15';
    if (control >= 20) return '#fb923c';
    return '#f87171';
  }
  if (nation?.isAtWar) return '#fca5a5';
  return nation?.color || '#d1d5db';
};

const GlobeView = ({ width, height, selectedRegion, onSelectRegion }) => {
  const { state } = useGame();
  const { effects } = useCombatEffects();
  const globeRef = useRef(null);
  const [geo, setGeo] = useState(null);
  // No globeImageUrl (no texture fetch, no external dependency, matches the stylized/game look
  // over photorealism) — react-globe.gl defaults an untextured globe to solid black, so oceans
  // are given an explicit deep-blue material instead to read clearly against land polygons.
  const globeMaterial = useMemo(() => new MeshBasicMaterial({ color: new Color('#0c2c4d') }), []);

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
    globeRef.current.pointOfView({ lat: to.lat, lng: to.lng, altitude: 0.4 }, 500);
  }, [effects]);

  useEffect(() => {
    let cancelled = false;
    loadGameRegionFeatures().then((f) => { if (!cancelled) setGeo(f); });
    return () => { cancelled = true; };
  }, []);

  // Flies to the player's home turf on first load so the game opens somewhere meaningful instead
  // of wherever react-globe.gl's own default camera position happens to be.
  useEffect(() => {
    if (!geo || !globeRef.current) return;
    const home = REGION_COORDINATES.tel_aviv;
    globeRef.current.pointOfView({ lat: home.lat, lng: home.lng, altitude: 1.4 }, 0);
  }, [geo]);

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
  }, [geo]);

  const capColor = (feature) => {
    const gameRegionId = feature.properties?.gameRegionId;
    if (!gameRegionId) return NEUTRAL_LAND_COLOR;
    const regionState = state.regions[gameRegionId];
    if (!regionState) return NEUTRAL_LAND_COLOR;
    const nation = regionState.owner !== 'player' ? state.nations[regionState.owner] : null;
    return fillColorFor(regionState, nation);
  };

  const strokeColor = (feature) => {
    const gameRegionId = feature.properties?.gameRegionId;
    if (!gameRegionId) return '#0f172a';
    if (gameRegionId === selectedRegion) return '#2563eb';
    if (state.regions[gameRegionId]?.underInvasion) return '#ef4444';
    return '#0f172a';
  };

  const altitude = (feature) => {
    const gameRegionId = feature.properties?.gameRegionId;
    if (!gameRegionId) return 0.006;
    if (gameRegionId === selectedRegion) return 0.03;
    if (state.regions[gameRegionId]?.underInvasion) return 0.02;
    return 0.012;
  };

  const label = (feature) => {
    const gameRegionId = feature.properties?.gameRegionId;
    if (!gameRegionId) {
      return `<div style="background:#0f172a;color:#94a3b8;padding:5px 8px;border-radius:6px;font:11px sans-serif;border:1px solid #334155">${feature.properties?.name || ''}</div>`;
    }
    const regionData = REGIONS_DATA[gameRegionId];
    const regionState = state.regions[gameRegionId];
    const ownerName = regionState.owner === 'player' ? 'You' : (state.nations[regionState.owner]?.name || regionState.owner);
    return `
      <div style="background:#0f172a;color:#e2e8f0;padding:6px 10px;border-radius:6px;font:12px sans-serif;border:1px solid #334155">
        <strong>${regionData.name}</strong><br/>
        <span style="color:#94a3b8">${ownerName}${regionState.owner === 'player' ? ` &middot; ${regionState.control || 0}%` : ''}</span>
      </div>
    `;
  };

  const handleClick = (feature) => {
    const gameRegionId = feature.properties?.gameRegionId;
    if (!gameRegionId) return;
    onSelectRegion(gameRegionId === selectedRegion ? null : gameRegionId);
  };

  // Memoized so polygonsData keeps a STABLE reference across re-renders that don't actually
  // change the underlying geometry (e.g. a GameContext update from an unrelated action) — a new
  // array identity every render would make react-globe.gl treat it as entirely new data and
  // rebuild all ~950 polygon meshes on every render instead of just once.
  const polygons = useMemo(
    () => (geo ? [...geo.gameRegionFeatures, ...geo.restOfWorldFeatures] : null),
    [geo]
  );

  if (!geo) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
        Loading world map…
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <RegionInfoModal
        regionId={selectedRegion}
        onClose={() => onSelectRegion(null)}
        position="panel"
      />
      <MapLegend />
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
        polygonsData={polygons}
        polygonCapColor={capColor}
        polygonSideColor={() => 'rgba(15, 23, 42, 0.6)'}
        polygonStrokeColor={strokeColor}
        polygonAltitude={altitude}
        polygonCapCurvatureResolution={(feature) => (feature.properties?.gameRegionId ? 5 : 30)}
        polygonsTransitionDuration={200}
        polygonLabel={label}
        onPolygonClick={handleClick}
      />
      {!prefersReducedMotion() && (
        <GlobeEffectsOverlay globeRef={globeRef} width={width} height={height} effects={effects} />
      )}
    </div>
  );
};

export default GlobeView;
