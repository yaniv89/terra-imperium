// src/components/map/gl/GLMapView.jsx
// The flat map in one WebGL canvas with one camera (plans/MASTER-PLAN.md 5.4, decisions 28 and
// 29; plans/rts-world-review.md 6.5): the realistic Earth, territories, borders, the hex overlay,
// roads, glyphs, the fog, city badges and banners, army and battle markers, the lens layer and the
// close view's 3D towns, armies and trees, all in the same scene. The world wraps east to west.
// Same props and behaviour as the SVG map it replaces (Map2DView.jsx, kept behind a setting for
// one release): pan, pinch and wheel zoom through d3-zoom, a tap picks a marker, a city, a
// settler, a territory or a tile; the zoom buttons; the minimap's viewport; focus on effects and
// on the managed region.
// Panning only changes the view uniforms and draws one frame (no React render, no rebuild):
// badges, markers and glyphs are rebuilt once the zoom settles (ZOOM_SETTLE_MS), the close view's
// models are laid out once per settled view over a margin round the screen and moved with the
// camera between layouts. Frames are drawn on demand; only marching soldiers and the banners
// gliding between tiles after a move (marchGlide.js, I070) animate.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoEquirectangular } from 'd3-geo';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import 'd3-transition';
import MapZoomControls from '../MapZoomControls';
import { WebGLRenderer, Scene, OrthographicCamera, Group } from 'three';
import { useGame } from '../../../context/GameContext';
import { useEffects } from '../../../context/EffectsContext';
import { useMapInsets } from '../../../context/MapInsetsContext';
import { useLayoutMode } from '../../../hooks/useLayoutMode';
import { loadLandFeatures } from '../../../data/geo/loadWorldFeatures';
import { getCityFeatures, tileAtLatLon } from '../../../data/geo/cityFeatures';
import { getTiles } from '../../../data/geo/tiles';
import { worldRasterUrl, worldRasterSizeFor } from '../../../data/geo/worldRaster';
import { baseRasterZoom } from '../../../data/geo/rasterTiles';
import { proceduralRaster, worldPicture } from '../../../data/geo/worldPictures';
import { createProceduralSource } from './proceduralPaint';
import { getMapMarkers } from '../../../utils/mapMarkers';
import { getAtWarNationIds } from '../../../utils/mapRegionStyle';
import { tapCandidates, tapRingPoints } from '../../../utils/regionClickAssist';
import { getEffectPeekDuration } from '../../../hooks/useAutoPeek';
import { RIG_TIME } from '../../../battle/render/soldierFactory';
import EffectsLayer from '../../../effects/EffectsLayer';
import { clamp } from '../../../effects/engine';
import { openBattleReport } from '../../battle/battleReportEvents';
import { useMarch } from '../MarchContext';
import { fogView } from '../fogView';
import { loadGroundData } from '../closeView/groundBlend';
import { createCloseScene, closeTowns } from '../closeView/closeViewScene';
import { settlerModelled } from '../closeView/settlerModels';
import { tileGpuData } from './tileGpuData';
import { buildFogField } from './fogField';
import { indexCities, buildFogStates, buildTileTexels, buildCityTexels, buildTintTexels } from './territoryData';
import { createTerritoryLayer, createTerritoryCache, createRasterLayer, createSpriteLayer, createLineLayer } from './glLayers';
import { createRiverLayer } from './riverLayer';
import { riverStrips, riverBandAt, riverRankCap, RIVER_BANDS } from './riverModel';
import { loadRiverLines } from '../../../data/geo/riverLines';
import { createAtlas } from './spriteAtlas';
import { onImageLoad } from './spriteArt';
import { viewFor, worldRect, wrapNear, screenToWorld, worldToScreen, minZoomFor, pickHit, focusZoomFor, carryTransform, isSaneTransform, startZoomFor, wheelZoomDelta, maxZoomFor, flingVelocity, FLING_DECAY, FLING_MIN_SPEED } from './mapView';
import { kmPerRing } from '../../../data/geo/gridScale';
import { cleanLatLng, latLngOfCity, knownLatLngOfCity, cameraTarget, cameraKey, rememberCamera, recallCamera, createIntentGate, INTENT_SETTLE_MS } from '../mapCamera';
import {
  citySprites, nearView, markerSprites, landSprites, groundMarks, settlerSprites, marchShapes, lensShapes, terrainSprites, tileOutline,
  HEX_FROM_ZOOM, CITY_DETAIL_ZOOM, CLOSE_ZOOM_K
} from './sceneModel';
import { raidShapes } from './raidShapes';
import { declutterLabels, avoidHud } from './declutter';
import { settlerLines } from '../settleRoutes';
import { raidMapModel } from '../../independents/raidMapModel';
import { openIndependent } from '../../independents/independentEvents';
import { planGlides, glideAt, afterTurnReport } from '../marchGlide';
import { TURN_REPORT_SHOWN, isTurnReportShown } from '../../ui/uiEvents';
import { POINT_TILE } from '../marchEvents';
import { releaseWhenDetached } from '../../../utils/glContext';
import { forgetReleasedGltf } from '../../../battle/render/gltfUnitLoader';
import { watchPixelRatio } from '../../../utils/pixelRatio';
import { noteCrashEvent } from '../../../utils/crashLog';
import { ageOf } from '../../../engine/nationState';

