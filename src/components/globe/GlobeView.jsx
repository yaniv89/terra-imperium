// src/components/globe/GlobeView.jsx
// The 3D globe (react-globe.gl / three.js) on the tile world (plans/civ-map-rework.md, B4b and
// B5): the world view. Its texture is the realistic Earth raster with every city's land tinted in
// its nation's colour, nation borders and the selection drawn in (politicalTexture.js), clipped
// to the real coastline, so no hex edge ever shows along a coast. A tap resolves to the city whose
// land is under the pointer (nearest tile), driving the same selectedRegion/onSelectRegion
// contract the rest of the game expects. No polygon layer: the old 4,482 province meshes were the
// dominant cost of every frame.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { CanvasTexture, MeshPhongMaterial, Raycaster, Sphere, SRGBColorSpace, Vector2, Vector3 } from 'three';
import { useGame } from '../../context/GameContext';
import { getNationCapital } from '../../data/regions';
import { REGION_COORDINATES } from '../../data/regionCoordinates';
import { cityAtLatLon, getCityFeatures, tileAtLatLon } from '../../data/geo/cityFeatures';
import { loadCountryFeatures } from '../../data/geo/loadWorldFeatures';
import { renderPoliticalCanvas, loadImage } from './politicalTexture';
import { tapCandidates, tapRingPoints } from '../../utils/regionClickAssist';
import { useEffects } from '../../context/EffectsContext';
import { useMapInsets } from '../../context/MapInsetsContext';
import GlobeEffectsOverlay, { getFramingPov, getImpactDelay } from './GlobeEffectsOverlay';
import { getAtWarNationIds, getRegionFillColor } from '../../utils/mapRegionStyle';
import { worldRasterUrl, worldRasterSizeFor } from '../../data/geo/worldRaster';
import { getMapMarkers } from '../../utils/mapMarkers';
import { clusterGlobeItems, createMarkerElement, markerItems } from '../map/mapBanners';
import { markerLatLng } from '../../utils/markerPosition';
import { openBattleReport } from '../battle/battleReportEvents';

