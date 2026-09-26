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
// the constant's own comment above.
const Map2DView = ({
  width, height, selectedRegion, onSelectRegion, interactive = true, hudOffset = false, initialFocusRegionId = null
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

  // Runs once (see appliedInitialFocusRef), right after the zoom-behavior effect above has set
  // zoomBehaviorRef.current for the same render — applies the requested initial framing through
  // the real zoom behavior (so scaleExtent/translateExtent clamp it exactly like any other zoom)
  // instead of just seeding React state directly.
  useEffect(() => {
    if (!interactive || appliedInitialFocusRef.current) return;
    if (!initialFocusRegionId || !projection || !zoomBehaviorRef.current || !svgRef.current) return;
    appliedInitialFocusRef.current = true;
    const focusCoords = REGION_COORDINATES[initialFocusRegionId];
    if (!focusCoords) return;
    const [px, py] = projection([focusCoords.lng, focusCoords.lat]);
    const k = INITIAL_FOCUS_ZOOM;
    const desired = zoomIdentity.translate(width / 2 - px * k, height / 2 - py * k).scale(k);
    select(svgRef.current).call(zoomBehaviorRef.current.transform, desired);
  }, [interactive, initialFocusRegionId, projection, width, height]);

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