// the source event of a fling's own steps (a pan let go still gliding: mapView.flingVelocity)
const FLING_STEP = { type: 'fling' };
const REDUCED_MOTION = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const OCEAN_COLOR = '#0f172a';
const ZOOM_CAP = 200; // the closest zoom is also limited to a few hexes across the screen (maxZoomFor)
const ZOOM_STEP_SCALE = 1.6;
const ZOOM_SETTLE_MS = 150;
const ZOOM_JUMP = 1.8;
const MAX_VIA = 6; // way points kept from a drawn march path (U38)
const INITIAL_FOCUS_ZOOM = 5;
// The first view of a game: this much ground (km) over the screen's height, centred on the capital
// (its land fills about half the screen, the town model shows: plans/ui/start-zoom).
const START_VIEW_KM = 650;
// The close view's models are laid out over the screen plus this share of it on every side.
const CLOSE_MARGIN = 0.35;
// How long a tile pointed at from a sheet stays outlined (I042).
const POINT_MS = 8000;
// How long a lost WebGL context may take to come back before the map makes a new canvas.
const CONTEXT_RESTORE_MS = 3000;
const linearViewInterpolate = (a, b) => (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hudToScreenOf = (settledView) => (a) => (settledView ? worldToScreen(settledView, a[0], a[1]) : null);
const devicePixelRatio = () => Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Whether this browser can run the WebGL map (WebGL2 with float textures). */
export const canRunGLMap = () => {
  try {
    const c = document.createElement('canvas').getContext('webgl2');
    return !!c;
  } catch { return false; }
};

const GLMapView = ({
  onAmbiguousTap = null, width, height, selectedRegion, onSelectRegion, hudOffset = false,
  initialFocusRegionId = null, focusRegionId = null, navigateTarget = null, onViewportChange = null, selectedTile = null, onSelectTile = null,
  onSelectArmy = null, selectedArmy = null, selectedUnit = null, lens = 'political', onFail = null, settle = null
}) => {
  const { state: gameState } = useGame();
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const camKey = cameraKey(gameState);
  const fog = useMemo(() => fogView(gameState), [gameState]);
  const state = fog.state;
  // The settle mode (settleMode.js, MapContainer): `settle` is { tile, sites } for its settler and
  // the lens is then 'settle' whatever the player had on; the tints are drawn round that settler
  // and stay while other tiles are tapped and their sheet is closed (playtest audit I084, I086).
  const settlerTile = settle?.tile ?? null;
  const settleSiteList = settle?.sites;
  // 2: the settle view (stronger at the strategic zoom, blocked land hatched: territoryShader.js)
  const tintOn = lens === 'settle' ? 2 : lens === 'supply' ? 1 : 0;
  const { effects } = useEffects();
  const rawInsets = useMapInsets();
  const insets = hudOffset ? rawInsets : { top: 0, bottom: 0, left: 0, right: 0, start: 0, end: 0 };
  const layoutMode = useLayoutMode();
  const marchCtx = useMarch();
  const marchLines = marchCtx?.lines;
  // a march's target is being picked (the taps below read it)
  const marchingRef = useRef(false);
  marchingRef.current = !!marchCtx?.march && !marchCtx.march.dragging;
  // U38: Path mode: a one-finger drag draws the army's route instead of panning the map.
  const pathModeRef = useRef(false);
  pathModeRef.current = !!marchCtx?.march?.pathMode;
  const setPathRef = useRef(null);
  setPathRef.current = marchCtx?.setPath;
  const [trail, setTrail] = useState(null);
  const trailRef = useRef(null);
  const settleRef = useRef(false);
  settleRef.current = !!settle;

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const gl = useRef(null); // the renderer, scenes and layers
  const transformRef = useRef(zoomIdentity);
  const zoomBehaviorRef = useRef(null);
  const appliedInitialFocusRef = useRef(false);
  const [settled, setSettled] = useState(() => ({ k: 1, x: 0, y: 0, n: 0 }));
  // 0 until the renderer is made, then a count that goes up each time it is (re)made: the effects
  // that fill its layers depend on it, so a renderer rebuilt after a lost context is filled again.
  const [ready, setReady] = useState(0);
  // A new canvas (and renderer) when a lost WebGL context does not come back (canvasGen).
  const [canvasGen, setCanvasGen] = useState(0);
  const [assetsTick, setAssetsTick] = useState(0);
  // a browser zoom or another screen changes the pixel ratio without a resize: draw again at it
  const [, setDprTick] = useState(0);
  useEffect(() => watchPixelRatio(() => setDprTick((n) => n + 1)), []);
  const dpr = devicePixelRatio();

  const projection = useMemo(() => (width > 0 && height > 0 ? geoEquirectangular().fitSize([width, height], { type: 'Sphere' }) : null), [width, height]);
  const ZOOM_MAX = projection ? maxZoomFor({ width, scale: projection.scale(), hexKm: kmPerRing(), cap: ZOOM_CAP }) : ZOOM_CAP;
  const raster = useMemo(() => (projection ? worldRect(projection) : null), [projection]);
  const minK = raster ? minZoomFor(width, raster) : 1;
  const view = useCallback(() => (projection ? viewFor({ transform: transformRef.current, width, height, dpr, projection, raster }) : null), [projection, raster, width, height, dpr]);

  // ---------------------------------------------------------------- the renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let renderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 is needed');
    } catch (e) {
      console.warn('The WebGL map is not available here, using the SVG map:', e.message);
      renderer?.dispose();
      onFail?.();
      return undefined;
    }
    renderer.setClearColor(OCEAN_COLOR, 1);
    renderer.info.autoReset = false;
    // drawn in this order: the Earth, the terrain (the river lines, mountain chains, passes:
    // under the fog),
    // the territories (cached while panning), lines and ground sprites, the close view's models,
    // the badges, banners and markers
    const ground = new Scene(); const terrain = new Scene(); const base = new Scene(); const close = new Scene(); const top = new Scene();
    const closeRoot = new Group();
    close.add(closeRoot);
    const camera = new OrthographicCamera(0, 1, 0, -1, -1, 1);
    const atlas = createAtlas();
    const g = {
      renderer, camera, ground, terrain, base, close, top, closeRoot, atlas, raf: 0, dirty: true, closeActive: false, closeLayout: null,
      groups: {}, hits: [], frames: 0
    };
    g.frame = () => { g.raf = 0; };
    g.request = () => { if (!g.raf && !g.disposed) g.raf = requestAnimationFrame((now) => g.frame(now)); };
    // a generated world paints its close levels on the GPU (proceduralPaint.js); Earth downloads them
    const source = proceduralRaster() ? createProceduralSource(renderer, getTiles(), { seed: getTiles().world?.seed || 0 }) : null;
    g.raster = createRasterLayer(ground, { request: g.request, onReady: () => g.request(), source });
    g.territory = createTerritoryLayer(new Scene(), tileGpuData(getTiles()));
    g.territoryCache = createTerritoryCache(g.territory);
    g.rivers = createRiverLayer(terrain, 1);
    g.terrainSprites = createSpriteLayer(terrain, atlas, 6);
    g.lowLines = createLineLayer(base, 20);
    g.groundSprites = createSpriteLayer(base, atlas, 30);
    g.marchLines = createLineLayer(base, 40);
    g.upperSprites = createSpriteLayer(base, atlas, 45);
    g.topSprites = createSpriteLayer(top, atlas, 50);
    // the armies', fleets' and battles' banners: a layer of their own, so a glide moves only them
    g.markerLayer = createSpriteLayer(top, atlas, 55);
    g.closeScene = createCloseScene(close, closeRoot, { onAssets: () => setAssetsTick((n) => n + 1) });
    gl.current = g;
    // A phone may drop the map's WebGL context while the battle's renderer runs (or the app sits in
    // the background): three.js rebuilds it on restore, the map has to draw again (and its cached
    // territory picture is gone). A context that does not come back within CONTEXT_RESTORE_MS is
    // replaced: a new canvas and renderer (canvasGen), never a black map (three.js uploads the
    // models' textures again from their CPU copies).
    const redraw = () => { g.territoryCache.invalidate(); g.request(); };
    const onVisible = () => { if (document.visibilityState === 'visible') redraw(); };
    let lostTimer = 0;
    const onLost = (e) => {
      e.preventDefault();
      noteCrashEvent('map-context-lost');
      clearTimeout(lostTimer);
      lostTimer = setTimeout(() => { noteCrashEvent('map-context-replaced'); forgetReleasedGltf(); setCanvasGen((n) => n + 1); }, CONTEXT_RESTORE_MS);
    };
    // (the model files whose maps kept no CPU copy load again in full: forgetReleasedGltf, and the
    // close view drops what it built on them, else they come back as blurred stand-ins)
    const onRestored = () => { clearTimeout(lostTimer); noteCrashEvent('map-context-restored'); forgetReleasedGltf(); g.closeScene.reloadReleased(); setAssetsTick((n) => n + 1); redraw(); };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    document.addEventListener('visibilitychange', onVisible);
    if (import.meta.env.DEV) window.__closeView = Object.assign(g.closeScene.state, { renderer });
    setReady((n) => n + 1);
    return () => {
      clearTimeout(lostTimer);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      document.removeEventListener('visibilitychange', onVisible);
      g.disposed = true;
      cancelAnimationFrame(g.raf);
      [g.raster, g.territory, g.rivers, g.terrainSprites, g.lowLines, g.groundSprites, g.marchLines, g.upperSprites, g.topSprites, g.markerLayer, g.closeScene, g.territoryCache].forEach((l) => l.dispose());
      renderer.dispose();
      releaseWhenDetached(canvas); // the canvas left the page (or was replaced): its context goes now
      gl.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasGen]);

  // ---------------------------------------------------------------- one frame
  // Reads the live transform (a ref), so panning draws without React.
  const settings = useRef({});
  const worldSize = worldPicture()?.size || worldRasterSizeFor(width, height); // a generated world has one painted size
  settings.current = { selectedTile, lens, tintOn, fogOn: fog.on, worldUrl: worldRasterUrl(worldSize), worldSize, baseZ: baseRasterZoom(worldSize) };
  // One frame of the banners' glide (marchGlide.js, I070): the gliding banners at their place on
  // the way and, in the close view, their soldiers with them. False once every glide has arrived
  // (the banners then stand where the engine put them, as placed).
  const stepGlide = useCallback((g, now, k) => {
    const gd = g.glide;
    if (gd.release && gd.start == null) gd.start = now; // (the clock starts on the first frame after the release, not at the event)
    const ms = gd.start == null ? 0 : now - gd.start; // (held: the banners stand on their old tiles)
    const at = new Map();
    gd.plan.forEach((p, key) => { const q = glideAt(p, ms); if (!q.done) at.set(key, q); });
    const live = at.size > 0;
    const placed = g.markerPlaced || [];
    g.markerShown = !live ? placed : placed.map((s) => {
      const q = s.glideKey ? at.get(s.glideKey) : null;
      const xy = q && projection ? projection([q.lng, q.lat]) : null;
      return xy ? { ...s, anchor: xy } : s;
    });
    g.markerLayer.set(g.markerShown);
    if (g.closeLayout && k >= CLOSE_ZOOM_K) {
      const move = (list, kind) => (list || []).map((m) => { const q = at.get(`${kind}:${m.id}`); return q ? { ...m, at: { lat: q.lat, lng: q.lng }, toward: q.toward } : m; });
      g.closeScene.moveArmies({ ...gd.markers, armies: move(gd.markers.armies, 'army'), fleets: move(gd.markers.fleets, 'fleet') });
    }
    if (!live) g.glide = null;
    return live && gd.start != null;
  }, [projection]);
  const frame = useCallback((now) => {
    const g = gl.current;
    if (!g) return;
    g.raf = 0;
    const v = view();
    if (!v) return;
    const s = settings.current;
    const { renderer, camera } = g;
    renderer.info.reset();
    g.raster.update(v, { closeK: CLOSE_ZOOM_K, baseZ: s.baseZ, worldUrl: s.worldUrl, worldSize: s.worldSize });
    const territoryOpts = {
      uHex: v.k >= HEX_FROM_ZOOM ? 1 : 0, uCityDetail: v.k >= CITY_DETAIL_ZOOM ? 1 : 0, uNationHalf: v.k < 3 ? 0.55 : 0.45,
      uSelTile: s.selectedTile ?? -1, uTintOn: s.tintOn || 0, uFogOn: s.fogOn ? 1 : 0
    };
    [g.rivers, g.terrainSprites, g.lowLines, g.groundSprites, g.marchLines, g.upperSprites, g.topSprites, g.markerLayer].forEach((l) => l.update(v));
    const gliding = g.glide ? stepGlide(g, now ?? performance.now(), v.k) : false;
    // the world camera (the raster quads and the close view's models)
    camera.left = v.worldLeft; camera.right = v.worldLeft + width / v.k;
    camera.top = -v.worldTop; camera.bottom = -(v.worldTop + height / v.k);
    const lay = g.closeLayout;
    const depth = 8000 / Math.min(v.k, lay?.k || v.k);
    camera.near = -depth; camera.far = depth;
    camera.updateProjectionMatrix();
    // (the autoClear also clears the depth buffer, which the river lines then use for their
    // overlaps: riverLayer.js; nothing on the ground writes depth)
    renderer.autoClear = true;
    renderer.render(g.ground, camera);
    renderer.autoClear = false;
    renderer.render(g.terrain, camera);
    // the territories: one texture while panning, the live shader while a zoom is under way
    g.lastTerritory = g.territoryCache.draw(renderer, camera, v, territoryOpts, v.k === settledRef.current.k);
    renderer.render(g.base, camera);
    g.closeActive = v.k >= CLOSE_ZOOM_K && !!lay;
    if (g.closeActive) {
      // the models were laid out in screen pixels of the layout's view: back to world units, at
      // the copy of the world nearest the view
      const shift = wrapNear(lay.camX, v.camX, v.worldW) - lay.camX;
      g.closeRoot.position.set(-lay.tx / lay.k + shift, lay.ty / lay.k, 0);
      g.closeRoot.scale.setScalar(1 / lay.k);
      RIG_TIME.value = (now ?? performance.now()) / 1000;
      renderer.clearDepth();
      renderer.render(g.close, camera);
    }
    renderer.render(g.top, camera);
    g.frames += 1;
    if (gliding || (g.closeActive && g.closeScene.moving())) g.request();
  }, [view, width, height, stepGlide]);
  useEffect(() => { if (gl.current) { gl.current.frame = frame; gl.current.request(); } }, [frame, ready]);
  useEffect(() => {
    const g = gl.current;
    if (!g || width <= 0 || height <= 0) return;
    g.renderer.setPixelRatio(dpr);
    g.renderer.setSize(width, height, false);
    g.request();
  }, [ready, width, height, dpr]);

  // ---------------------------------------------------------------- pan and zoom (d3-zoom)
  const settleTimer = useRef(0);
  const settledRef = useRef(settled);
  settledRef.current = settled;
  const onZoom = useCallback((t) => {
    transformRef.current = t;
    gl.current?.request();
    clearTimeout(settleTimer.current);
    const prevK = settledRef.current.k;
    const ratio = t.k / prevK;
    const settleNow = () => setSettled({ k: t.k, x: t.x, y: t.y, n: Date.now() });
    if (ratio > ZOOM_JUMP || ratio < 1 / ZOOM_JUMP) settleNow();
    else settleTimer.current = setTimeout(settleNow, ZOOM_SETTLE_MS);
  }, []);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // The screen size the current transform was made for: a resize rescales the world (fitSize), so
  // the view is carried over to keep the same place at the centre (carryTransform).
  const geomRef = useRef(null);
  const fling = useRef({ raf: 0, samples: [], k: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !ready || width <= 0 || height <= 0 || !projection) return undefined;
    const prev = geomRef.current;
    if (prev && prev.projection !== projection) {
      select(el).interrupt(); // a fly-to under way was aimed in the old world units
      const carried = carryTransform({ transform: transformRef.current, from: prev, to: { projection, width, height }, minK, maxK: ZOOM_MAX });
      if (carried) transformRef.current = zoomIdentity.translate(carried.x, carried.y).scale(carried.k);
    }
    geomRef.current = { projection, width, height };
    if (!isSaneTransform(transformRef.current)) transformRef.current = zoomIdentity.scale(minK);
    const behavior = d3zoom()
      .interpolate(linearViewInterpolate)
      .scaleExtent([minK, ZOOM_MAX])
      .filter((e) => (!e.ctrlKey || e.type === 'wheel') && !e.button && !(pathModeRef.current && e.type !== 'wheel'))
      // one wheel event is one small step (mapView.wheelZoomDelta, playtest audit I075)
      .wheelDelta(wheelZoomDelta)
      // east and west are free (the world wraps), north and south stop at the poles
      .translateExtent([[-Infinity, 0], [Infinity, height]])
      .on('start', (event) => {
        // a finger down, a wheel or a fly-to stops a glide under way (the glide's own steps carry no event)
        if (fling.current.raf && event.sourceEvent !== FLING_STEP) { cancelAnimationFrame(fling.current.raf); fling.current.raf = 0; }
        fling.current.samples = []; fling.current.k = event.transform.k;
      })
      .on('zoom', (event) => {
        onZoom(event.transform);
        const src = event.sourceEvent;
        // a one-finger (or mouse) drag at one zoom: its last positions, for the fling on release
        if (src && /move$/.test(src.type) && !(src.touches?.length > 1) && event.transform.k === fling.current.k) {
          const pt = src.touches?.[0] ?? src;
          fling.current.samples.push({ t: performance.now(), x: pt.clientX, y: pt.clientY });
          if (fling.current.samples.length > 12) fling.current.samples.shift();
        } else if (src) fling.current.samples = [];
      })
      .on('end', (event) => {
        const v = event.sourceEvent && !REDUCED_MOTION() ? flingVelocity(fling.current.samples, performance.now()) : null;
        fling.current.samples = [];
        if (!v) return;
        let { vx, vy } = v; let last = performance.now();
        const step = (now) => {
          const dt = Math.min(48, now - last); last = now;
          const k = transformRef.current.k;
          selection.call(behavior.translateBy, (vx * dt) / k, (vy * dt) / k, FLING_STEP);
          const f = FLING_DECAY ** dt; vx *= f; vy *= f;
          fling.current.raf = Math.hypot(vx, vy) * 4 > FLING_MIN_SPEED ? requestAnimationFrame(step) : 0;
        };
        fling.current.raf = requestAnimationFrame(step);
      });
    zoomBehaviorRef.current = behavior;
    const selection = select(el);
    selection.call(behavior);
    // keep the current view (a resize rebuilds the behaviour)
    selection.call(behavior.transform, transformRef.current.k < minK ? zoomIdentity.scale(minK) : transformRef.current);
    const glide = fling.current;
    return () => { selection.on('.zoom', null); cancelAnimationFrame(glide.raf); glide.raf = 0; };
  }, [ready, width, height, minK, onZoom, projection, ZOOM_MAX]);

  // The free part of the screen is read when the camera moves, through a ref: a sheet that opens or
  // closes changes the insets but must not rebuild the fly-to callbacks, or every effect that
  // depends on them would fly to its last target again (playtest audit I072).
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  // Never to an undefined, NaN or off-world point: a bad target leaves the camera where it is.
  // `useInsets` false centres on the whole screen (a remembered camera), not the part the HUD leaves.
  const focusOnLatLng = useCallback((lat, lng, k = INITIAL_FOCUS_ZOOM, animate = false, useInsets = true) => {
    if (!projection || !zoomBehaviorRef.current || !containerRef.current) return false;
    const ll = cleanLatLng({ lat, lng });
    if (!ll || !Number.isFinite(k) || k <= 0) return false;
    const kk = Math.min(ZOOM_MAX, Math.max(minK, k));
    const p = projection([ll.lng, ll.lat]);
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return false;
    const v = view();
    const t = transformRef.current;
    const px = v && isSaneTransform(t) ? wrapNear(p[0], (width / 2 - t.x) / t.k, v.worldW) : p[0];
    const now = insetsRef.current;
    const ins = useInsets ? { left: now.left, right: now.right, top: now.top, bottom: now.bottom } : { left: 0, right: 0, top: 0, bottom: 0 };
    // the middle of the part of the screen the HUD leaves, unless the HUD covers nearly all of it
    const freeW = width - ins.left - ins.right; const freeH = height - ins.top - ins.bottom;
    const vcx = freeW > 40 ? ins.left + freeW / 2 : width / 2;
    const vcy = freeH > 40 ? ins.top + freeH / 2 : height / 2;
    const desired = zoomIdentity.translate(vcx - px * kk, vcy - p[1] * kk).scale(kk);
    if (!isSaneTransform(desired)) return false;
    const selection = select(containerRef.current);
    (animate ? selection.transition().duration(450) : selection).call(zoomBehaviorRef.current.transform, desired);
    return true;
  }, [projection, view, width, height, minK, ZOOM_MAX]);

  // The first view: where this game's map was before it was unmounted (its box had no size, the
  // globe was shown), else close on the capital (startZoomFor), else the selected army; never a
  // default corner of the world. Again for another game on the same map (a new game, a load).
  const initialKeyRef = useRef(null);
  useEffect(() => {
    if (initialKeyRef.current !== camKey) { initialKeyRef.current = camKey; appliedInitialFocusRef.current = false; }
    if (appliedInitialFocusRef.current || !ready || !projection) return;
    const mem = recallCamera(camKey);
    if (mem && focusOnLatLng(mem.lat, mem.lng, mem.scaleK / projection.scale(), false, false)) { appliedInitialFocusRef.current = true; return; }
    const t = cameraTarget(gameStateRef.current, [{ regionId: initialFocusRegionId }], { selectedArmyTile: selectedArmy });
    const k = startZoomFor({ height, scale: projection.scale(), viewKm: START_VIEW_KM, minK: CLOSE_ZOOM_K * 1.05, maxK: ZOOM_MAX }) ?? INITIAL_FOCUS_ZOOM;
    if (t && focusOnLatLng(t.lat, t.lng, k)) appliedInitialFocusRef.current = true;
  }, [initialFocusRegionId, focusOnLatLng, ready, projection, camKey, selectedArmy, height, ZOOM_MAX]);

  // A new action effect: pan to it (keeping a deeper zoom) and keep it centred while it plays.
  const lastEffectIdRef = useRef(effects.length ? effects[effects.length - 1].id : null);
  const followRef = useRef(null);
  useEffect(() => {
    const latest = effects[effects.length - 1];
    if (!latest || latest.id === lastEffectIdRef.current) return;
    lastEffectIdRef.current = latest.id;
    // (only to land the player has explored: an unseen capital is fog, playtest issue 8)
    const target = knownLatLngOfCity(gameStateRef.current, latest.toRegionId);
    if (!target) return;
    const k = Math.max(transformRef.current.k, INITIAL_FOCUS_ZOOM);
    followRef.current = { lat: target.lat, lng: target.lng, k, until: Date.now() + getEffectPeekDuration(latest.actionType) };
    focusOnLatLng(target.lat, target.lng, k, true);
  }, [effects, focusOnLatLng]);
  // Camera intents are applied ONCE each (mapCamera.createIntentGate): the managed or event city
  // when it changes, a fly-to target (`navigateTarget`, a fresh object per request) when it
  // arrives. A resize or a sheet that opens or closes rebuilds the callbacks below but is no new
  // intent, so the camera stays where the player left it (playtest audit I072). `lastFly` is the
  // last intent's own move, repeated only while the sheet that came with it is still opening (it
  // changes the insets a moment later: the place is then centred in the room that is left).
  const focusGate = useRef(null);
  const navGate = useRef(null);
  if (!focusGate.current) { focusGate.current = createIntentGate(); navGate.current = createIntentGate(); }
  const lastFly = useRef(null);
  const fly = useCallback((lat, lng, zoom) => { lastFly.current = { lat, lng, zoom, at: Date.now() }; return focusOnLatLng(lat, lng, zoom, true); }, [focusOnLatLng]);
  useEffect(() => {
    const follow = followRef.current;
    if (follow && Date.now() < follow.until) { focusOnLatLng(follow.lat, follow.lng, follow.k, true); return; }
    if (!focusRegionId) { focusGate.current.clear(); return; }
    if (!focusGate.current.take(focusRegionId)) return;
    // keep the player's zoom (a phone sits in the close view): only pan, or zoom in to the city
    const c = knownLatLngOfCity(gameStateRef.current, focusRegionId);
    if (c) fly(c.lat, c.lng, focusZoomFor(transformRef.current.k, INITIAL_FOCUS_ZOOM, ZOOM_MAX));
  }, [focusRegionId, fly, focusOnLatLng, ZOOM_MAX]);
  useEffect(() => {
    if (!navGate.current.take(navigateTarget)) return;
    // a target may ask for a closer zoom of its own (`minK`: at least this close)
    fly(navigateTarget.lat, navigateTarget.lng, Math.max(transformRef.current.k, navigateTarget.minK || INITIAL_FOCUS_ZOOM));
  }, [navigateTarget, fly]);
  useEffect(() => {
    const f = lastFly.current;
    if (f && Date.now() - f.at <= INTENT_SETTLE_MS) focusOnLatLng(f.lat, f.lng, f.zoom, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insets.left, insets.right, insets.top, insets.bottom]);

  // What a march aims at is never left under its bar (playtest audit I083): once the bar shows the
  // plan, a target under it (or just below it) is panned down into the free map, the zoom kept.
  const marchTarget = marchCtx?.march && !marchCtx.march.dragging ? marchCtx.march.target ?? null : null;
  useEffect(() => {
    if (marchTarget == null || !hudOffset || !projection) return undefined;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const el = containerRef.current; const v = view();
        const bar = document.querySelector('[data-testid="march-bar"]');
        if (!el || !v || !bar || !zoomBehaviorRef.current) return;
        const ll = typeof marchTarget === 'number'
          ? (() => { const p = getTiles().latLonOf(marchTarget); return p ? { lat: p.lat, lng: p.lon } : null; })()
          : latLngOfCity(gameStateRef.current, marchTarget);
        const w = ll && projection([ll.lng, ll.lat]);
        if (!w) return;
        const [sx, sy] = worldToScreen(v, w[0], w[1]);
        const box = el.getBoundingClientRect(); const b = bar.getBoundingClientRect();
        const left = b.left - box.left - 24; const right = b.right - box.left + 24; const bottom = b.bottom - box.top + 28;
        if (sx < left || sx > right || sy > bottom || sy < -40) return;
        const dy = bottom + 24 - sy;
        select(el).transition().duration(300).call(zoomBehaviorRef.current.translateBy, 0, dy / transformRef.current.k);
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [marchTarget, hudOffset, projection, view]);

  // The minimap's "you are here" box, once the view settles.
  useEffect(() => {
    if (!onViewportChange || !projection) return;
    const v = view();
    const centre = projection.invert(screenToWorld(v, width / 2, height / 2));
    if (!centre) return;
    // remembered for a remount, once the first view is in place
    if (appliedInitialFocusRef.current) rememberCamera(camKey, { lat: centre[1], lng: centre[0], scaleK: projection.scale() * v.k });
    const degPerPx = 360 / (v.worldW * v.k);
    onViewportChange({ centerLng: centre[0], centerLat: centre[1], halfWidthDeg: (width / 2) * degPerPx, halfHeightDeg: (height / 2) * degPerPx });
  }, [settled, onViewportChange, projection, view, width, height, camKey]);

  // Home and the selected army (MAP-01), both through cameraTarget: the capital with no army given,
  // the army's tile only when it has one. Close enough to see the ground, never farther out than now.
  const goTo = useCallback((t) => {
    if (!t || !projection) return;
    const close = startZoomFor({ height, scale: projection.scale(), viewKm: START_VIEW_KM, minK: CLOSE_ZOOM_K * 1.05, maxK: ZOOM_MAX }) ?? INITIAL_FOCUS_ZOOM;
    focusOnLatLng(t.lat, t.lng, Math.max(close, Math.min(transformRef.current.k, ZOOM_MAX)), true);
  }, [projection, height, focusOnLatLng, ZOOM_MAX]);
  const homeTarget = cameraTarget(state, [], {});
  const armyTarget = selectedArmy != null ? cameraTarget(state, [], { selectedArmyTile: selectedArmy }) : null;
  const goHome = useCallback(() => goTo(cameraTarget(gameStateRef.current, [], {})), [goTo]);
  const goArmy = useCallback(() => { const t = cameraTarget(gameStateRef.current, [], { selectedArmyTile: selectedArmy }); if (t?.from === 'army') goTo(t); }, [goTo, selectedArmy]);
  const zoomBy = useCallback((factor) => { if (zoomBehaviorRef.current && containerRef.current) select(containerRef.current).transition().duration(200).call(zoomBehaviorRef.current.scaleBy, factor); }, []);
  const resetZoom = useCallback(() => { if (zoomBehaviorRef.current && containerRef.current) select(containerRef.current).transition().duration(200).call(zoomBehaviorRef.current.transform, zoomIdentity.scale(minK)); }, [minK]);

  // ---------------------------------------------------------------- territories (data textures)
  const atWar = useMemo(() => getAtWarNationIds(state.wars, state.playerNationId), [state.wars, state.playerNationId]);
  const cityIndex = useMemo(() => indexCities(state.regions), [state.regions]);
  const tileOwner = state.world?.tileOwner;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fogStates = useMemo(() => buildFogStates(getTiles().count, fog), [fog.on, fog.explored, fog.visible]);
  useEffect(() => {
    const g = gl.current;
    if (!g) return;
    g.territory.setTiles(buildTileTexels({ tileCount: getTiles().count, tileOwner, regions: state.regions, fog, index: cityIndex, fogStates }));
    g.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tileOwner, fogStates, cityIndex]);
  // The soft fog edge: baked when what is explored or in sight changes (fogField.js).
  useEffect(() => {
    const g = gl.current;
    if (!g || !fog.on) return;
    g.territory.setFog(buildFogField({ states: fogStates, lookup: tileGpuData(getTiles()).lookup }));
    g.request();
  }, [ready, fog.on, fogStates]);
  useEffect(() => {
    const g = gl.current;
    if (!g) return;
    g.territory.setCities(buildCityTexels({ regions: state.regions, index: cityIndex, playerNationId: state.playerNationId, selectedRegion, atWarNationIds: atWar, nations: state.nations }));
    g.request();
  }, [ready, state.regions, state.nations, cityIndex, state.playerNationId, selectedRegion, atWar]);
  const lensOut = useMemo(() => (projection ? lensShapes({ state, projection, k: settled.k, lens, dpr, settlerTile, sites: settleSiteList }) : null), [state, projection, settled.k, lens, dpr, settlerTile, settleSiteList]);
  useEffect(() => {
    const g = gl.current;
    if (!g) return;
    g.territory.setTints(buildTintTexels(getTiles().count, lensOut?.tints || []));
    g.request();
  }, [ready, lensOut]);
  useEffect(() => { gl.current?.request(); }, [selectedTile, lens, tintOn, fog.on]);

  // ---------------------------------------------------------------- sprites and lines
  const k = settled.k;
  const closeGround = k >= CLOSE_ZOOM_K;
  const markers = useMemo(() => getMapMarkers(gameState, { selected: selectedUnit }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedUnit, gameState.units, gameState.regions, gameState.nations, gameState.intel, gameState.battleReports, gameState.turnNumber, gameState.playerNationId]);
  // A stack that moved since the last markers glides there from its last tile (I070). Drawing
  // only; never with reduced motion. After End Turn the banners stand on their old tiles until the
  // turn report is closed (at once when no report opens), then glide. While they wait, the "last
  // drawn" state stays the one before the turn, so a further change plans from it.
  const glidePrev = useRef(null);
  const glideGate = useRef(null);
  useEffect(() => () => glideGate.current?.(), []);
  useEffect(() => {
    const prev = glidePrev.current;
    const now = gameStateRef.current;
    const g = gl.current;
    glideGate.current?.(); glideGate.current = null;
    if (g?.glide && g.glide.start == null && !g.glide.release) g.glide = null;
    if (!g || !prev || prefersReducedMotion()) { glidePrev.current = { markers, state: now }; return; }
    const plan = planGlides({ prevState: prev.state, nextState: now, prevMarkers: prev.markers, nextMarkers: markers });
    if (!plan.size) { glidePrev.current = { markers, state: now }; return; }
    glidePrev.current = { ...prev, markers: prev.markers, state: prev.state };
    g.glide = { start: null, plan, markers };
    g.request();
    glideGate.current = afterTurnReport({
      isShown: isTurnReportShown,
      listen: (fn) => { const h = (e) => fn(!!e.detail); window.addEventListener(TURN_REPORT_SHOWN, h); return () => window.removeEventListener(TURN_REPORT_SHOWN, h); },
      later: (fn, ms) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); }
    }, () => {
      glideGate.current = null;
      glidePrev.current = { markers, state: now };
      const live = gl.current;
      if (!live?.glide || live.glide.start != null) return;
      live.glide.release = true;
      live.request();
    });
  }, [markers]);
  const towns = useMemo(() => closeTowns(state), [state]);
  // the settled view: the cities' sprites are built round it
  const settledView = useMemo(() => (projection ? viewFor({ transform: { k: settled.k, x: settled.x, y: settled.y }, width, height, dpr, projection, raster }) : null), [projection, raster, settled, width, height, dpr]);
  const armyTiles = useMemo(() => new Set(markers.armies.filter((m) => m.tile != null).map((m) => m.tile)), [markers]);
  const cities = useMemo(() => (projection ? citySprites({ state, projection, k, selectedRegion, dpr, bannerFont: layoutMode === 'phone-landscape' ? 11 : 12, isTown: towns.isTown, near: nearView(settledView), armyTiles }) : null),
    [state, projection, k, selectedRegion, dpr, layoutMode, towns, settledView, armyTiles]);
  const markerOut = useMemo(() => (projection ? markerSprites({ markers, projection, k, atWar, dpr, waterTile: (t) => getTiles().land[t] !== 1 }) : null), [markers, projection, k, atWar, dpr]);
  // the glyph and road window: the settled view plus half a screen round it, in 2 degree steps
  const landWindow = useMemo(() => {
    if (!projection || k < HEX_FROM_ZOOM) return null;
    const v = viewFor({ transform: { k: settled.k, x: settled.x, y: settled.y }, width, height, dpr, projection, raster });
    const a = projection.invert(screenToWorld(v, -width * 0.5, -height * 0.5)); const b = projection.invert(screenToWorld(v, width * 1.5, height * 1.5));
    if (!a || !b) return null;
    const q = (x) => Math.round(x / 2) * 2;
    return { west: q(a[0]), east: q(b[0]), north: q(Math.min(90, a[1])), south: q(Math.max(-90, b[1])) };
  }, [projection, raster, settled, k, width, height, dpr]);
  const landKey = landWindow ? `${landWindow.west},${landWindow.east},${landWindow.south},${landWindow.north}` : '';
  const landOut = useMemo(() => (projection ? landSprites({ state, projection, k, window: landWindow, isExplored: fog.isExplored, lens, closeGround, dpr }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, projection, k, landKey, fog, lens, closeGround, dpr]);
  const marks = useMemo(() => (projection ? groundMarks({ state, projection, k, dpr }) : []), [state, projection, k, dpr]);
  // (assetsTick: a settler party's model came in, so its disc gives way in the close view)
  const settlers = useMemo(() => (projection ? settlerSprites({ state, projection, k, isVisible: fog.isVisible, dpr, modelled: settlerModelled(state), armyTiles: new Set(markers.armies.filter((a) => a.own).map((a) => a.tile)) }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, projection, k, fog, dpr, assetsTick, markers]);
  // settlers on their way draw their road like a march (settleRoutes.js, I095)
  const settlerRoads = useMemo(() => settlerLines(gameState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState.units, gameState.world?.tileOwner, gameState.wars, gameState.playerNationId]);
  // A tile pointed at from a sheet (a build row: I042), outlined until another tap or POINT_MS.
  const [pointTile, setPointTile] = useState(null);
  useEffect(() => {
    let timer = 0;
    const on = (e) => { clearTimeout(timer); const t = e.detail; setPointTile(t ?? null); if (t != null) timer = setTimeout(() => setPointTile(null), POINT_MS); };
    window.addEventListener(POINT_TILE, on);
    return () => { clearTimeout(timer); window.removeEventListener(POINT_TILE, on); };
  }, []);
  useEffect(() => { if (selectedTile != null) setPointTile(null); }, [selectedTile]);
  const pointLines = useMemo(() => (projection && pointTile != null ? tileOutline({ projection, tile: pointTile }) : []), [projection, pointTile]);
  const march = useMemo(() => (projection ? marchShapes({ marchLines: [...(marchLines || []), ...settlerRoads], projection, k, selectedArmy, dpr }) : null), [marchLines, settlerRoads, projection, k, selectedArmy, dpr]);
  // The independents' raid parties, warnings, sieges and fires in sight (phase W4).
  const raidModel = useMemo(() => raidMapModel(gameState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState.units, gameState.nations, gameState.regions, gameState.world, gameState.turnNumber, gameState.playerNationId]);
  const raids = useMemo(() => (projection ? raidShapes({ model: raidModel, projection, k, dpr }) : null), [raidModel, projection, k, dpr]);

  // the terrain pass: the river lines (riverLayer.js; drawing only, the river rules are the grid's
  // river edges, terrainData.js) and the mountain chains' sprites.
  const [riverData, setRiverData] = useState(null);
  useEffect(() => {
    if (proceduralRaster()) return undefined; // a generated world has no river file
    // off for a speed comparison (scripts/perf/map-pan.mjs --no-rivers)
    try { if (localStorage.getItem('terra-imperium-river-lines') === '0') return undefined; } catch { /* no storage */ }
    let cancelled = false;
    loadRiverLines().then((r) => { if (!cancelled) setRiverData(r); });
    return () => { cancelled = true; };
  }, []);
  const riverBand = riverBandAt(k);
  const riverCap = riverRankCap(k);
  // the closer bands are built for the settled view plus half a screen round it, in 5 degree steps
  const riverWindow = useMemo(() => {
    if (!projection || !RIVER_BANDS[riverBand].windowed) return null;
    const v = viewFor({ transform: { k: settled.k, x: settled.x, y: settled.y }, width, height, dpr, projection, raster });
    const a = projection.invert(screenToWorld(v, -width * 0.5, -height * 0.5)); const b = projection.invert(screenToWorld(v, width * 1.5, height * 1.5));
    if (!a || !b) return null;
    const west = Math.floor(a[0] / 5) * 5; let east = Math.ceil(b[0] / 5) * 5;
    if (east <= west) east += 360;
    return `${west},${east},${Math.max(-90, Math.floor(b[1] / 5) * 5)},${Math.min(90, Math.ceil(a[1] / 5) * 5)}`;
  }, [projection, raster, settled, riverBand, width, height, dpr]);
  // (built inside the effect, never held in this component's render scope: a callback memoized in
  // an older render keeps that render's scope alive, and with it every big array named there; the
  // strips of each settled view piled up, about 5 MB a zoom: the crash hunt's map leak)
  useEffect(() => {
    const g = gl.current;
    if (!g || !riverData?.length) return;
    const w = riverWindow ? riverWindow.split(',').map(Number) : null;
    g.rivers.set(riverStrips(riverData, riverBand, w && { west: w[0], east: w[1], south: w[2], north: w[3] }, riverCap));
    g.request();
  }, [ready, riverData, riverBand, riverWindow, riverCap]);
  const terrainOut = useMemo(() => (projection ? terrainSprites({ projection, k, near: settledView ? nearView(settledView) : null, dpr }) : null), [projection, k, settledView, dpr]);

  // The map's own buttons (every element marked data-map-hud; "group": each child on its own) as
  // screen boxes over the map, for the labels to keep clear of (avoidHud, I081). Read again when
  // one of them changes size (the mini map opens, the goals unfold).
  const [hudTick, setHudTick] = useState(0);
  useEffect(() => {
    if (!ready || !hudOffset || typeof ResizeObserver === 'undefined') return undefined;
    let timer = 0;
    const ro = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => setHudTick((n) => n + 1), 150); });
    document.querySelectorAll('[data-map-hud]').forEach((el) => ro.observe(el));
    return () => { clearTimeout(timer); ro.disconnect(); };
  }, [ready, hudOffset]);
  // (made outside this component's scope: a callback kept from an older render keeps that whole
  // render alive, its game state included, and through its own kept callbacks the render before:
  // the map's memory grew about 4 MB a turn. hudToScreenOf only holds the view.)
  const hudToScreen = useMemo(() => hudToScreenOf(settledView), [settledView]);
  const hudRects = useCallback((el) => {
    if (!hudOffset || !el || typeof document === 'undefined') return [];
    const box = el.getBoundingClientRect();
    const out = [];
    document.querySelectorAll('[data-map-hud]').forEach((h) => {
      (h.dataset.mapHud === 'group' ? [...h.children] : [h]).forEach((p) => {
        const r = p.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push([r.left - box.left, r.top - box.top, r.right - box.left, r.bottom - box.top]);
      });
    });
    return out;
  }, [hudOffset]);
  const [atlasTick, setAtlasTick] = useState(0);
  useEffect(() => onImageLoad(() => { const g = gl.current; if (g && g.atlas.dropPending()) setAtlasTick((n) => n + 1); }), []);
  useEffect(() => {
    const g = gl.current;
    if (!g || !cities || !markerOut || !landOut || !settlers || !march || !terrainOut || !raids) return;
    const groups = {
      terrain: terrainOut,
      // the lens's own marks (the settle mode's numbered sites) over the tile glyphs
      ground: [...landOut.sprites, ...marks, ...(lensOut?.sprites || [])],
      upper: [...march.sprites, ...settlers.sprites],
      // names, banners and the raids' labels never stand on each other (declutter.js, I080)
      // and never under the map's own buttons (avoidHud, I081)
      top: [...cities.sprites, ...declutterLabels(avoidHud([...cities.names, ...raids.sprites.filter((s) => s.label)], k, hudToScreen, hudRects(containerRef.current)), k), ...raids.sprites.filter((s) => !s.label)],
      markers: markerOut.sprites
    };
    const resolve = () => {
      const out = {};
      for (const [name, list] of Object.entries(groups)) {
        const placed = [];
        for (const s of list) {
          const uv = g.atlas.get(s.art);
          if (!uv) return null;
          placed.push({ ...s, uv });
        }
        out[name] = placed;
      }
      return out;
    };
    let placed = resolve();
    if (!placed) { g.atlas.reset(); placed = resolve(); }
    if (!placed) { console.warn('map sprites: the atlas is too small for this view'); return; }
    g.terrainSprites.set(placed.terrain);
    g.groundSprites.set(placed.ground);
    g.upperSprites.set(placed.upper);
    g.topSprites.set(placed.top);
    g.markerPlaced = placed.markers;
    g.markerShown = placed.markers;
    g.markerLayer.set(placed.markers);
    if (g.glide) stepGlide(g, performance.now(), k); // (a glide under way, or held for the turn report, puts them back at once: no frame of the new tiles)
    g.lowLines.set([...landOut.lines, ...(lensOut?.lines || [])]);
    g.marchLines.set([...march.lines, ...raids.lines, ...pointLines]);
    g.hits = [...raids.hits, ...settlers.hits, ...cities.hits, ...markerOut.hits];
    g.request();
  }, [ready, cities, markerOut, landOut, marks, settlers, march, raids, lensOut, terrainOut, atlasTick, k, hudToScreen, hudRects, hudTick, pointLines, stepGlide]);

  // ---------------------------------------------------------------- the close view
  const [land, setLand] = useState(null);
  const ground = useRef(null);
  const nearClose = k >= CLOSE_ZOOM_K * 0.7;
  useEffect(() => {
    if (!nearClose || land) return undefined;
    let cancelled = false;
    loadLandFeatures().then((f) => { if (!cancelled) setLand(f); });
    return () => { cancelled = true; };
  }, [nearClose, land]);
  useEffect(() => {
    if (!land || ground.current) return;
    loadGroundData(land, worldRasterUrl(2048)).then((d) => { ground.current = d; setAssetsTick((n) => n + 1); });
  }, [land]);
  useEffect(() => {
    const g = gl.current;
    if (!g || !projection || k < CLOSE_ZOOM_K) return;
    const v = viewFor({ transform: { k: settled.k, x: settled.x, y: settled.y }, width, height, dpr, projection, raster });
    const mx = width * CLOSE_MARGIN; const my = height * CLOSE_MARGIN;
    const tx = -v.worldLeft * v.k + mx; const ty = -v.worldTop * v.k + my;
    const proj = {
      fwd: (lon, lat) => { const p = projection([lon, lat]); return p ? [wrapNear(p[0], v.camX, v.worldW), p[1]] : null; },
      inv: (x, y) => projection.invert([wrapNear(x, raster.x + raster.width / 2, raster.width), y])
    };
    g.closeScene.layout({ projection, proj, transform: { x: tx, y: ty, k: v.k }, width: width + 2 * mx, height: height + 2 * my, state, fog, towns, markers, ground: ground.current });
    g.closeLayout = { k: v.k, tx, ty, camX: v.camX };
    g.request();
  }, [settled, k, projection, raster, width, height, dpr, state, fog, towns, markers, assetsTick]);

  // ---------------------------------------------------------------- taps
  // The city whose land (or marker) is under a screen point, for the tap ring.
  const regionAt = (sx, sy) => {
    const g = gl.current; const v = view();
    if (!g || !v) return null;
    const hit = pickHit(v, g.hits, sx, sy);
    if (hit?.kind === 'marker') return hit.marker.regionId;
    if (hit?.kind === 'city' || hit?.kind === 'banner') return hit.id;
    const ll = projection.invert(screenToWorld(v, sx, sy));
    const tile = ll ? tileAtLatLon(ll[1], ll[0]) : null;
    return tile != null && tile >= 0 ? state.world?.tileOwner?.[tile] || null : null;
  };
  // (a plain function, made fresh each render: memoized, it kept older renders alive, see hudToScreen)
  const handleCityTap = (cityId, e, sx, sy) => {
    if (e?.pointerType === 'touch' && onAmbiguousTap) {
      const ids = tapCandidates(tapRingPoints(sx, sy).map(([px, py]) => regionAt(px, py)));
      if (ids.length > 1) { const rect = containerRef.current.getBoundingClientRect(); onAmbiguousTap({ x: sx + rect.left, y: sy + rect.top, ids }); return; }
    }
    onSelectRegion(cityId === selectedRegion ? null : cityId);
  };
  const zoomToRegion = useCallback((regionId) => {
    const c = latLngOfCity(gameStateRef.current, regionId);
    if (c) focusOnLatLng(c.lat, c.lng, Math.min(ZOOM_MAX, Math.max(transformRef.current.k * 2.5, INITIAL_FOCUS_ZOOM)), true);
  }, [focusOnLatLng, ZOOM_MAX]);
  // What a tap at a screen point picks, top first: a marker or cluster, a settler, a city's badge,
  // banner or town, else the land (the city that holds it, else the tile, land or sea).
  // While a march is aimed, a cluster of banners (the strategic zoom piles them on the cities) and a
  // foreign army on a city's centre are the place under them, as a closer zoom picks it: a tap
  // aims at the city, it does not zoom (playtest audit I074, checked in a late world).
  const tapAt = (sx, sy, under = false, skip = null) => {
    const g = gl.current; const v = view();
    if (!g || !v || !projection) return null;
    const hit = pickHit(v, under ? g.hits.filter((h) => h.kind !== 'marker' && h.kind !== 'cluster' && h !== skip) : g.hits, sx, sy);
    if (hit?.kind === 'cluster' || hit?.kind === 'marker') {
      const m = hit.marker;
      const onCityCentre = m.tile != null && state.regions[state.world?.tileOwner?.[m.tile]]?.tile === m.tile;
      if (marchingRef.current && (hit.kind === 'cluster' || (!m.own && m.kind === 'army' && onCityCentre))) return tapAt(sx, sy, true);
      return { kind: hit.kind, marker: m, id: m.regionId };
    }
    if (hit?.kind === 'indep') return { kind: 'indep', id: hit.id };
    if (hit?.kind === 'settler') return { kind: 'settler', tile: hit.tile };
    // (an aimed march looks through your own city's name banner, which spills over the next hexes, to the land under it)
    if (hit?.kind === 'banner' && marchingRef.current && state.regions[hit.id]?.owner === state.playerNationId) return tapAt(sx, sy, true, hit);
    if (hit?.kind === 'city' || hit?.kind === 'banner') return { kind: 'city', id: hit.id, via: hit.kind };
    const ll = projection.invert(screenToWorld(v, sx, sy));
    if (!ll) return null;
    const tile = tileAtLatLon(ll[1], ll[0]);
    const city = tile != null && tile >= 0 ? state.world?.tileOwner?.[tile] : null;
    // A city's land picks the city while the hexes are too small to tell apart, and its centre
    // tile always does. From the hex zoom a tile of its land is the tile itself (its sheet names
    // the city and opens it): the player can inspect the land inside a border (playtest audit
    // I077). A march keeps aiming at a foreign city whose land was tapped, and so does settling; on
    // your own land it aims at the hex (it aimed at your city, and an army inside it was "already
    // there": playtest run 40651416284 step 58).
    const ownLand = city && state.regions[city]?.owner === state.playerNationId;
    const hexPick = (v.k >= HEX_FROM_ZOOM || settleRef.current) && (!marchingRef.current || ownLand);
    if (city && state.regions[city] && (!hexPick || state.regions[city].tile === tile)) return { kind: 'city', id: city, via: 'land', tile };
    return { kind: 'tile', tile, land: tile != null && tile >= 0 && getTiles().land[tile] === 1, explored: tile != null && tile >= 0 && fog.isExplored(tile), cityId: city && state.regions[city] ? city : null };
  };
  const tapAtRef = useRef(tapAt);
  tapAtRef.current = tapAt;
  // The city's name as the mouse rests on its land (the SVG map's <title> on every territory).
  const hoverRef = useRef(0);
  const onPointerMove = (e) => {
    if (trailRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top }; const last = trailRef.current[trailRef.current.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 10) { trailRef.current.push(p); setTrail([...trailRef.current]); }
      return;
    }
    if (e.pointerType !== 'mouse' || e.buttons || !containerRef.current) return;
    const now = performance.now();
    if (now - hoverRef.current < 120) return;
    hoverRef.current = now;
    const rect = containerRef.current.getBoundingClientRect();
    const pick = tapAt(e.clientX - rect.left, e.clientY - rect.top);
    const name = state.regions[pick?.kind === 'city' ? pick.id : pick?.cityId]?.name || '';
    if (containerRef.current.title !== name) containerRef.current.title = name;
  };
  const tapRef = useRef(null);
  const onPointerDown = useCallback((e) => {
    // a finger that stops a gliding map only stops it (no tap)
    tapRef.current = fling.current.raf ? null : { x: e.clientX, y: e.clientY };
    if (pathModeRef.current && e.target === canvasRef.current && containerRef.current) { const rect = containerRef.current.getBoundingClientRect(); trailRef.current = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }]; }
  }, []);
  // U38: the stroke's land tiles, thinned to a few way points; the last one is the march's target.
  const endStroke = (e) => {
    const pts = trailRef.current; trailRef.current = null; setTrail(null);
    const v = view();
    if (!pts || !v || !projection || !setPathRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const all = [...pts, { x: e.clientX - rect.left, y: e.clientY - rect.top }];
    const tiles = [];
    for (const p of all) {
      const ll = projection.invert(screenToWorld(v, p.x, p.y));
      const t = ll ? tileAtLatLon(ll[1], ll[0]) : null;
      if (t != null && t >= 0 && getTiles().land[t] === 1 && t !== tiles[tiles.length - 1]) tiles.push(t);
    }
    if (tiles.length < 2) return;
    const target = tiles.pop();
    const stops = tiles.slice(1); // the first tile is where the finger came down
    const via = stops.length > MAX_VIA ? Array.from({ length: MAX_VIA }, (_, i) => stops[Math.round((i * (stops.length - 1)) / (MAX_VIA - 1))]) : stops;
    setPathRef.current(via, target);
  };
  const onPointerUp = (e) => {
    if (trailRef.current) { const moved = trailRef.current.length > 1; if (moved) { tapRef.current = null; endStroke(e); return; } trailRef.current = null; setTrail(null); }
    const start = tapRef.current; tapRef.current = null;
    const g = gl.current;
    if (!start || !g || !projection || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
    if (e.target !== canvasRef.current) return; // a button over the map
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left; const sy = e.clientY - rect.top;
    const pick = tapAt(sx, sy);
    if (!pick) return;
    if (pick.kind === 'cluster') { zoomToRegion(pick.marker.regionId); return; }
    if (pick.kind === 'marker') {
      const c = pick.marker;
      if (c.kind === 'battle') openBattleReport(c.id);
      else if (!c.own && c.kind === 'army' && c.tile != null && onSelectTile) onSelectTile(c.tile);
      else if (c.own && (c.kind === 'army' || c.kind === 'fleet') && c.tile != null && onSelectArmy) {
        // Your army's banner is your army, also when it stands on a city (the city has its own
        // badge, banner and town to tap: playtest audit I076). So is a fleet in port (its sheet
        // boards troops); a march aimed at a banner on a city aims at the city.
        const onCity = gameState.regions[gameState.world?.tileOwner?.[c.tile]]?.tile === c.tile;
        if (onCity && marchingRef.current) onSelectRegion?.(c.regionId);
        else onSelectArmy(c.tile);
      } else onSelectRegion?.(c.regionId);
      return;
    }
    if (pick.kind === 'indep') { openIndependent(pick.id); return; }
    if (pick.kind === 'settler') { onSelectTile?.(pick.tile); return; }
    if (pick.kind === 'city') { handleCityTap(pick.id, e, sx, sy); return; }
    if (!onSelectTile) return;
    if (pick.tile == null || pick.tile < 0) { onSelectTile(null); return; }
    // A tap on the hex of your own army (its soldier model, under the banner) is the army, as Civ VI
    // and Polytopia select the unit on its hex: it opened the tile sheet and a phone player could not
    // find the army's orders (playtest run 40550097406). A second tap, with that army open, is the tile.
    if (!marchingRef.current && !settleRef.current && onSelectArmy && pick.tile !== selectedArmy
      && Object.values(gameState.units || {}).some((u) => u.ownerId === gameState.playerNationId && u.tile === pick.tile && u.classId !== 'settler')) {
      onSelectArmy(pick.tile);
      return;
    }
    onSelectTile(pick.tile === selectedTile ? null : pick.tile);
  };

  // ---------------------------------------------------------------- effects (the action animations)
  const getProjector = useCallback(() => {
    const v = view();
    if (!v || !projection) return null;
    const pxPerRadian = projection.scale() * v.k;
    return {
      zoom: clamp(0.75 + v.k * 0.05, 0.75, 1.5),
      project: (lat, lng, alt = 0) => {
        const p = projection([lng, lat]);
        if (!p) return { x: NaN, y: NaN, visible: false };
        const [x, y] = worldToScreen(v, p[0], p[1]);
        return { x, y: y - alt * pxPerRadian * 0.6, visible: true };
      }
    };
  }, [view, projection]);

  // ---------------------------------------------------------------- test and measurement hooks
  useEffect(() => {
    if (!hudOffset || typeof window === 'undefined' || window.__E2E_MAP_TEST__ !== true || !projection) return undefined;
    window.__map2DTest = {
      get features() { return getCityFeatures(state).map((f) => ({ ...f, properties: { ...f.properties, owner: state.regions[f.properties.gameRegionId]?.owner || null } })); },
      selected: selectedRegion,
      focus: (lat, lng, zoom) => focusOnLatLng(lat, lng, zoom, false),
      project: (lat, lng) => { const p = projection([lng, lat]); const [x, y] = worldToScreen(view(), p[0], p[1]); return { x, y }; },
      // what a tap at this screen point picks first: { kind, id } of a marker, city badge or banner
      hitAt: (x, y) => { const h = pickHit(view(), gl.current?.hits || [], x, y); return h ? { kind: h.kind, id: h.id ?? h.marker?.regionId ?? null } : null; },
      // what a tap there does: { kind: marker | cluster | settler | city | tile, id, tile, land, via }
      pickAt: (x, y) => { const p = tapAtRef.current(x, y); return p ? { kind: p.kind, id: p.id ?? null, tile: p.tile ?? null, land: p.land ?? null, explored: p.explored ?? null, via: p.via ?? null, marker: p.marker?.kind ?? null, own: p.marker?.own ?? null, cityId: p.cityId ?? null } : null; },
      transform: () => ({ ...transformRef.current }),
      // jump to a transform (clamped by the zoom behaviour), for look screenshots
      setTransform: ({ x, y, k: kk }) => { if (zoomBehaviorRef.current && containerRef.current) select(containerRef.current).call(zoomBehaviorRef.current.transform, zoomIdentity.translate(x, y).scale(kk)); },
      worldView: () => resetZoom()
    };
    window.__glMap = {
      info: () => ({ ...gl.current.renderer.info.render, frames: gl.current.frames, territory: gl.current.lastTerritory, raster: gl.current.raster.stats(), terrainSprites: gl.current.terrainSprites.mesh.geometry.instanceCount, rivers: gl.current.rivers.count() }),
      renderer: gl.current?.renderer,
      // the banners as last drawn (a glide moves them frame by frame: marchGlide.js, I070)
      banners: () => (gl.current?.markerShown || []).map((s) => ({ key: s.glideKey, anchor: [...s.anchor], size: [...s.size] })),
      gliding: () => !!gl.current?.glide,
      // ms a frame over `n` frames drawn back to back (GPU finished), with the river lines on or
      // off: what the lines cost on this machine (scripts/perf/river-cost.mjs)
      timeFrames: (n = 30, rivers = true) => {
        const g = gl.current;
        g.rivers.hidden = !rivers;
        const ctx = g.renderer.getContext(); const px = new Uint8Array(4);
        const sync = () => ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px); // waits for the GPU (finish() does not)
        g.frame(); sync();
        const t0 = performance.now();
        for (let i = 0; i < n; i++) { g.frame(); sync(); }
        const ms = (performance.now() - t0) / n;
        g.rivers.hidden = false;
        g.request();
        return ms;
      }
    };
    return () => { delete window.__map2DTest; delete window.__glMap; };
  }, [hudOffset, projection, state, selectedRegion, focusOnLatLng, view, ready, resetZoom]);

  const kNow = settled.k;
  return (
    <div className="relative w-full h-full" style={{ background: OCEAN_COLOR }}>
      <div
        ref={containerRef}
        data-testid={hudOffset ? 'flat-map' : undefined}
        data-renderer="webgl"
        className="absolute inset-0"
        style={{ touchAction: 'none', cursor: 'pointer' }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={onPointerMove}
      >
        <canvas key={canvasGen} ref={canvasRef} data-testid="gl-map" style={{ width, height, display: 'block' }} />
      </div>
      {trail && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full" data-testid="map-draw-path">
          <polyline points={trail.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#a3e635" strokeWidth="4" strokeDasharray="10 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {!prefersReducedMotion() && <EffectsLayer effects={effects} getProjector={getProjector} width={width} height={height} ageId={ageOf(state, state.playerNationId)} testId="map2d-effects" />}
      <MapZoomControls
        style={{ insetInlineEnd: insets.end + 8 }}
        className={hudOffset ? 'top-[calc(var(--header-height,2.25rem)+0.625rem)]' : 'top-12'}
        onZoomIn={() => zoomBy(ZOOM_STEP_SCALE)} canZoomIn={kNow < ZOOM_MAX}
        onZoomOut={() => zoomBy(1 / ZOOM_STEP_SCALE)} canZoomOut={kNow > minK}
        onReset={resetZoom} canReset={kNow > minK}
        onHome={homeTarget ? goHome : null} onArmy={armyTarget?.from === 'army' ? goArmy : null}
      />
    </div>
  );
};

export default GLMapView;