// Above this camera altitude (globe radii) the globe shows nations, not provinces.
const FAR_VIEW_ALTITUDE = 1.1;
const OCEAN_COLOR = '#0f172a'; // slate-900, the space behind the globe

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Test-only escape hatch: e2e automation sets this (via page.addInitScript, before the app's own
// scripts run) to skip auto-rotate specifically, without going through prefersReducedMotion() —
// that flag ALSO disables the whole GlobeEffectsOverlay below, which a test verifying an
// animation obviously can't afford to lose. Root cause this exists to sidestep (confirmed via a
// Playwright trace with full console/crash instrumentation): under headless, software-rendered
// (SwiftShader) WebGL, the globe's continuous auto-rotate redraw of 4,482 province polygons
// degrades the renderer the longer it runs uninterrupted — a synchronous layout query as ordinary
// as `locator.boundingBox()` on the live canvas can then hang and take the whole page down with
// it. A real player almost always drags the globe within seconds anyway (see the effect below),
// which is what keeps this invisible outside of automation that deliberately never touches it.
// Never true for a real player — nothing in the shipped app ever sets this flag.
const autoRotateDisabledForTests = () =>
  typeof window !== 'undefined' && window.__E2E_DISABLE_GLOBE_AUTOROTATE__ === true;

// Survives a GlobeView/GlobeContainer remount within the same page session (unlike a ref or state
// inside the component, which resets on remount) — once a real player has grabbed the globe, it
// should never resume spinning on its own again for the rest of the session, even if they switch
// tabs/panels in a way that unmounts and remounts the globe. Only a full page reload clears it.
let userDismissedAutoRotate = false;

// Converts react-globe.gl's `altitude` (camera distance above the surface, in globe-radii) into
// the angular half-width/half-height (degrees) of the roughly-circular visible cap, for
// MiniMap.jsx's viewport rectangle — see this component's own onViewportChange effect below for
// the shared `{centerLat, centerLng, halfWidthDeg, halfHeightDeg}` contract Map2DView.jsx also
// reports in. Camera distance from globe center is R(1+altitude); the visible half-angle from the
// center is arccos(R/distance) = arccos(1/(1+altitude)) — standard "horizon angle" trigonometry.
// An approximation (a sphere's visible cap isn't a lat/lng rectangle), but plenty good enough for
// a small minimap indicator, and it's the same approach Civ/Paradox minimaps use for a 3D camera.
const visibleHalfAngleDeg = (altitude) => (Math.acos(1 / (1 + Math.max(altitude, 0.01))) * 180) / Math.PI;

const GlobeView = ({ onAmbiguousTap = null,
  width, height, selectedRegion, onSelectRegion, focusRegionId = null, navigateTarget = null, onViewportChange = null, onSelectTile = null, onSelectArmy = null, lens = 'political'
}) => {
  const { state } = useGame();
  const { effects } = useEffects();
  const insets = useMapInsets();
  const globeRef = useRef(null);
  // `geo` is ready once the coastline (the texture's land mask) and the Earth raster have loaded.
  const [geo, setGeo] = useState(null);
  const rasterSize = worldRasterSizeFor(width, height);

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
    }, getImpactDelay(latest.actionType));
    return () => clearTimeout(punch);
  }, [effects]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadCountryFeatures(), loadImage(worldRasterUrl(rasterSize))])
      .then(([land, image]) => { if (!cancelled) setGeo({ land, image }); })
      .catch(() => { if (!cancelled) setGeo({ land: [], image: null }); });
    return () => { cancelled = true; };
  }, [rasterSize]);

  // The globe's material carries the composited texture (politicalTexture.js). One canvas and one
  // CanvasTexture for the session; a change of ownership, war, occupation or selection repaints
  // the canvas on the next frame and flags the texture for upload.
  const material = useMemo(() => new MeshPhongMaterial({ color: 0xffffff }), []);
  const canvasRef = useRef(null);
  const textureRef = useRef(null);

  // Flies to the player's home turf on first load so the game opens somewhere meaningful instead
  // of wherever react-globe.gl's own default camera position happens to be.
  useEffect(() => {
    if (!geo || !globeRef.current) return;
    const home = REGION_COORDINATES[getNationCapital(state.playerNationId)];
    if (!home) return;
    globeRef.current.pointOfView({ lat: home.lat, lng: home.lng, altitude: 1.4 }, 0);
  }, [geo, state.playerNationId]);

  // Bug fix (plan feedback: "on army tab u see in map sweden and not the selected region"):
  // opening ProvinceModal ("Manage Region") never moved the camera at all, so whatever the globe
  // happened to be pointed at (wherever it last drifted to, e.g. from auto-rotate) stayed on
  // screen behind the modal — completely unrelated to the region actually being managed.
  // MapContainer.jsx passes `focusRegionId` = the region ProvinceModal is currently open for (null
  // otherwise), so this flies there the moment Manage Region opens, independent of which of its
  // tabs is active (switching tabs doesn't change `focusRegionId`, so it won't re-fire pointlessly).
  useEffect(() => {
    if (!focusRegionId || !globeRef.current) return;
    const target = REGION_COORDINATES[focusRegionId];
    if (!target) return;
    globeRef.current.pointOfView({ lat: target.lat, lng: target.lng, altitude: 1.0 }, 500);
  }, [focusRegionId]);

  // MiniMap.jsx's "click/drag to navigate" request — see Map2DView.jsx's own navigateTarget effect
  // for why this needs a freshly-created `{lat,lng}` object every time (so navigating to the same
  // spot twice in a row still re-fires). Keeps whatever altitude the player is already at rather
  // than resetting zoom, the same way a real map app's minimap-click only pans, never re-zooms.
  useEffect(() => {
    if (!navigateTarget || !globeRef.current) return;
    const current = globeRef.current.pointOfView();
    globeRef.current.pointOfView({ lat: navigateTarget.lat, lng: navigateTarget.lng, altitude: current?.altitude || 1.4 }, 500);
  }, [navigateTarget]);

  // Reports this view's own visible area so MiniMap.jsx can draw a real "you are here" rectangle —
  // see visibleHalfAngleDeg's own comment above for the shared contract and the approximation it's
  // built on. react-globe.gl/three's OrbitControls don't expose a clean "camera settled" event
  // worth wiring up just for this, so a light poll is simplest; 400ms is imperceptible for a small
  // corner indicator that only needs to be roughly current, not frame-accurate.
  useEffect(() => {
    if (!onViewportChange) return undefined;
    const interval = setInterval(() => {
      const pov = globeRef.current?.pointOfView?.();
      if (!pov) return;
      const halfDeg = visibleHalfAngleDeg(pov.altitude);
      onViewportChange({ centerLat: pov.lat, centerLng: pov.lng, halfWidthDeg: halfDeg, halfHeightDeg: halfDeg });
    }, 400);
    return () => clearInterval(interval);
  }, [onViewportChange]);

  // Auto-rotate is a nice "alive" default for a menu-screen-style globe, but it's motion a
  // reduced-motion user explicitly asked not to see, and it should stop as soon as they've
  // actually grabbed the globe (dragging while it spins fights the user's own input).
  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (!controls) return;
    controls.autoRotate = !userDismissedAutoRotate && !prefersReducedMotion() && !autoRotateDisabledForTests();
    controls.autoRotateSpeed = 0.4;
    const stopOnInteract = () => {
      controls.autoRotate = false;
      userDismissedAutoRotate = true;
    };
    controls.addEventListener('start', stopOnInteract);
    return () => controls.removeEventListener('start', stopOnInteract);
  }, [geo]);

  const atWarNationIds = useMemo(() => getAtWarNationIds(state.wars, state.playerNationId), [state.wars, state.playerNationId]);
  const fillFor = useCallback((cityId) => getRegionFillColor(state.regions, state.playerNationId, cityId), [state.regions, state.playerNationId]);

  // Repaints the political texture whenever what it shows changes: cheap enough (one canvas of
  // 240 territories) to run on the frame after any such change.
  const tileOwner = state.world?.tileOwner || null;
  useEffect(() => {
    if (!geo || window.__E2E_STATIC_GLOBE__ === true) return undefined;
    const frame = requestAnimationFrame(() => {
      if (!canvasRef.current) {
        const c = document.createElement('canvas');
        c.width = geo.image?.naturalWidth || rasterSize; c.height = geo.image?.naturalHeight || rasterSize / 2;
        canvasRef.current = c;
      }
      renderPoliticalCanvas({ canvas: canvasRef.current, baseImage: geo.image, state, fillFor, land: geo.land, warOwners: atWarNationIds, selected: selectedRegion, lens });
      if (!textureRef.current) {
        const t = new CanvasTexture(canvasRef.current);
        t.colorSpace = SRGBColorSpace;
        textureRef.current = t;
        material.map = t;
        material.needsUpdate = true;
      } else textureRef.current.needsUpdate = true;
    });
    return () => cancelAnimationFrame(frame);
    // A lens other than political also follows the units (threat, supply) and the wars (trade).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, tileOwner, state.regions, fillFor, atWarNationIds, selectedRegion, material, rasterSize, lens, lens !== 'political' ? state.units : null, lens !== 'political' ? state.wars : null]);

  // Far out (B5) only the player's own armies and battles show as markers. Checked on a light
  // poll: a threshold flip, not a per-frame value.
  const [farView, setFarView] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      const alt = globeRef.current?.pointOfView?.()?.altitude;
      if (alt != null) setFarView((prev) => (prev ? alt > FAR_VIEW_ALTITUDE * 0.9 : alt > FAR_VIEW_ALTITUDE));
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // Pick from the pointer ray rather than the library's cached hover object. On touch
  // and low frame rates that object can belong to an earlier pointer position or be null.
  // The province under a screen point (null off the globe).
  const regionAtClient = useCallback((clientX, clientY) => {
    const g=globeRef.current;
    if(!g)return null;
    const bounds=g.renderer().domElement.getBoundingClientRect();
    if(!bounds.width || !bounds.height)return null;
    const ray=new Raycaster();
    ray.setFromCamera(new Vector2((clientX-bounds.left)/bounds.width*2-1,-((clientY-bounds.top)/bounds.height)*2+1),g.camera());
    const point=ray.ray.intersectSphere(new Sphere(new Vector3(),g.getGlobeRadius()*1.002),new Vector3());
    if(!point)return null;
    const coords=g.toGeoCoords(point);
    return { coords, id: cityAtLatLon(state, coords.lat, coords.lng) };
  },[state]);

  const handlePointerPick = useCallback(event => {
    const hit=regionAtClient(event.clientX,event.clientY);
    if(!hit)return;
    const gameRegionId=hit.id;
    if(window.__E2E_MAP_TEST__)window.__mapLastClick={coords:hit.coords,gameRegionId};
    // A fingertip covers several small provinces: ask which one (plan §3, RegionChooser).
    if(event.pointerType==='touch' && onAmbiguousTap){
      const ids=tapCandidates(tapRingPoints(event.clientX,event.clientY).map(([x,y])=>regionAtClient(x,y)?.id));
      if(ids.length>1){onAmbiguousTap({x:event.clientX,y:event.clientY,ids});return;}
    }
    if(gameRegionId)onSelectRegion(gameRegionId===selectedRegion?null:gameRegionId);
    else if(onSelectTile){const tile=tileAtLatLon(hit.coords.lat,hit.coords.lng);onSelectTile(tile!=null&&tile>=0?tile:null);}
  },[regionAtClient,selectedRegion,onSelectRegion,onAmbiguousTap,onSelectTile]);

  useEffect(()=>{
    const canvas=globeRef.current?.renderer().domElement;
    if(!canvas || !geo)return undefined;
    let start=null;
    const pointers=new Set();
    const down=e=>{
      pointers.add(e.pointerId);
      start=pointers.size===1 && e.button===0 ? {id:e.pointerId,x:e.clientX,y:e.clientY}:null;
    };
    const up=e=>{
      pointers.delete(e.pointerId);
      const tap=start;start=null;
      if(tap?.id===e.pointerId && Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<=6)handlePointerPick(e);
    };
    const cancel=e=>{pointers.delete(e.pointerId);start=null;};
    canvas.addEventListener('pointerdown',down);
    canvas.addEventListener('pointerup',up,true);
    canvas.addEventListener('pointercancel',cancel);
    return ()=>{
      canvas.removeEventListener('pointerdown',down);
      canvas.removeEventListener('pointerup',up,true);
      canvas.removeEventListener('pointercancel',cancel);
    };
  },[geo,handlePointerPick]);

  // Armies, fleets and battles on the globe (plan §4b): the same banners as the flat map, as DOM
  // elements react-globe.gl keeps over each province and hides on the far side. Far out only your
  // own armies and battles show. The element factory is stable (it reads the latest handlers and
  // war set through a ref), because a new one would make the globe rebuild every banner.
  const markers = useMemo(() => getMapMarkers(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.units, state.regions, state.nations, state.intel, state.battleReports, state.turnNumber, state.playerNationId]);
  // Camera altitude in steps of x1.4, so clusters regroup only when the zoom really changed.
  const [altStep, setAltStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const alt = globeRef.current?.pointOfView?.()?.altitude;
      if (alt > 0) setAltStep(Math.round(Math.log(alt) / Math.log(1.4)));
    }, 300);
    return () => clearInterval(interval);
  }, []);
  const markerData = useMemo(() => clusterGlobeItems(markerItems(markers, !farView)
    .map((m) => ({ ...m, ...(markerLatLng(m) || {}) }))
    .filter((m) => m.lat != null), 3 * 1.4 ** altStep), [markers, farView, altStep]);
  const markerCtx = useRef({});
  markerCtx.current = { onSelectRegion, onSelectArmy, atWarNationIds, state };
  const markerElement = useCallback((item) => createMarkerElement(item, markerCtx.current.atWarNationIds.has(item.ownerId), (it) => {
    if (it.kind === 'cluster') {
      const pov = globeRef.current?.pointOfView?.();
      globeRef.current?.pointOfView({ lat: it.lat, lng: it.lng, altitude: Math.max(0.12, (pov?.altitude || 1) / 2.5) }, 500);
    } else if (it.kind === 'battle') openBattleReport(it.id);
    else if (it.own && it.kind === 'army' && it.tile != null && markerCtx.current.onSelectArmy && markerCtx.current.state.regions[markerCtx.current.state.world?.tileOwner?.[it.tile]]?.tile !== it.tile) markerCtx.current.onSelectArmy(it.tile); // your army in the field: its sheet (a garrison on its city tile belongs to the city card)
    else markerCtx.current.onSelectRegion(it.regionId);
  }), []);
  const markerVisibility = useCallback((el, visible) => { el.style.display = visible ? '' : 'none'; }, []);


  useEffect(() => {
    if(window.__E2E_MAP_TEST__ !== true || !globeRef.current || !geo)return undefined;
    window.__mapTest={
      features:getCityFeatures(state,geo.land).map((f)=>({...f,properties:{...f.properties,owner:state.regions[f.properties.gameRegionId]?.owner||null}})),
      selected:selectedRegion,
      focus:(lat,lng,altitude)=>{const g=globeRef.current;g.controls().autoRotate=false;g.pointOfView({lat,lng,altitude},0);g.controls().update();g.camera().updateMatrixWorld();},
      project:(lat,lng)=>globeRef.current.getScreenCoords(lat,lng,0.002)
    };
    return ()=>{delete window.__mapTest;};
  },[geo,selectedRegion,state]);

  if (!geo) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
        Loading world map…
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* RegionInfoModal/MapLegend now live one level up, in MapContainer.jsx, so they overlay
          whichever main view (this globe, or the flat 2D map) is currently active rather than
          being duplicated inside each renderer. */}
      {/* The globe and its effects overlay share one wrapper so the impact shake moves them
          together — shaking the canvas alone would slide the map out from under the animation.
          The panel chrome (legend, region card) deliberately sits outside it and stays still. */}
      {/* Plan §5.1: shifted so the globe's centre — where every camera move (Manage Region focus,
          effect framing, minimap navigation) puts its target — sits in the middle of the part of
          the screen NOT covered by panels (MapInsetsContext), instead of under a bottom sheet.
          A CSS transform rather than resizing the canvas: no three.js reflow as sheets move, and
          pointer events/getScreenCoords stay consistent because the overlay moves with it. */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${(insets.left - insets.right) / 2}px, ${(insets.top - insets.bottom) / 2}px)`,
          transition: 'transform 280ms ease'
        }}
      >
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
        globeMaterial={material}
        htmlElementsData={markerData}
        htmlElement={markerElement}
        htmlElementVisibilityModifier={markerVisibility}
        htmlAltitude={0.004}
        htmlTransitionDuration={0}
      />
      {!prefersReducedMotion() && (
        <GlobeEffectsOverlay globeRef={globeRef} width={width} height={height} effects={effects} ageId={state.age} />
      )}
      </div>
      </div>
    </div>
  );
};

export default GlobeView;
