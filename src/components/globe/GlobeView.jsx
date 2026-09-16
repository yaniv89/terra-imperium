// src/components/globe/GlobeView.jsx
// The 3D globe (react-globe.gl / three.js) IS the game's map — there is no flat SVG map anymore.
// Every country on Earth is a real, playable game region (src/data/regions.js): the 28
// hand-authored ones from the original campaign, plus one whole-country region for every other
// nation (Phase 13's world-region expansion — see scripts/geo/build-world-regions.mjs), each
// rendered using real admin-1 province geometry (see loadGameRegions.js) so the globe reads as an
// actual subdivided map, not flat per-country blobs. Every region is colored by live
// ownership/control and clickable to drive the same selectedRegion/onSelectRegion contract the
// rest of the game (ActionPanel, RegionInfoModal) already expects — there's no separate
// "decorative backdrop" tier anymore, the whole world is the same one system.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { MeshBasicMaterial, Color } from 'three';
import { useGame } from '../../context/GameContext';
import { REGIONS_DATA, HAND_AUTHORED_REGION_IDS } from '../../data/regions';
import { loadGameRegionFeatures } from '../../data/geo/loadGameRegions';
import { REGION_COORDINATES } from '../../data/regionCoordinates';
import { useCombatEffects } from '../../context/CombatEffectsContext';
import GlobeEffectsOverlay, { getFramingPov, getImpactDelay } from './GlobeEffectsOverlay';
import { RegionInfoModal } from '../modals';
import MapLegend from './MapLegend';

const NEUTRAL_LAND_COLOR = '#334155'; // slate-700, defensive fallback — every real region has a nation color
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
  // Moving the camera and pausing rotation is what actually makes the animation something the
  // player sees rather than something that technically fired offscreen. It runs as a two-beat
  // camera move: first frame the WHOLE trajectory (getFramingPov centres on the midpoint and
  // pulls back far enough for the launch site and the target to share the screen, so the arc is
  // watchable end to end), then punch in on the target at the exact moment of impact.
  const lastEffectId = useRef(null);
  const shakeRef = useRef(null);
  useEffect(() => {
    if (!effects || effects.length === 0) return undefined;
    const latest = effects[effects.length - 1];
    if (latest.id === lastEffectId.current) return undefined;
    lastEffectId.current = latest.id;
    const to = REGION_COORDINATES[latest.toRegionId];
    if (!to || !globeRef.current) return undefined;
    const controls = globeRef.current.controls();
    if (controls) controls.autoRotate = false;

    const framing = getFramingPov(latest.fromRegionId, latest.toRegionId)
      || { lat: to.lat, lng: to.lng, altitude: 0.4 };
    globeRef.current.pointOfView(framing, 520);

    if (prefersReducedMotion()) return undefined;
    const punch = setTimeout(() => {
      globeRef.current?.pointOfView({ lat: to.lat, lng: to.lng, altitude: 0.22 }, 620);
      // Restarting a CSS animation needs the name cleared and a reflow forced in between,
      // otherwise a second strike in quick succession wouldn't shake at all.
      const node = shakeRef.current;
      if (node) {
        node.style.animation = 'none';
        void node.offsetWidth;
        node.style.animation = '';
        node.classList.remove('globe-impact-shake');
        void node.offsetWidth;
        node.classList.add('globe-impact-shake');
      }
    }, getImpactDelay(latest.type));
    return () => clearTimeout(punch);
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
    const regionState = state.regions[gameRegionId];
    if (!regionState) return NEUTRAL_LAND_COLOR;
    const nation = regionState.owner !== 'player' ? state.nations[regionState.owner] : null;
    return fillColorFor(regionState, nation);
  };

  const strokeColor = (feature) => {
    const gameRegionId = feature.properties?.gameRegionId;
    if (gameRegionId === selectedRegion) return '#2563eb';
    if (state.regions[gameRegionId]?.underInvasion) return '#ef4444';
    return '#0f172a';
  };

  const altitude = (feature) => {
    const gameRegionId = feature.properties?.gameRegionId;
    if (gameRegionId === selectedRegion) return 0.03;
    if (state.regions[gameRegionId]?.underInvasion) return 0.02;
    return 0.012;
  };

  const label = (feature) => {
    const gameRegionId = feature.properties?.gameRegionId;
    const regionData = REGIONS_DATA[gameRegionId];
    const regionState = state.regions[gameRegionId];
    if (!regionData || !regionState) return '';
    const ownerName = regionState.owner === 'player' ? 'You' : (state.nations[regionState.owner]?.name || regionState.owner);
    const provinceName = feature.properties?.name;
    const subtitle = provinceName && provinceName !== regionData.name ? `${provinceName} &middot; ` : '';
    return `
      <div style="background:#0f172a;color:#e2e8f0;padding:6px 10px;border-radius:6px;font:12px sans-serif;border:1px solid #334155">
        <strong>${regionData.name}</strong><br/>
        <span style="color:#94a3b8">${subtitle}${ownerName}${regionState.owner === 'player' ? ` &middot; ${regionState.control || 0}%` : ''}</span>
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
  // rebuild every polygon mesh on every render instead of just once.
  const polygons = useMemo(() => geo?.gameRegionFeatures || null, [geo]);

  if (!geo) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
        Loading world map…
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <RegionInfoModal
        regionId={selectedRegion}
        onClose={() => onSelectRegion(null)}
        position="panel"
      />
      <MapLegend />
      {/* The globe and its effects overlay share one wrapper so the impact shake moves them
          together — shaking the canvas alone would slide the map out from under the animation.
          The panel chrome (legend, region card) deliberately sits outside it and stays still. */}
      <div ref={shakeRef} className="absolute inset-0">
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
        polygonCapCurvatureResolution={(feature) => (HAND_AUTHORED_REGION_IDS.includes(feature.properties?.gameRegionId) ? 5 : 30)}
        polygonsTransitionDuration={200}
        polygonLabel={label}
        onPolygonClick={handleClick}
      />
      {!prefersReducedMotion() && (
        <GlobeEffectsOverlay globeRef={globeRef} width={width} height={height} effects={effects} />
      )}
      </div>
    </div>
  );
};

export default GlobeView;
