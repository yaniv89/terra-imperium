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
// camera between layouts. Frames are drawn on demand; only marching soldiers animate.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoEquirectangular } from 'd3-geo';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import 'd3-transition';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { WebGLRenderer, Scene, OrthographicCamera, Group } from 'three';
import { useGame } from '../../../context/GameContext';
import { useEffects } from '../../../context/EffectsContext';
import { useMapInsets } from '../../../context/MapInsetsContext';
import { useLayoutMode } from '../../../hooks/useLayoutMode';
import { REGION_COORDINATES } from '../../../data/regionCoordinates';
import { loadLandFeatures } from '../../../data/geo/loadWorldFeatures';
import { getCityFeatures, tileAtLatLon } from '../../../data/geo/cityFeatures';
import { getTiles } from '../../../data/geo/tiles';
import { worldRasterUrl, worldRasterSizeFor } from '../../../data/geo/worldRaster';
import { baseRasterZoom } from '../../../data/geo/rasterTiles';
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
import { isSettler } from '../../../engine/settlers';
import { loadGroundData } from '../closeView/groundBlend';
import { createCloseScene, closeTowns } from '../closeView/closeViewScene';
import { tileGpuData } from './tileGpuData';
import { indexCities, buildTileTexels, buildCityTexels, buildTintTexels } from './territoryData';
import { createTerritoryLayer, createTerritoryCache, createRasterLayer, createSpriteLayer, createLineLayer } from './glLayers';
import { createAtlas } from './spriteAtlas';
import { onImageLoad } from './spriteArt';
import { viewFor, worldRect, wrapNear, screenToWorld, worldToScreen, minZoomFor, pickHit } from './mapView';
import {
  citySprites, nearView, markerSprites, landSprites, groundMarks, settlerSprites, marchShapes, lensShapes,
  HEX_FROM_ZOOM, CITY_DETAIL_ZOOM, CLOSE_ZOOM_K
} from './sceneModel';

