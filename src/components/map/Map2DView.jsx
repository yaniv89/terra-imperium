// src/components/map/Map2DView.jsx
// A flat, CK3-style world map — the same real admin-1 province geometry the 3D globe uses
// (loadGameRegionFeatures), projected to a rectangle instead of a sphere via d3-geo. Shares the
// same selectedRegion/onSelectRegion contract and the same region coloring rules
// (src/utils/mapRegionStyle.js) as GlobeView, so switching map modes never changes what a color
// or outline means — only how the world is projected.
//
// Rendered as one <path> per region in a single <svg>. The expensive part (turning each feature's
// lat/lng geometry into an SVG path string) is memoized on [width, height, polygons] only; fill and
// stroke are computed per-render (cheap: a couple of object lookups), the same split GlobeView's
// own capColor/strokeColor already uses for the same reason.
import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
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
import { loadGameRegionFeatures } from '../../data/geo/loadGameRegions';
import { getAtWarNationIds, getRegionFillColor, getRegionStrokeColor } from '../../utils/mapRegionStyle';

const OCEAN_COLOR = '#0f172a'; // matches GlobeView's OCEAN_COLOR / backgroundColor
// Max raised from 8x to 40x (plan feedback: playing as a small nation like Israel, its provinces
// stayed too small/overlapping to reliably tell apart and click even at old max zoom). Stroke width
// already divides by transform.k and SVG hit-testing already scales with the <g transform>, so no
// other change is needed for click accuracy at high zoom.
const ZOOM_EXTENT = [1, 40];
const ZOOM_STEP_SCALE = 1.6;
// Plan feedback: the flat map's default view (fitSize-to-whole-world at k=1) leaves huge dead
// space above/below the map on a tall/narrow (mobile) viewport, since the world's ~2:1 aspect
// ratio is much wider than a phone screen. GlobeView.jsx already opens centered on the player's
// capital at a reasonable altitude (its own `home` pointOfView effect) — this mirrors that same
// idea for the flat map instead of always starting fully zoomed out.
const INITIAL_FOCUS_ZOOM = 5;

// `interactive: false` is the minimap's own mode: no click handling, no hover title, no zoom/pan
// (see below), and a slightly thinner/absent stroke so a few thousand paths stay cheap to render
// at a tiny size. Loads its own geometry (loadGameRegionFeatures() below) rather than taking it as
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
  width, height, selectedRegion, onSelectRegion, interactive = true, hudOffset = false,
  initialFocusRegionId = null, focusRegionId = null, navigateTarget = null, onViewportChange = null
}) => {
  const { state } = useGame();
  const [polygons, setPolygons] = useState(null);
  const svgRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const appliedInitialFocusRef = useRef(false);
  const [transform, setTransform] = useState(zoomIdentity);

  useEffect(() => {
    let cancelled = false;
    loadGameRegionFeatures().then((f) => { if (!cancelled) setPolygons(f.gameRegionFeatures); });
    return () => { cancelled = true; };
  }, []);

  // Split out from pathsById below so the initial-focus effect can reuse the exact same
  // projection to convert a region's lat/lng into the same pixel space the paths are drawn in.
  const projection = useMemo(() => {
    if (!polygons || width <= 0 || height <= 0) return null;
    return geoEquirectangular().fitSize([width, height], { type: 'FeatureCollection', features: polygons });
  }, [polygons, width, height]);

  const pathsById = useMemo(() => {
    if (!projection || !polygons) return null;
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
      .scaleExtent(ZOOM_EXTENT)
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
  const focusOnLatLng = useCallback((lat, lng, k = INITIAL_FOCUS_ZOOM) => {
    if (!projection || !zoomBehaviorRef.current || !svgRef.current) return false;
    const [px, py] = projection([lng, lat]);
    const desired = zoomIdentity.translate(width / 2 - px * k, height / 2 - py * k).scale(k);
    select(svgRef.current).call(zoomBehaviorRef.current.transform, desired);
    return true;
  }, [projection, width, height]);

  const focusOnRegionId = useCallback((targetRegionId, k = INITIAL_FOCUS_ZOOM) => {
    const focusCoords = REGION_COORDINATES[targetRegionId];
    if (!focusCoords) return false;
    return focusOnLatLng(focusCoords.lat, focusCoords.lng, k);
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
  useEffect(() => {
    if (!interactive || !focusRegionId) return;
    focusOnRegionId(focusRegionId);
  }, [interactive, focusRegionId, focusOnRegionId]);

  // MiniMap.jsx's "click/drag to navigate" request — a raw lat/lng rather than a region, and (per
  // navigateTarget's own doc comment above) a freshly-created object every time so clicking the
  // same spot on the minimap twice in a row still re-centers there (nothing else about the view
  // may have changed in between, so a same-reference check would otherwise skip the second one).
  useEffect(() => {
    if (!interactive || !navigateTarget) return;
    focusOnLatLng(navigateTarget.lat, navigateTarget.lng, Math.max(transform.k, INITIAL_FOCUS_ZOOM));
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

  const handleClick = useCallback((gameRegionId) => {
    if (!interactive) return;
    onSelectRegion(gameRegionId === selectedRegion ? null : gameRegionId);
  }, [interactive, onSelectRegion, selectedRegion]);

  if (!pathsById) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm" style={{ background: OCEAN_COLOR }}>
        {polygons ? null : 'Loading world map…'}
      </div>
    );
  }

  const map = (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: OCEAN_COLOR, display: 'block', touchAction: interactive ? 'none' : undefined }}
    >
      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {[...pathsById.entries()].map(([gameRegionId, d]) => {
          if (!d) return null;
          const fill = getRegionFillColor(state.regions, state.playerNationId, gameRegionId);
          const stroke = interactive
            ? getRegionStrokeColor(state.regions, state.playerNationId, gameRegionId, selectedRegion, atWarNationIds)
            : 'rgba(0,0,0,0.4)';
          // Divided by the current zoom scale so the stroke's SCREEN width stays constant as the
          // map zooms in — without this, an 8x zoom would render a "thin" 0.4 stroke 3.2px wide.
          const strokeWidth = (gameRegionId === selectedRegion ? 1.5 : 0.4) / transform.k;
          return (
            <path
              key={gameRegionId}
              d={d}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              onClick={interactive ? () => handleClick(gameRegionId) : undefined}
              style={interactive ? { cursor: 'pointer' } : undefined}
            >
              {interactive && <title>{REGIONS_DATA[gameRegionId]?.name || gameRegionId}</title>}
            </path>
          );
        })}
      </g>
    </svg>
  );

  if (!interactive) return map;

  return (
    <div className="relative w-full h-full">
      {map}
      <div className={`absolute right-2 z-10 flex flex-col bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 shadow-xl overflow-hidden ${hudOffset ? 'top-[calc(var(--header-height,4.5rem)+3rem)]' : 'top-12'}`}>
        <button
          onClick={() => zoomBy(ZOOM_STEP_SCALE)}
          disabled={transform.k >= ZOOM_EXTENT[1]}
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
