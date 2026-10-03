// src/components/map/Map2DView.jsx
// The flat world map on the tile world (plans/civ-map-rework.md, B4b, B5 and workstream 3.4): the
// realistic Earth raster underneath, one translucent territory per city (src/data/geo/
// cityFeatures.js, clipped to the real coastline), nation borders as one line, city borders
// dotted from region zoom, the hex mesh as a faint overlay from local zoom, and a badge per city
// with its size. Shares the selectedRegion/onSelectRegion contract and the colour rules
// (src/utils/mapRegionStyle.js) with GlobeView, so switching views never changes what a colour
// means, only how the world is projected.
//
// Rendered as one <path> per city in a single <svg>. The path strings are memoized on
// [width, height, territories]; fill and stroke are computed per render (a couple of lookups).
import React, { Suspense, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
// Side-effect only: registers `.transition()` on d3-selection selections, which zoomBy/resetZoom
// below use for a smooth animated zoom on button click (d3-zoom's own drag/wheel handling doesn't
// need this — only the button-driven `.call(behavior.scaleBy, ...)` path does).
import 'd3-transition';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { REGIONS_DATA } from '../../data/regions';
import { REGION_COORDINATES } from '../../data/regionCoordinates';
import { loadCountryFeatures } from '../../data/geo/loadWorldFeatures';
import { getCityFeatures, getNationTerritories, getHexMeshWithin, cityLatLon, getTileFeature, tileAtLatLon } from '../../data/geo/cityFeatures';
import { getTiles } from '../../data/geo/tiles';
import { isSettler } from '../../engine/settlers';
import { useMarch } from './MarchContext';
import { wallsOf } from '../../engine/sieges';
import { loyaltyOf } from '../../engine/loyalty';
import { OUTPOST_DONE } from '../../engine/settlers';
import { getNationColor } from '../../data/nationColors';
import { useEffects } from '../../context/EffectsContext';
import { useMapInsets } from '../../context/MapInsetsContext';
import Map2DMarkersOverlay from './Map2DMarkersOverlay';
// The close view (plan §4f): three.js towns and soldiers from CLOSE_ZOOM_K up, loaded on first use.
const CloseViewLayer = React.lazy(() => import('./closeView/CloseViewLayer'));
export const CLOSE_ZOOM_K = 10;
import Map2DEffectsOverlay from './Map2DEffectsOverlay';
import { getEffectPeekDuration } from '../../hooks/useAutoPeek';
import { tapCandidates, tapRingPoints } from '../../utils/regionClickAssist';
import { getAtWarNationIds, getRegionFillColor, getRegionStrokeColor } from '../../utils/mapRegionStyle';
import { worldRasterUrl, worldRasterSizeFor, withAlpha } from '../../data/geo/worldRaster';
import { yieldLabels, loyaltyDiscs, threatStacks, supplyTints, estateTints, tradeLines, airCover } from './lenses';

const OCEAN_COLOR = '#0f172a'; // matches GlobeView's OCEAN_COLOR / backgroundColor
// How much of the terrain raster shows through a nation's colour on land.
const POLITICAL_ALPHA = 0.45;
// The hex mesh shows from this zoom (B5's local view), city borders and names from this one.
const HEX_FROM_ZOOM = 3;
const CITY_DETAIL_ZOOM = 2.5;
// Max raised from 8x to 40x (plan feedback: playing as a small nation like Israel, its provinces
// stayed too small/overlapping to reliably tell apart and click even at old max zoom). Stroke width
// already divides by transform.k and SVG hit-testing already scales with the <g transform>, so no
// other change is needed for click accuracy at high zoom.
const ZOOM_EXTENT = [1, 40];
// Phones and tablets may zoom twice as far (plan §3): small provinces need it under a fingertip.
const TOUCH_ZOOM_EXTENT = [1, 80];
const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const ZOOM_STEP_SCALE = 1.6;
// Plan feedback: the flat map's default view (fitSize-to-whole-world at k=1) leaves huge dead
// space above/below the map on a tall/narrow (mobile) viewport, since the world's ~2:1 aspect
// ratio is much wider than a phone screen. GlobeView.jsx already opens centered on the player's
// capital at a reasonable altitude (its own `home` pointOfView effect) — this mirrors that same
// idea for the flat map instead of always starting fully zoomed out.
const INITIAL_FOCUS_ZOOM = 5;
// d3-zoom's view triple is [centerX, centerY, visibleWidth]; interpolating each linearly pans in a
// straight line and scales steadily (see the .interpolate() call below for why).
const linearViewInterpolate = (a, b) => (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// `interactive: false` is the minimap's own mode: no click handling, no hover title, no zoom/pan
// (see below), and a slightly thinner/absent stroke so a few thousand paths stay cheap to render
// at a tiny size. Reads its territories from game state (cityFeatures.js caches them) rather than taking them as
// a prop — that loader already caches at the module level (see its own file), so a second
// Map2DView instance (the minimap, alongside the main flat map) re-fetches nothing.
// `hudOffset` (default false, preserving the original tuned offset for MapModal's own compact
// title bar / the minimap) shifts the zoom controls down below GameHeader's real, responsive
// height via its --header-height custom property — only the main full-bleed map view
// (MapContainer -> Map2DContainer) needs this, since MapModal's own header isn't GameHeader.
// `initialFocusRegionId` (only meaningful alongside `interactive`) centers the map on that
// region once, on first load, at `INITIAL_FOCUS_ZOOM` instead of the whole-world default — see
// the constant's own comment above. `focusRegionId` is a SEPARATE, ongoing focus target (the
// region ProvinceModal/"Manage Region" is currently open for, or null) — see its own effect below
// for why this needs to be distinct from the once-only initial focus. `navigateTarget`
// (`{lat, lng} | null`, a freshly-created object every time so re-navigating to the exact same
// spot still re-triggers) is MiniMap.jsx's own "click/drag to navigate" request. `onViewportChange`
// reports this view's current visible lat/lng extent (as `{centerLat, centerLng, halfWidthDeg,
// halfHeightDeg}`) so MiniMap.jsx can draw a real "you are here" rectangle — see MiniMap.jsx's own
// header for the shared contract GlobeView.jsx also reports in.
const Map2DView = ({
  onAmbiguousTap = null, width, height, selectedRegion, onSelectRegion, interactive = true, hudOffset = false,
  initialFocusRegionId = null, focusRegionId = null, navigateTarget = null, onViewportChange = null, selectedTile = null, onSelectTile = null, onSelectArmy = null, lens = 'political'
}) => {
  const { state } = useGame();
  const { effects } = useEffects();
  // Only the main full-bleed map (hudOffset) sits under the game's floating panels; MapModal's and
  // the minimap's own Map2DView instances are in their own boxes and ignore the insets.
  const rawInsets = useMapInsets();
  const insets = hudOffset ? rawInsets : { top: 0, bottom: 0, left: 0, right: 0 };
  const svgRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const appliedInitialFocusRef = useRef(false);
  const [transform, setTransform] = useState(zoomIdentity);

  // The real coastline cuts every territory (B4b: never a hex edge along a coast); until it has
  // loaded the raw hex territories show.
  const [land, setLand] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadCountryFeatures().then((f) => { if (!cancelled) setLand(f); });
    return () => { cancelled = true; };
  }, []);
  // Territories follow ownership: rebuilt only when a tile changes hands (cityFeatures.js caches
  // on the tileOwner object's identity).
  const tileOwner = state.world?.tileOwner || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const polygons = useMemo(() => getCityFeatures(state, land), [tileOwner, land]);

  // The whole sphere, so the raster and every path share one pixel space at every zoom.
  const projection = useMemo(() => {
    if (width <= 0 || height <= 0) return null;
    return geoEquirectangular().fitSize([width, height], { type: 'Sphere' });
  }, [width, height]);
  // Nation borders (B4): the outline of each nation's land.
  const nationBorderPath = useMemo(() => {
    if (!projection) return null;
    const pathGen = geoPath(projection);
    return getNationTerritories(state, land).map((f) => pathGen(f)).filter(Boolean).join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection, tileOwner, land, state.regions]);
  // The hex mesh for the part of the world on screen (plus a margin), rebuilt when the view
  // moves by about a cell or zooms a step; the whole world's mesh is far too heavy to paint.
  const hexWindow = useMemo(() => {
    if (!projection || !interactive || transform.k < HEX_FROM_ZOOM || width <= 0 || height <= 0) return null;
    const toWorld = (sx, sy) => projection.invert([(sx - transform.x) / transform.k, (sy - transform.y) / transform.k]);
    const a = toWorld(-width * 0.25, -height * 0.25); const b = toWorld(width * 1.25, height * 1.25);
    if (!a || !b) return null;
    const q = (v) => Math.round(v / 2) * 2; // 2-degree steps keep the key stable while panning
    return { west: q(Math.max(-180, a[0])), east: q(Math.min(180, b[0])), north: q(Math.min(90, a[1])), south: q(Math.max(-90, b[1])) };
  }, [projection, interactive, transform, width, height]);
  const hexKey = hexWindow ? `${hexWindow.west},${hexWindow.east},${hexWindow.south},${hexWindow.north}` : '';
  const hexPath = useMemo(() => (hexWindow && projection ? geoPath(projection)(getHexMeshWithin(hexWindow)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hexKey, projection]);

  // Where the equirectangular raster sits in the projection's pixel space: the whole world
  // rectangle, so it lines up with the province paths at every zoom.
  const rasterRect = useMemo(() => {
    if (!projection) return null;
    const [x0, y0] = projection([-180, 90]); const [x1, y1] = projection([180, -90]);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }, [projection]);

  const pathsById = useMemo(() => {
    if (!projection) return null;
    const pathGen = geoPath(projection);
    const map = new Map();
    polygons.forEach((feature) => {
      const gameRegionId = feature.properties?.gameRegionId;
      if (!gameRegionId) return;
      map.set(gameRegionId, pathGen(feature));
    });
    return map;
  }, [projection, polygons]);
  // A plain boolean (not the Map itself) for the zoom effect's dependency array below — react-
  // hooks/exhaustive-deps wants a simple, statically-checkable expression there, not an inline
  // `!!pathsById`.
  const hasMap = pathsById !== null;

  // Wheel-to-zoom, drag-to-pan, and native pinch-to-zoom on touch — d3-zoom handles all three
  // uniformly rather than hand-rolling separate wheel/touch listeners. Only wired for the real
  // map (interactive), never the tiny non-interactive minimap thumbnail. The behavior instance is
  // kept in a ref so the +/-/reset buttons below can drive the exact same zoom (`.scaleBy`/
  // `.transform` on the current selection) instead of fighting it with separate state.
  // `hasMap` is in the dependency list (not read inside the effect) purely so this re-runs the
  // moment the <svg> actually mounts: while `pathsById` is still null the component renders the
  // "Loading world map…" placeholder instead, so svgRef.current is null and this would otherwise
  // never attach — `interactive`/`width`/`height` are all already stable by the time loading
  // finishes.
  useEffect(() => {
    if (!interactive || !svgRef.current || width <= 0 || height <= 0) return undefined;
    const behavior = d3zoom()
      // Linear view interpolation for button/programmatic transitions instead of d3's default
      // "smooth zoom" (interpolateZoom), which zooms OUT then back in on any pan. Re-centring on an
      // effect and on a sheet peeking can interrupt each other, and an interrupted smooth zoom
      // left the map stuck zoomed out exactly while the animation was playing.
      .interpolate(linearViewInterpolate)
      .scaleExtent(isTouchDevice() ? TOUCH_ZOOM_EXTENT : ZOOM_EXTENT)
      .translateExtent([[0, 0], [width, height]])
      .on('zoom', (event) => setTransform(event.transform));
    zoomBehaviorRef.current = behavior;
    const selection = select(svgRef.current);
    selection.call(behavior);
    return () => { selection.on('.zoom', null); };
  }, [interactive, width, height, hasMap]);

  // Shared by every focus/navigate effect below: pans/zooms the real d3 zoom behavior to center a
  // given lat/lng on screen (so scaleExtent/translateExtent clamp it exactly like any other zoom,
  // instead of just seeding React state directly). Returns whether it actually applied —
  // `projection`/`zoomBehaviorRef` aren't ready on the very first render (polygons load
  // asynchronously), so the initial-focus effect below needs to know the difference between
  // "applied" and "silently no-op'd because it wasn't ready yet" to know whether it's safe to mark
  // itself done.
  // Plan §5.1: centred in the part of the screen the floating panels DON'T cover (MapInsetsContext)
  // — the screen's own centre sits under the Manage Region sheet on a phone. `animate` smooths the
  // move for effect/focus pans; the one-time initial focus stays instant.
  const focusOnLatLng = useCallback((lat, lng, k = INITIAL_FOCUS_ZOOM, animate = false) => {
    if (!projection || !zoomBehaviorRef.current || !svgRef.current) return false;
    const [px, py] = projection([lng, lat]);
    const visibleCenterX = insets.left + (width - insets.left - insets.right) / 2;
    const visibleCenterY = insets.top + (height - insets.top - insets.bottom) / 2;
    const desired = zoomIdentity.translate(visibleCenterX - px * k, visibleCenterY - py * k).scale(k);
    const selection = select(svgRef.current);
    (animate ? selection.transition().duration(450) : selection).call(zoomBehaviorRef.current.transform, desired);
    return true;
  }, [projection, width, height, insets.left, insets.right, insets.top, insets.bottom]);

  const focusOnRegionId = useCallback((targetRegionId, k = INITIAL_FOCUS_ZOOM, animate = false) => {
    const focusCoords = REGION_COORDINATES[targetRegionId];
    if (!focusCoords) return false;
    return focusOnLatLng(focusCoords.lat, focusCoords.lng, k, animate);
  }, [focusOnLatLng]);

  // Runs once (see appliedInitialFocusRef) — but only marks itself done once focusOnRegionId
  // actually applied, not on a first attempt that no-op'd because `projection`/the zoom behavior
  // weren't ready yet (both depend on the async polygon fetch above). Bug fix: an earlier version
  // set the ref BEFORE calling focusOnRegionId, so a too-early first attempt (before polygons had
  // loaded) permanently skipped every later, real attempt once `focusOnRegionId`'s reference
  // updated with the real projection — the map never actually recentered.
  useEffect(() => {
    if (!interactive || appliedInitialFocusRef.current) return;
    if (!initialFocusRegionId) return;
    if (focusOnRegionId(initialFocusRegionId)) appliedInitialFocusRef.current = true;
  }, [interactive, initialFocusRegionId, focusOnRegionId]);

  // Bug fix (plan feedback: "on army tab u see in map sweden and not the selected region"):
  // opening ProvinceModal ("Manage Region") never moved the map at all, so wherever the player had
  // last panned/zoomed to stayed on screen behind it — completely unrelated to the region actually
  // being managed. MapContainer.jsx passes `focusRegionId` = the region ProvinceModal is currently
  // open for (null otherwise), so this re-centers there the moment Manage Region opens, independent
  // of which of its tabs is active (switching tabs doesn't change `focusRegionId`). Deliberately
  // separate from the once-only initial-focus effect above: this one is meant to re-fire every time
  // a different region is opened for management, not just on first mount.
  // The flat map used to ignore action effects entirely (plan §5.4). Like GlobeView's camera, it now
  // pans to each new effect's target (keeping any deeper zoom the player already chose) so the
  // Map2DEffectsOverlay animation below plays in view. While that effect is still playing it stays
  // the thing to keep centred — `followRef` — even as a sheet peeks/restores and the visible band
  // moves (the re-centre effect below).
  const lastEffectIdRef = useRef(effects.length ? effects[effects.length - 1].id : null);
  const followRef = useRef(null); // { lat, lng, k, until }
  useEffect(() => {
    if (!interactive) return;
    const latest = effects[effects.length - 1];
    if (!latest || latest.id === lastEffectIdRef.current) return;
    lastEffectIdRef.current = latest.id;
    const target = REGION_COORDINATES[latest.toRegionId];
    if (!target) return;
    const k = Math.max(transform.k, INITIAL_FOCUS_ZOOM);
    followRef.current = { lat: target.lat, lng: target.lng, k, until: Date.now() + getEffectPeekDuration(latest.actionType) };
    focusOnLatLng(target.lat, target.lng, k, true);
    // transform.k intentionally omitted — same reasoning as the navigateTarget effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, effects, focusOnLatLng]);

  // Re-centres whenever the managed region changes OR the visible band moves (focusOnLatLng's
  // identity changes with the insets — a sheet opening, peeking or restoring): a live effect's
  // target first, otherwise the region Manage Region is open for.
  useEffect(() => {
    if (!interactive) return;
    const follow = followRef.current;
    if (follow && Date.now() < follow.until) {
      focusOnLatLng(follow.lat, follow.lng, follow.k, true);
      return;
    }
    if (focusRegionId) focusOnRegionId(focusRegionId, INITIAL_FOCUS_ZOOM, true);
  }, [interactive, focusRegionId, focusOnRegionId, focusOnLatLng]);

  // MiniMap.jsx's "click/drag to navigate" request — a raw lat/lng rather than a region, and (per
  // navigateTarget's own doc comment above) a freshly-created object every time so clicking the
  // same spot on the minimap twice in a row still re-centers there (nothing else about the view
  // may have changed in between, so a same-reference check would otherwise skip the second one).
  useEffect(() => {
    if (!interactive || !navigateTarget) return;
    focusOnLatLng(navigateTarget.lat, navigateTarget.lng, Math.max(transform.k, INITIAL_FOCUS_ZOOM), true);
    // transform.k intentionally omitted from deps — reading "current zoom, if already zoomed in
    // further than the default" at the moment of navigation is exactly what's wanted here; this
    // must NOT re-fire just because the resulting pan changes transform.k.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, navigateTarget, focusOnLatLng]);

  // Reports this view's own visible lat/lng extent so MiniMap.jsx can draw a real "you are here"
  // rectangle — see the component's own doc comment above for the shared `{centerLat, centerLng,
  // halfWidthDeg, halfHeightDeg}` contract GlobeView.jsx also reports in. Inverts the four corners
  // of the current [0,width]x[0,height] screen-space viewport through the same transform+projection
  // used to render everything else, so this is always exactly what's actually on screen (not an
  // approximation, unlike the globe's spherical-cap version of this same contract).
  useEffect(() => {
    if (!onViewportChange || !projection || width <= 0 || height <= 0) return;
    const toWorld = (sx, sy) => [(sx - transform.x) / transform.k, (sy - transform.y) / transform.k];
    const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([sx, sy]) => projection.invert(toWorld(sx, sy)));
    const lngs = corners.map((c) => c[0]);
    const lats = corners.map((c) => c[1]);
    const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
    onViewportChange({
      centerLng: (minLng + maxLng) / 2, centerLat: (minLat + maxLat) / 2,
      halfWidthDeg: (maxLng - minLng) / 2, halfHeightDeg: (maxLat - minLat) / 2
    });
  }, [onViewportChange, projection, transform, width, height]);

  const zoomBy = useCallback((factor) => {
    if (!zoomBehaviorRef.current || !svgRef.current) return;
    select(svgRef.current).transition().duration(200).call(zoomBehaviorRef.current.scaleBy, factor);
  }, []);
  const resetZoom = useCallback(() => {
    if (!zoomBehaviorRef.current || !svgRef.current) return;
    select(svgRef.current).transition().duration(200).call(zoomBehaviorRef.current.transform, zoomIdentity);
  }, []);

  const atWarNationIds = useMemo(() => getAtWarNationIds(state.wars, state.playerNationId), [state.wars, state.playerNationId]);

  const handleClick = useCallback((gameRegionId, event) => {
    if (!interactive) return;
    // A fingertip covers several small provinces: ask which one (plan §3, RegionChooser).
    if (event?.nativeEvent?.pointerType === 'touch' && onAmbiguousTap && typeof document.elementsFromPoint === 'function') {
      const { clientX: x, clientY: y } = event;
      const hits = tapRingPoints(x, y).map(([px, py]) => document.elementsFromPoint(px, py).find((el) => el.dataset?.regionId)?.dataset.regionId);
      const ids = tapCandidates(hits);
      if (ids.length > 1) { onAmbiguousTap({ x, y, ids }); return; }
    }
    onSelectRegion(gameRegionId === selectedRegion ? null : gameRegionId);
  }, [interactive, onSelectRegion, selectedRegion, onAmbiguousTap]);

  // The ~4,482 province <path>s are memoized on everything EXCEPT the pan offset: a pan (drag, the
  // minimap, or the smooth re-centring on an effect/sheet change) only moves the parent <g>'s
  // transform, so React doesn't re-diff every path on every animation frame. Zoom level (k) stays a
  // dependency because stroke width is divided by it. Before this, each frame of a d3 pan
  // transition re-rendered all 4,482 paths — janky on a phone and the dominant cost of every pan.
  const zoomK = transform.k;
  const pathElements = useMemo(() => {
    if (!pathsById) return null;
    return (
      [...pathsById.entries()].map(([gameRegionId, d]) => {
        if (!d) return null;
        // Translucent over the terrain raster (plans/civ-map-rework.md B4b): the land shows through.
        const fill = withAlpha(getRegionFillColor(state.regions, state.playerNationId, gameRegionId), POLITICAL_ALPHA);
        const stroke = interactive
          ? getRegionStrokeColor(state.regions, state.playerNationId, gameRegionId, selectedRegion, atWarNationIds)
          : 'rgba(0,0,0,0.4)';
        // Divided by the current zoom scale so the stroke's SCREEN width stays constant as the
        // map zooms in.
        const plain = stroke === '#000000';
        const strokeWidth = (gameRegionId === selectedRegion ? 1.5 : plain ? 0.5 : 0.8) / zoomK;
        // City borders inside a nation show as a faint solid line from region zoom and not at all
        // farther out (the nation borders carry the map there). Never dashed: a dash pattern on
        // 240 coastline paths wedged the rasterizer for good under software rendering.
        const faint = interactive && plain && zoomK >= CITY_DETAIL_ZOOM;
        return (
          <path
            key={gameRegionId}
            d={d}
            fill={fill}
            stroke={interactive && plain && !faint ? 'none' : faint ? 'rgba(255,255,255,0.35)' : stroke}
            strokeWidth={strokeWidth}
            pointerEvents="fill"
            data-region-id={gameRegionId}
            onClick={interactive ? (e) => handleClick(gameRegionId, e) : undefined}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            {interactive && <title>{REGIONS_DATA[gameRegionId]?.name || gameRegionId}</title>}
          </path>
        );
      })
    );
  }, [pathsById, state.regions, state.playerNationId, interactive, selectedRegion, atWarNationIds, handleClick, zoomK]);

  // War borders, the flat-map twin of the globe's red outline: every province of a nation you're at
  // war with gets a thick red stroke, then its fill is painted again on top. Between two enemy
  // provinces both halves of the stroke are covered, so only the nation's OUTER border stays red —
  // a band just outside it that a neighbour's black edge can't paint over (a hairline red stroke in
  // the base pass was drawn under the next province's black one, so it barely showed). Pure
  // decoration: pointer-events none, so taps still reach the provinces underneath.
  const warBorderElements = useMemo(() => {
    if (!pathsById || !atWarNationIds.size) return null;
    const enemy = [...pathsById.entries()].filter(([id, d]) => d && atWarNationIds.has(state.regions[id]?.owner));
    if (!enemy.length) return null;
    const band = 3.4 / zoomK; // half of it shows: ~1.7px outside the border
    const hair = 0.4 / zoomK;
    return (
      <g pointerEvents="none" data-testid="war-borders">
        {enemy.map(([id, d]) => <path key={`wb-${id}`} d={d} fill="none" stroke="#ef4444" strokeWidth={band} strokeLinejoin="round" />)}
        {enemy.map(([id, d]) => (
          <path key={`wf-${id}`} d={d} fill={withAlpha(getRegionFillColor(state.regions, state.playerNationId, id), POLITICAL_ALPHA)} stroke={id === selectedRegion ? '#2563eb' : 'rgba(127,29,29,0.55)'} strokeWidth={id === selectedRegion ? 1.5 / zoomK : hair} />
        ))}
      </g>
    );
  }, [pathsById, atWarNationIds, state.regions, state.playerNationId, selectedRegion, zoomK]);

  // Load the close view a little before it is needed, then keep it (one WebGL context for good).
  const [closeLoaded, setCloseLoaded] = useState(false);
  useEffect(() => { if (interactive && transform.k >= CLOSE_ZOOM_K * 0.7) setCloseLoaded(true); }, [interactive, transform.k]);

  // A tapped marker cluster: zoom in on it until its banners separate.
  const zoomToRegion = useCallback((regionId) => {
    const c = REGION_COORDINATES[regionId];
    if (!c) return;
    const max = (isTouchDevice() ? TOUCH_ZOOM_EXTENT : ZOOM_EXTENT)[1];
    focusOnLatLng(c.lat, c.lng, Math.min(max, Math.max(transform.k * 2.5, INITIAL_FOCUS_ZOOM)), true);
  }, [focusOnLatLng, transform.k]);

  // A tap on open land (no city path under it) selects the tile for the tile sheet. A drag is
  // not a tap: d3-zoom moves the map, and the pointer travels.
  const tapRef = useRef(null);
  const onPointerDown = useCallback((e) => { tapRef.current = { x: e.clientX, y: e.clientY }; }, []);
  const onPointerUp = useCallback((e) => {
    const start = tapRef.current; tapRef.current = null;
    if (!interactive || !onSelectTile || !start || !projection || !svgRef.current) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
    if (e.target.closest?.('[data-region-id],[data-city-badge],button')) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left - transform.x) / transform.k; const py = (e.clientY - rect.top - transform.y) / transform.k;
    const ll = projection.invert([px, py]);
    if (!ll) return;
    const tile = tileAtLatLon(ll[1], ll[0]);
    if (tile == null || tile < 0) { onSelectTile(null); return; }
    onSelectTile(tile === selectedTile ? null : tile);
  }, [interactive, onSelectTile, projection, transform, selectedTile]);
  const selectedTilePath = useMemo(() => (projection && selectedTile != null ? geoPath(projection)(getTileFeature(selectedTile)) : null), [projection, selectedTile]);

  // The lens layer (lenses.js): yields on your tiles, loyalty discs, threat circles, supply tints.
  const lensElements = useMemo(() => {
    if (!interactive || !projection || lens === 'political') return null;
    const tiles = getTiles();
    const pathGen = geoPath(projection);
    const at = (t) => { const { lat, lon } = tiles.latLonOf(t); return projection([lon, lat]); };
    if (lens === 'yields') {
      if (zoomK < HEX_FROM_ZOOM) return null;
      return yieldLabels(state).map((y) => { const [x, yy] = at(y.tile); return (
        <text key={y.tile} x={x} y={yy} textAnchor="middle" fontSize={9 / zoomK} fontWeight="700" fill={y.worked ? '#fef3c7' : '#cbd5e1'} stroke="rgba(0,0,0,0.75)" strokeWidth={2 / zoomK} paintOrder="stroke" pointerEvents="none" data-lens-yield={y.tile}>{`${y.food}·${y.production}·${y.gold}`}</text>
      ); });
    }
    if (lens === 'loyalty') return loyaltyDiscs(state).map((d) => { const [x, y] = at(d.tile); return <circle key={d.cityId} cx={x} cy={y} r={14 / Math.sqrt(zoomK)} fill={d.colour} fillOpacity={0.45} stroke={d.colour} strokeWidth={1 / zoomK} pointerEvents="none" data-lens-loyalty={d.cityId} />; });
    if (lens === 'threat') return [...airCover(state).map((a) => { const [x, y] = at(a.tile); const [ex, ey] = at(a.edgeTile); const r = Math.max(6 / zoomK, Math.hypot(ex - x, ey - y)); const c = a.own ? '#60a5fa' : '#f87171'; return (
      <g key={`air:${a.tile}:${a.nationId}`} pointerEvents="none" data-lens-air={a.tile} data-own={a.own ? '1' : '0'}><circle cx={x} cy={y} r={r} fill={c} fillOpacity={0.08} stroke={c} strokeWidth={1 / zoomK} strokeDasharray={`${6 / zoomK} ${4 / zoomK}`} /><text x={x} y={y - 10 / zoomK} textAnchor="middle" fontSize={9 / zoomK} fontWeight="700" fill={c} stroke="rgba(0,0,0,0.75)" strokeWidth={2 / zoomK} paintOrder="stroke">{`✈ ${a.count}`}</text></g>); }),
    ...threatStacks(state).map((s) => { const [x, y] = at(s.tile); const [ex, ey] = at(s.edgeTile); const r = Math.max(6 / zoomK, Math.hypot(ex - x, ey - y)); return (
      <g key={s.tile} pointerEvents="none" data-lens-threat={s.tile}>
        <circle cx={x} cy={y} r={r} fill="rgba(239,68,68,0.14)" stroke="rgba(239,68,68,0.6)" strokeWidth={1 / zoomK} strokeDasharray={`${4 / zoomK} ${3 / zoomK}`} />
        <text x={x} y={y - r - 2 / zoomK} textAnchor="middle" fontSize={10 / zoomK} fontWeight="700" fill="#fca5a5" stroke="rgba(0,0,0,0.75)" strokeWidth={2 / zoomK} paintOrder="stroke">{s.strength.toLocaleString()}</text>
      </g>
    ); })];
    if (lens === 'supply') return supplyTints(state).map((t) => <path key={t.tile} d={pathGen(getTileFeature(t.tile))} fill={t.colour} stroke="none" pointerEvents="none" data-lens-supply={t.tile} />);
    if (lens === 'estates') return estateTints(state).map((t) => { const [x, y] = at(t.tile); return (
      <g key={t.tile} pointerEvents="none" data-lens-estate={t.tile} data-estate={t.estateId}>
        <path d={pathGen(getTileFeature(t.tile))} fill={t.colour} stroke="none" />
        {zoomK >= HEX_FROM_ZOOM && <text x={x} y={y + 3 / zoomK} textAnchor="middle" fontSize={9 / zoomK} fontWeight="700" fill="#fff" stroke="rgba(0,0,0,0.7)" strokeWidth={2 / zoomK} paintOrder="stroke">{t.crest}</text>}
      </g>
    ); });
    if (lens === 'trade') return tradeLines(state).map((r) => {
      const pts = r.tiles.map((t) => at(t));
      const colour = r.plundered ? '#f87171' : r.kind === 'sea' ? '#38bdf8' : '#fbbf24';
      const mark = r.plunderTile != null ? at(r.plunderTile) : null;
      return (
        <g key={r.partnerId} pointerEvents="none" data-lens-trade={r.partnerId} data-plundered={r.plundered ? '1' : '0'}>
          {pts.length > 1 && <polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={colour} strokeWidth={2.5 / zoomK} strokeDasharray={r.kind === 'sea' ? `${6 / zoomK} ${4 / zoomK}` : undefined} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />}
          {mark && <circle cx={mark[0]} cy={mark[1]} r={7 / Math.sqrt(zoomK)} fill="rgba(248,113,113,0.35)" stroke="#f87171" strokeWidth={1.5 / zoomK} />}
        </g>
      );
    });
    return null;
  }, [interactive, projection, lens, state, zoomK]);
  // Marks of the last battles on the ground (fieldBattle.js) at the detail zoom.
  const battleMarkElements = useMemo(() => {
    if (!interactive || !projection || zoomK < CITY_DETAIL_ZOOM) return null;
    const tiles = getTiles();
    return Object.entries(state.world?.tileState || {}).filter(([, v]) => v.wonder || (v.battle && v.battle.until >= state.turnNumber)).map(([t, v]) => {
      const { lat, lon } = tiles.latLonOf(Number(t)); const [x, y] = projection([lon, lat]);
      if (v.wonder) return <text key={t} x={x} y={y} textAnchor="middle" fontSize={12 / zoomK} fill="#fde68a" stroke="rgba(0,0,0,0.75)" strokeWidth={2 / zoomK} paintOrder="stroke" pointerEvents="none" data-wonder-mark={t}>★</text>;
      return <text key={t} x={x} y={y} textAnchor="middle" fontSize={11 / zoomK} fill={v.battle.outcome === 'attacker' ? '#fda4af' : '#cbd5e1'} stroke="rgba(0,0,0,0.75)" strokeWidth={2 / zoomK} paintOrder="stroke" pointerEvents="none" data-battle-mark={t}>⚔</text>;
    });
  }, [interactive, projection, zoomK, state.world, state.turnNumber]);
  // March lines (plan §4g, on tiles since workstream 5): the marches under way and the one being
  // planned, over the tile centres, with the turn number where each turn's march ends.
  const marchCtx = useMarch();
  const marchLines = marchCtx?.lines;
  const marchElements = useMemo(() => {
    if (!interactive || !projection || !marchLines?.length) return null;
    const tiles = getTiles();
    const pt = (t) => { const { lat, lon } = tiles.latLonOf(t); return projection([lon, lat]); };
    const w = 2.2 / Math.sqrt(zoomK);
    return marchLines.map((l) => {
      const pts = l.points.map(pt).filter(Boolean);
      if (pts.length < 2) return null;
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
      const preview = l.kind === 'preview';
      const colour = preview ? '#fde68a' : l.halted ? '#f87171' : '#34d399';
      return (
        <g key={l.key} pointerEvents="none" data-march-line={l.kind}>
          <path d={d} fill="none" stroke="rgba(15,23,42,0.7)" strokeWidth={w * 2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={d} fill="none" stroke={colour} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={preview ? `${w * 3} ${w * 2}` : undefined} />
          {l.marks.map((m) => { const p = pts[m.index]; if (!p) return null; const r = 6 / Math.sqrt(zoomK); return (
            <g key={m.index} transform={`translate(${p[0]},${p[1]})`}>
              <circle r={r} fill={colour} stroke="rgba(15,23,42,0.8)" strokeWidth={w * 0.6} />
              <text y={r * 0.38} textAnchor="middle" fontSize={r * 1.2} fontWeight="700" fill="#0f172a">{m.turn}</text>
            </g>); })}
          {l.haltIndex > 0 && pts[l.haltIndex] && <circle cx={pts[l.haltIndex][0]} cy={pts[l.haltIndex][1]} r={5 / Math.sqrt(zoomK)} fill="none" stroke="#f87171" strokeWidth={w} />}
        </g>
      );
    });
  }, [interactive, projection, marchLines, zoomK]);
  // Settlers stand on tiles, not in cities: a tent per settler (yours, and others' near your land).
  const settlerElements = useMemo(() => {
    if (!interactive || !projection) return null;
    const tiles = getTiles();
    return Object.values(state.units).filter((u) => isSettler(u) && u.tile != null && (u.ownerId === state.playerNationId || zoomK >= 2)).map((u) => {
      const { lat, lon } = tiles.latLonOf(u.tile);
      const [x, y] = projection([lon, lat]);
      const own = u.ownerId === state.playerNationId;
      const r = 5 / Math.sqrt(zoomK);
      return (
        <g key={u.id} transform={`translate(${x},${y})`} data-settler={u.id} data-own={own ? "true" : "false"} onClick={(e) => { e.stopPropagation(); onSelectTile?.(u.tile); }} style={{ cursor: 'pointer' }}>
          <polygon points={`0,${-r} ${r},${r * 0.8} ${-r},${r * 0.8}`} fill={own ? '#fde68a' : '#e2e8f0'} stroke={own ? '#92400e' : '#334155'} strokeWidth={1.2 / Math.sqrt(zoomK)} />
          {own && u.target == null && <circle r={r * 1.6} fill="none" stroke="#fde68a" strokeWidth={1 / Math.sqrt(zoomK)} strokeDasharray={`${3 / Math.sqrt(zoomK)} ${2 / Math.sqrt(zoomK)}`} />}
        </g>
      );
    });
  }, [interactive, projection, state.units, state.playerNationId, zoomK, onSelectTile]);

  // A badge per city (B5's region view): a disc with the size, the name from region zoom. Scaled
  // by 1/sqrt(zoom) so badges grow a little as the map zooms without covering the land.
  const badgeElements = useMemo(() => {
    if (!interactive || !projection) return null;
    const out = [];
    Object.values(state.regions).forEach((city) => {
      const ll = cityLatLon(state, city.id);
      if (!ll) return;
      const [x, y] = projection([ll.lng, ll.lat]);
      const colour = city.owner ? getNationColor(city.owner) : '#94a3b8';
      const r = (city.isCapital ? 5 + (city.size || 1) * 0.35 : 3.5 + (city.size || 1) * 0.3) / Math.sqrt(zoomK);
      // On-map affordances (plans/civ-map-rework.md E6): a siege arc with the HP left, a wall mark,
      // an outpost's progress ring, a red mark for a city losing its loyalty.
      const arc = (share, radius, stroke, width) => {
        const a = Math.max(0.02, Math.min(1, share)) * Math.PI * 2;
        const x1 = Math.sin(a) * radius; const y1 = -Math.cos(a) * radius;
        return <path d={`M0,${-radius} A${radius},${radius} 0 ${a > Math.PI ? 1 : 0} 1 ${x1},${y1}`} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" />;
      };
      const walls = wallsOf(city);
      const sw = 1.6 / Math.sqrt(zoomK);
      out.push(
        <g key={city.id} transform={`translate(${x},${y})`} data-city-badge={city.id} onClick={(e) => handleClick(city.id, e)} style={{ cursor: 'pointer' }}>
          <circle r={r} fill={city.id === selectedRegion ? '#fde68a' : city.outpost ? '#e2e8f0' : '#f8fafc'} stroke={colour} strokeWidth={2 / Math.sqrt(zoomK)} strokeDasharray={city.outpost ? `${2 / Math.sqrt(zoomK)} ${2 / Math.sqrt(zoomK)}` : undefined} />
          {city.isCapital && <circle r={r * 0.4} fill={colour} />}
          {city.outpost && arc(city.outpost.progress / OUTPOST_DONE, r + sw * 1.2, '#fde68a', sw)}
          {city.siege && arc(city.siege.hp / Math.max(1, city.siege.maxHp), r + sw * 1.2, '#f97316', sw)}
          {city.siege && <text y={-r - sw * 2.5} textAnchor="middle" fontSize={r * 0.9} fontWeight="700" fill="#fb923c" stroke="rgba(0,0,0,0.7)" strokeWidth={sw * 0.8} paintOrder="stroke" pointerEvents="none" data-siege-badge={city.id}>⚔</text>}
          {walls > 0 && !city.outpost && <rect x={-r * 0.9} y={r * 0.45} width={r * 1.8} height={r * 0.35} fill="#475569" stroke="#0f172a" strokeWidth={sw * 0.4} />}
          {city.owner && loyaltyOf(city) <= 25 && <circle cx={r * 0.85} cy={-r * 0.85} r={r * 0.38} fill="#ef4444" stroke="#0f172a" strokeWidth={sw * 0.4} data-loyalty-warning={city.id} />}
          {city.disaster && <text x={-r * 0.95} y={-r * 0.6} textAnchor="middle" fontSize={r * 0.9} pointerEvents="none" data-disaster-badge={city.id}>{city.disaster.kind === 'flood' ? '≈' : city.disaster.kind === 'fire' ? '🔥' : '☠'}</text>}
          {zoomK >= CITY_DETAIL_ZOOM && <text y={r * 0.38} textAnchor="middle" fontSize={r * 1.1} fontWeight="700" fill="#0f172a" pointerEvents="none">{city.size || 1}</text>}
          {zoomK >= CITY_DETAIL_ZOOM && <text y={-r - 2 / zoomK} textAnchor="middle" fontSize={11 / zoomK} fill="#fff" stroke="rgba(0,0,0,0.75)" strokeWidth={2.5 / zoomK} paintOrder="stroke" pointerEvents="none">{city.name}</text>}
        </g>
      );
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, projection, state.regions, zoomK, selectedRegion, handleClick]);

  useEffect(()=>{
    if(!interactive || !hudOffset || !polygons || !projection || window.__E2E_MAP_TEST__!==true)return undefined;
    window.__map2DTest={
      features:polygons.map((f)=>({...f,properties:{...f.properties,owner:state.regions[f.properties.gameRegionId]?.owner||null}})),selected:selectedRegion,
      focus:(lat,lng,k)=>focusOnLatLng(lat,lng,k,false),
      project:(lat,lng)=>{const [x,y]=projection([lng,lat]);return {x:transform.applyX(x),y:transform.applyY(y)};}
    };
    return ()=>{delete window.__map2DTest;};
  },[interactive,hudOffset,polygons,projection,selectedRegion,focusOnLatLng,transform,state.regions]);

  if (!pathsById) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm" style={{ background: OCEAN_COLOR }} />
    );
  }

  const map = (
    <svg
      ref={svgRef}
      data-testid={interactive && hudOffset ? 'flat-map' : undefined}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: OCEAN_COLOR, display: 'block', touchAction: interactive ? 'none' : undefined }}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
    >
      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {rasterRect && (
          <image
            href={worldRasterUrl(worldRasterSizeFor(width, height))}
            x={rasterRect.x} y={rasterRect.y} width={rasterRect.width} height={rasterRect.height}
            preserveAspectRatio="none" pointerEvents="none" data-testid="world-raster"
          />
        )}
        <g data-testid="territories">
          {pathElements}
          {nationBorderPath && <path d={nationBorderPath} fill="none" stroke="rgba(2,6,23,0.85)" strokeWidth={(zoomK < 3 ? 1.1 : 0.9) / zoomK} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" data-testid="nation-borders" />}
          {warBorderElements}
          {hexPath && zoomK >= HEX_FROM_ZOOM && <path d={hexPath} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={0.6 / zoomK} pointerEvents="none" data-testid="hex-mesh" />}
        </g>
        {lensElements && <g data-testid="lens-layer" data-lens={lens}>{lensElements}</g>}
        {battleMarkElements}
        {selectedTilePath && <path d={selectedTilePath} fill="rgba(255,255,255,0.15)" stroke="#ffffff" strokeWidth={1.6 / zoomK} pointerEvents="none" data-testid="selected-tile" />}
        {marchElements}
        {settlerElements}
        {badgeElements}
      </g>
    </svg>
  );

  if (!interactive) return map;

  return (
    <div className="relative w-full h-full">
      {map}
      {closeLoaded && (
        <Suspense fallback={null}>
          <CloseViewLayer projection={projection} transform={transform} width={width} height={height} active={transform.k >= CLOSE_ZOOM_K} />
        </Suspense>
      )}
      <Map2DMarkersOverlay projection={projection} transform={transform} width={width} height={height} onSelectRegion={onSelectRegion} onZoomTo={zoomToRegion} onSelectTile={onSelectTile} onSelectArmy={onSelectArmy} close={transform.k >= CLOSE_ZOOM_K} />
      <Map2DEffectsOverlay effects={effects} projection={projection} transform={transform} width={width} height={height} ageId={state.age} />
      <div style={{ right: insets.right + 8 }} className={`absolute z-10 flex flex-col bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 shadow-xl overflow-hidden ${hudOffset ? 'top-[calc(var(--header-height,4.5rem)+3rem)]' : 'top-12'}`}>
        <button
          onClick={() => zoomBy(ZOOM_STEP_SCALE)}
          disabled={transform.k >= (isTouchDevice() ? TOUCH_ZOOM_EXTENT : ZOOM_EXTENT)[1]}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => zoomBy(1 / ZOOM_STEP_SCALE)}
          disabled={transform.k <= ZOOM_EXTENT[0]}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border-t border-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetZoom}
          disabled={transform.k === 1 && transform.x === 0 && transform.y === 0}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border-t border-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Reset view"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Map2DView;