const OCEAN_COLOR = '#0f172a';
const ZOOM_MAX = 200;
const ZOOM_STEP_SCALE = 1.6;
const ZOOM_SETTLE_MS = 150;
const ZOOM_JUMP = 1.8;
const INITIAL_FOCUS_ZOOM = 5;
// The close view's models are laid out over the screen plus this share of it on every side.
const CLOSE_MARGIN = 0.35;
const linearViewInterpolate = (a, b) => (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
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
  onSelectArmy = null, selectedArmy = null, lens = 'political', onFail = null
}) => {
  const { state: gameState } = useGame();
  const fog = useMemo(() => fogView(gameState), [gameState]);
  const state = fog.state;
  // One of your settlers on the selected tile shows the settle tints round it (settle-rules R6).
  const settlerTile = useMemo(() => (selectedTile != null && Object.values(gameState.units).some((u) => isSettler(u) && u.ownerId === gameState.playerNationId && u.tile === selectedTile) ? selectedTile : null),
    [selectedTile, gameState.units, gameState.playerNationId]);
  const tintOn = lens === 'supply' || lens === 'settle' || (settlerTile != null && lens === 'political');
  const { effects } = useEffects();
  const rawInsets = useMapInsets();
  const insets = hudOffset ? rawInsets : { top: 0, bottom: 0, left: 0, right: 0 };
  const layoutMode = useLayoutMode();
  const marchCtx = useMarch();
  const marchLines = marchCtx?.lines;

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const gl = useRef(null); // the renderer, scenes and layers
  const transformRef = useRef(zoomIdentity);
  const zoomBehaviorRef = useRef(null);
  const appliedInitialFocusRef = useRef(false);
  const [settled, setSettled] = useState(() => ({ k: 1, x: 0, y: 0, n: 0 }));
  const [ready, setReady] = useState(false);
  const [assetsTick, setAssetsTick] = useState(0);
  const dpr = devicePixelRatio();

  const projection = useMemo(() => (width > 0 && height > 0 ? geoEquirectangular().fitSize([width, height], { type: 'Sphere' }) : null), [width, height]);
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
    // drawn in this order: the Earth, the territories (cached while panning), lines and ground
    // sprites, the close view's models, the badges, banners and markers
    const ground = new Scene(); const base = new Scene(); const close = new Scene(); const top = new Scene();
    const closeRoot = new Group();
    close.add(closeRoot);
    const camera = new OrthographicCamera(0, 1, 0, -1, -1, 1);
    const atlas = createAtlas();
    const g = {
      renderer, camera, ground, base, close, top, closeRoot, atlas, raf: 0, dirty: true, closeActive: false, closeLayout: null,
      groups: {}, hits: [], frames: 0
    };
    g.frame = () => { g.raf = 0; };
    g.request = () => { if (!g.raf && !g.disposed) g.raf = requestAnimationFrame((now) => g.frame(now)); };
    g.raster = createRasterLayer(ground, { request: g.request, onReady: () => g.request() });
    g.territory = createTerritoryLayer(new Scene(), tileGpuData(getTiles()));
    g.territoryCache = createTerritoryCache(g.territory);
    g.lowLines = createLineLayer(base, 20);
    g.groundSprites = createSpriteLayer(base, atlas, 30);
    g.marchLines = createLineLayer(base, 40);
    g.upperSprites = createSpriteLayer(base, atlas, 45);
    g.topSprites = createSpriteLayer(top, atlas, 50);
    g.closeScene = createCloseScene(close, closeRoot, { onAssets: () => setAssetsTick((n) => n + 1) });
    gl.current = g;
    if (import.meta.env.DEV) window.__closeView = Object.assign(g.closeScene.state, { renderer });
    setReady(true);
    return () => {
      g.disposed = true;
      cancelAnimationFrame(g.raf);
      [g.raster, g.territory, g.lowLines, g.groundSprites, g.marchLines, g.upperSprites, g.topSprites, g.closeScene, g.territoryCache].forEach((l) => l.dispose());
      renderer.dispose();
      gl.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- one frame
  // Reads the live transform (a ref), so panning draws without React.
  const settings = useRef({});
  settings.current = { selectedTile, lens, tintOn, fogOn: fog.on, worldUrl: worldRasterUrl(worldRasterSizeFor(width, height)), worldSize: worldRasterSizeFor(width, height), baseZ: baseRasterZoom(worldRasterSizeFor(width, height)) };
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
      uSelTile: s.selectedTile ?? -1, uTintOn: s.tintOn ? 1 : 0, uFogOn: s.fogOn ? 1 : 0
    };
    [g.lowLines, g.groundSprites, g.marchLines, g.upperSprites, g.topSprites].forEach((l) => l.update(v));
    // the world camera (the raster quads and the close view's models)
    camera.left = v.worldLeft; camera.right = v.worldLeft + width / v.k;
    camera.top = -v.worldTop; camera.bottom = -(v.worldTop + height / v.k);
    const lay = g.closeLayout;
    const depth = 8000 / Math.min(v.k, lay?.k || v.k);
    camera.near = -depth; camera.far = depth;
    camera.updateProjectionMatrix();
    renderer.autoClear = true;
    renderer.render(g.ground, camera);
    renderer.autoClear = false;
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
    if (g.closeActive && g.closeScene.moving()) g.request();
  }, [view, width, height]);
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
    const settle = () => setSettled({ k: t.k, x: t.x, y: t.y, n: Date.now() });
    if (ratio > ZOOM_JUMP || ratio < 1 / ZOOM_JUMP) settle();
    else settleTimer.current = setTimeout(settle, ZOOM_SETTLE_MS);
  }, []);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !ready || width <= 0 || height <= 0) return undefined;
    const behavior = d3zoom()
      .interpolate(linearViewInterpolate)
      .scaleExtent([minK, ZOOM_MAX])
      // east and west are free (the world wraps), north and south stop at the poles
      .translateExtent([[-Infinity, 0], [Infinity, height]])
      .on('zoom', (event) => onZoom(event.transform));
    zoomBehaviorRef.current = behavior;
    const selection = select(el);
    selection.call(behavior);
    // keep the current view (a resize rebuilds the behaviour)
    selection.call(behavior.transform, transformRef.current.k < minK ? zoomIdentity.scale(minK) : transformRef.current);
    return () => { selection.on('.zoom', null); };
  }, [ready, width, height, minK, onZoom]);

  const focusOnLatLng = useCallback((lat, lng, k = INITIAL_FOCUS_ZOOM, animate = false) => {
    if (!projection || !zoomBehaviorRef.current || !containerRef.current) return false;
    const v = view();
    const [px0, py] = projection([lng, lat]);
    const px = v ? wrapNear(px0, (width / 2 - transformRef.current.x) / transformRef.current.k, v.worldW) : px0;
    const vcx = insets.left + (width - insets.left - insets.right) / 2;
    const vcy = insets.top + (height - insets.top - insets.bottom) / 2;
    const desired = zoomIdentity.translate(vcx - px * k, vcy - py * k).scale(k);
    const selection = select(containerRef.current);
    (animate ? selection.transition().duration(450) : selection).call(zoomBehaviorRef.current.transform, desired);
    return true;
  }, [projection, view, width, height, insets.left, insets.right, insets.top, insets.bottom]);
  const focusOnRegionId = useCallback((id, k = INITIAL_FOCUS_ZOOM, animate = false) => {
    const c = REGION_COORDINATES[id];
    return c ? focusOnLatLng(c.lat, c.lng, k, animate) : false;
  }, [focusOnLatLng]);

  useEffect(() => {
    if (appliedInitialFocusRef.current || !initialFocusRegionId || !ready) return;
    if (focusOnRegionId(initialFocusRegionId)) appliedInitialFocusRef.current = true;
  }, [initialFocusRegionId, focusOnRegionId, ready]);

  // A new action effect: pan to it (keeping a deeper zoom) and keep it centred while it plays.
  const lastEffectIdRef = useRef(effects.length ? effects[effects.length - 1].id : null);
  const followRef = useRef(null);
  useEffect(() => {
    const latest = effects[effects.length - 1];
    if (!latest || latest.id === lastEffectIdRef.current) return;
    lastEffectIdRef.current = latest.id;
    const target = REGION_COORDINATES[latest.toRegionId];
    if (!target) return;
    const k = Math.max(transformRef.current.k, INITIAL_FOCUS_ZOOM);
    followRef.current = { lat: target.lat, lng: target.lng, k, until: Date.now() + getEffectPeekDuration(latest.actionType) };
    focusOnLatLng(target.lat, target.lng, k, true);
  }, [effects, focusOnLatLng]);
  useEffect(() => {
    const follow = followRef.current;
    if (follow && Date.now() < follow.until) { focusOnLatLng(follow.lat, follow.lng, follow.k, true); return; }
    if (focusRegionId) focusOnRegionId(focusRegionId, INITIAL_FOCUS_ZOOM, true);
  }, [focusRegionId, focusOnRegionId, focusOnLatLng]);
  useEffect(() => {
    if (!navigateTarget) return;
    focusOnLatLng(navigateTarget.lat, navigateTarget.lng, Math.max(transformRef.current.k, INITIAL_FOCUS_ZOOM), true);
  }, [navigateTarget, focusOnLatLng]);

  // The minimap's "you are here" box, once the view settles.
  useEffect(() => {
    if (!onViewportChange || !projection) return;
    const v = view();
    const centre = projection.invert(screenToWorld(v, width / 2, height / 2));
    if (!centre) return;
    const degPerPx = 360 / (v.worldW * v.k);
    onViewportChange({ centerLng: centre[0], centerLat: centre[1], halfWidthDeg: (width / 2) * degPerPx, halfHeightDeg: (height / 2) * degPerPx });
  }, [settled, onViewportChange, projection, view, width, height]);

  const zoomBy = useCallback((factor) => { if (zoomBehaviorRef.current && containerRef.current) select(containerRef.current).transition().duration(200).call(zoomBehaviorRef.current.scaleBy, factor); }, []);
  const resetZoom = useCallback(() => { if (zoomBehaviorRef.current && containerRef.current) select(containerRef.current).transition().duration(200).call(zoomBehaviorRef.current.transform, zoomIdentity.scale(minK)); }, [minK]);

  // ---------------------------------------------------------------- territories (data textures)
  const atWar = useMemo(() => getAtWarNationIds(state.wars, state.playerNationId), [state.wars, state.playerNationId]);
  const cityIndex = useMemo(() => indexCities(state.regions), [state.regions]);
  const tileOwner = state.world?.tileOwner;
  useEffect(() => {
    const g = gl.current;
    if (!g) return;
    g.territory.setTiles(buildTileTexels({ tileCount: getTiles().count, tileOwner, regions: state.regions, fog, index: cityIndex }));
    g.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tileOwner, fog.explored, fog.visible, cityIndex]);
  useEffect(() => {
    const g = gl.current;
    if (!g) return;
    g.territory.setCities(buildCityTexels({ regions: state.regions, index: cityIndex, playerNationId: state.playerNationId, selectedRegion, atWarNationIds: atWar, nations: state.nations }));
    g.request();
  }, [ready, state.regions, state.nations, cityIndex, state.playerNationId, selectedRegion, atWar]);
  const lensOut = useMemo(() => (projection ? lensShapes({ state, projection, k: settled.k, lens, dpr, settlerTile }) : null), [state, projection, settled.k, lens, dpr, settlerTile]);
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
  const markers = useMemo(() => getMapMarkers(gameState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState.units, gameState.regions, gameState.nations, gameState.intel, gameState.battleReports, gameState.turnNumber, gameState.playerNationId]);
  const towns = useMemo(() => closeTowns(state), [state]);
  // the settled view: the cities' sprites are built round it
  const settledView = useMemo(() => (projection ? viewFor({ transform: { k: settled.k, x: settled.x, y: settled.y }, width, height, dpr, projection, raster }) : null), [projection, raster, settled, width, height, dpr]);
  const cities = useMemo(() => (projection ? citySprites({ state, projection, k, selectedRegion, dpr, bannerFont: layoutMode === 'phone-landscape' ? 11 : 12, isTown: towns.isTown, near: nearView(settledView) }) : null),
    [state, projection, k, selectedRegion, dpr, layoutMode, towns, settledView]);
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
  const settlers = useMemo(() => (projection ? settlerSprites({ state, projection, k, isVisible: fog.isVisible, dpr }) : null), [state, projection, k, fog, dpr]);
  const march = useMemo(() => (projection ? marchShapes({ marchLines, projection, k, selectedArmy, dpr }) : null), [marchLines, projection, k, selectedArmy, dpr]);

  const [atlasTick, setAtlasTick] = useState(0);
  useEffect(() => onImageLoad(() => { const g = gl.current; if (g && g.atlas.dropPending()) setAtlasTick((n) => n + 1); }), []);
  useEffect(() => {
    const g = gl.current;
    if (!g || !cities || !markerOut || !landOut || !settlers || !march) return;
    const groups = {
      ground: [...(lensOut?.sprites || []), ...landOut.sprites, ...marks],
      upper: [...march.sprites, ...settlers.sprites],
      top: [...cities.sprites, ...cities.names, ...markerOut.sprites]
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
    g.groundSprites.set(placed.ground);
    g.upperSprites.set(placed.upper);
    g.topSprites.set(placed.top);
    g.lowLines.set([...landOut.lines, ...(lensOut?.lines || [])]);
    g.marchLines.set(march.lines);
    g.hits = [...settlers.hits, ...cities.hits, ...markerOut.hits];
    g.request();
  }, [ready, cities, markerOut, landOut, marks, settlers, march, lensOut, atlasTick]);

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
  const handleCityTap = useCallback((cityId, e, sx, sy) => {
    if (e?.pointerType === 'touch' && onAmbiguousTap) {
      const ids = tapCandidates(tapRingPoints(sx, sy).map(([px, py]) => regionAt(px, py)));
      if (ids.length > 1) { const rect = containerRef.current.getBoundingClientRect(); onAmbiguousTap({ x: sx + rect.left, y: sy + rect.top, ids }); return; }
    }
    onSelectRegion(cityId === selectedRegion ? null : cityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAmbiguousTap, onSelectRegion, selectedRegion]);
  const zoomToRegion = useCallback((regionId) => {
    const c = REGION_COORDINATES[regionId];
    if (c) focusOnLatLng(c.lat, c.lng, Math.min(ZOOM_MAX, Math.max(transformRef.current.k * 2.5, INITIAL_FOCUS_ZOOM)), true);
  }, [focusOnLatLng]);
  // What a tap at a screen point picks, top first: a marker or cluster, a settler, a city's badge,
  // banner or town, else the land (the city that holds it, else the tile, land or sea).
  const tapAt = (sx, sy) => {
    const g = gl.current; const v = view();
    if (!g || !v || !projection) return null;
    const hit = pickHit(v, g.hits, sx, sy);
    if (hit?.kind === 'cluster' || hit?.kind === 'marker') return { kind: hit.kind, marker: hit.marker, id: hit.marker.regionId };
    if (hit?.kind === 'settler') return { kind: 'settler', tile: hit.tile };
    if (hit?.kind === 'city' || hit?.kind === 'banner') return { kind: 'city', id: hit.id, via: hit.kind };
    const ll = projection.invert(screenToWorld(v, sx, sy));
    if (!ll) return null;
    const tile = tileAtLatLon(ll[1], ll[0]);
    const city = tile != null && tile >= 0 ? state.world?.tileOwner?.[tile] : null;
    if (city && state.regions[city]) return { kind: 'city', id: city, via: 'land', tile };
    return { kind: 'tile', tile, land: tile != null && tile >= 0 && getTiles().land[tile] === 1, explored: tile != null && tile >= 0 && fog.isExplored(tile) };
  };
  const tapAtRef = useRef(tapAt);
  tapAtRef.current = tapAt;
  // The city's name as the mouse rests on its land (the SVG map's <title> on every territory).
  const hoverRef = useRef(0);
  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse' || e.buttons || !containerRef.current) return;
    const now = performance.now();
    if (now - hoverRef.current < 120) return;
    hoverRef.current = now;
    const rect = containerRef.current.getBoundingClientRect();
    const pick = tapAt(e.clientX - rect.left, e.clientY - rect.top);
    const name = pick?.kind === 'city' ? state.regions[pick.id]?.name || '' : '';
    if (containerRef.current.title !== name) containerRef.current.title = name;
  };
  const tapRef = useRef(null);
  const onPointerDown = useCallback((e) => { tapRef.current = { x: e.clientX, y: e.clientY }; }, []);
  const onPointerUp = (e) => {
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
      else if (c.own && (c.kind === 'army' || c.kind === 'fleet') && c.tile != null && onSelectArmy && gameState.regions[gameState.world?.tileOwner?.[c.tile]]?.tile !== c.tile) onSelectArmy(c.tile);
      else onSelectRegion?.(c.regionId);
      return;
    }
    if (pick.kind === 'settler') { onSelectTile?.(pick.tile); return; }
    if (pick.kind === 'city') { handleCityTap(pick.id, e, sx, sy); return; }
    if (!onSelectTile) return;
    if (pick.tile == null || pick.tile < 0) { onSelectTile(null); return; }
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
      pickAt: (x, y) => { const p = tapAtRef.current(x, y); return p ? { kind: p.kind, id: p.id ?? null, tile: p.tile ?? null, land: p.land ?? null, explored: p.explored ?? null, via: p.via ?? null, marker: p.marker?.kind ?? null, own: p.marker?.own ?? null } : null; },
      transform: () => ({ ...transformRef.current })
    };
    window.__glMap = { info: () => ({ ...gl.current.renderer.info.render, frames: gl.current.frames, territory: gl.current.lastTerritory }), renderer: gl.current?.renderer };
    return () => { delete window.__map2DTest; delete window.__glMap; };
  }, [hudOffset, projection, state, selectedRegion, focusOnLatLng, view, ready]);

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
        <canvas ref={canvasRef} data-testid="gl-map" style={{ width, height, display: 'block' }} />
      </div>
      {!prefersReducedMotion() && <EffectsLayer effects={effects} getProjector={getProjector} width={width} height={height} ageId={state.age} testId="map2d-effects" />}
      <div style={{ right: insets.right + 8 }} className={`absolute z-10 flex flex-col bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 shadow-xl overflow-hidden ${hudOffset ? 'top-[calc(var(--header-height,4.5rem)+3rem)]' : 'top-12'}`}>
        <button onClick={() => zoomBy(ZOOM_STEP_SCALE)} disabled={kNow >= ZOOM_MAX} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Zoom in">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => zoomBy(1 / ZOOM_STEP_SCALE)} disabled={kNow <= minK} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border-t border-slate-700 disabled:opacity-30 disabled:hover:bg-transparent" title="Zoom out">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button onClick={resetZoom} disabled={kNow <= minK} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border-t border-slate-700 disabled:opacity-30 disabled:hover:bg-transparent" title="Reset view">
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default GLMapView;
