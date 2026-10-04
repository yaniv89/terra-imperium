// src/components/map/TileViewer.jsx
// The new map's prototype (plans/civ-map-rework.md, B4b and workstream 2). Open with `/?tileViewer`.
// The realistic Earth raster is the base; territories and borders follow the hex cell
// boundaries but are clipped to the real coastline; the hex mesh is a faint overlay from 3x zoom;
// cities are badges at cell centres. Pan, wheel and pinch zoom through d3-zoom exactly like the
// game's flat map, so these layers port into Map2DView once cities exist in the engine.
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { loadTiles } from '../../data/geo/tiles';
import { hexSizeVsF75 } from '../../data/geo/gridScale';
import { buildTerritories, buildBorders, buildHexMesh, cellFeature } from '../../data/geo/tileGeometry';
import { buildScenarioStarts, SCENARIOS, SCENARIO_IDS, DEFAULT_SCENARIO_ID } from '../../data/scenarios';
import { WORLD_NATIONS } from '../../data/worldNations';
import { loadLandFeatures } from '../../data/geo/loadWorldFeatures';
import { worldRasterUrl, worldRasterSizeFor, withAlpha } from '../../data/geo/worldRaster';

const POLITICAL_ALPHA = 0.45;
const HEX_FROM_ZOOM = 3 / hexSizeVsF75();

const useSize = () => {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
};

const TileViewer = () => {
  const [hostRef, { width, height }] = useSize();
  const svgRef = useRef(null);
  const [tiles, setTiles] = useState(null);
  const [land, setLand] = useState(null);
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const [showHex, setShowHex] = useState(true);
  const [transform, setTransform] = useState(zoomIdentity);
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadTiles().then(setTiles); loadLandFeatures().then(setLand); }, []);
  const starts = useMemo(() => (tiles ? buildScenarioStarts(tiles, scenarioId) : null), [tiles, scenarioId]);

  const projection = useMemo(() => {
    if (width <= 0 || height <= 0) return null;
    return geoEquirectangular().fitSize([width, height], { type: 'Sphere' });
  }, [width, height]);
  const path = useMemo(() => (projection ? geoPath(projection) : null), [projection]);

  const rasterRect = useMemo(() => {
    if (!projection) return null;
    const [x0, y0] = projection([-180, 90]); const [x1, y1] = projection([180, -90]);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }, [projection]);

  const landPath = useMemo(() => (land && path ? path({ type: 'FeatureCollection', features: land }) : null), [land, path]);
  const ownerOf = useCallback((i) => starts?.claimedBy.get(i) || null, [starts]);
  const territoryPaths = useMemo(() => {
    if (!tiles || !path || !starts) return [];
    return buildTerritories(tiles, ownerOf).map((f) => ({ owner: f.id, d: path(f) }));
  }, [tiles, path, starts, ownerOf]);
  const borderPath = useMemo(() => (tiles && path && starts ? path(buildBorders(tiles, ownerOf)) : null), [tiles, path, starts, ownerOf]);
  const hexPath = useMemo(() => (tiles && path ? path(buildHexMesh(tiles)) : null), [tiles, path]);
  const selectedPath = useMemo(() => (tiles && path && selected != null ? path(cellFeature(tiles, selected)) : null), [tiles, path, selected]);

  // d3-zoom, as in Map2DView: wheel, drag and pinch in one behaviour.
  useEffect(() => {
    if (!svgRef.current || width <= 0 || height <= 0) return undefined;
    const behavior = d3zoom().scaleExtent([1, 60]).translateExtent([[0, 0], [width, height]]).on('zoom', (e) => setTransform(e.transform));
    const selection = select(svgRef.current);
    selection.call(behavior);
    return () => { selection.on('.zoom', null); };
  }, [width, height]);

  const dragRef = useRef(null);
  const onPointerDown = (e) => { dragRef.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e) => {
    const d = dragRef.current; dragRef.current = null;
    if (!d || Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 5 || !tiles || !projection) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left - transform.x) / transform.k; const py = (e.clientY - rect.top - transform.y) / transform.k;
    const ll = projection.invert([px, py]);
    if (!ll) return;
    setSelected(tiles.nearest(ll[1], ll[0]));
  };

  const k = transform.k;
  const sel = selected != null && tiles ? {
    id: selected, ...tiles.latLonOf(selected), terrain: tiles.terrainOf(selected), relief: tiles.reliefOf(selected), feature: tiles.featureOf(selected),
    climate: tiles.climate[selected] >= 0 ? tiles.climateNames[tiles.climate[selected]] : null, elevation: tiles.elevation[selected],
    country: tiles.countryOf(selected), name: tiles.names[selected], river: tiles.riverNames[selected], coastal: tiles.coastal[selected] === 1,
    owner: ownerOf(selected)
  } : null;
  const landShare = tiles ? tiles.land.reduce((a, b) => a + b, 0) : 1;

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="flex flex-wrap items-center gap-3 p-2 text-xs bg-slate-900 border-b border-slate-800">
        <span className="font-semibold">New map prototype</span>
        <label className="flex items-center gap-1">Start
          <select aria-label="Scenario" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className="bg-slate-800 rounded p-1">
            {SCENARIO_IDS.map((id) => <option key={id} value={id}>{SCENARIOS[id].name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showHex} onChange={(e) => setShowHex(e.target.checked)} /> hex grid from {HEX_FROM_ZOOM}x</label>
        {starts && <span className="text-slate-400">{(starts.claimedBy.size / landShare * 100).toFixed(1)}% of land claimed · zoom {k.toFixed(1)}x</span>}
      </div>
      <div ref={hostRef} className="relative flex-1 overflow-hidden">
        {projection && (
          <svg ref={svgRef} data-testid="tile-map" width={width} height={height} style={{ display: 'block', background: '#0b1a3a', touchAction: 'none' }}
            onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
            <defs>
              {landPath && <clipPath id="land-clip"><path d={landPath} /></clipPath>}
            </defs>
            <g transform={`translate(${transform.x},${transform.y}) scale(${k})`}>
              {rasterRect && <image href={worldRasterUrl(worldRasterSizeFor(width, height))} x={rasterRect.x} y={rasterRect.y} width={rasterRect.width} height={rasterRect.height} preserveAspectRatio="none" />}
              <g clipPath={landPath ? 'url(#land-clip)' : undefined} data-testid="territories">
                {territoryPaths.map(({ owner, d }) => d && (
                  <path key={owner} d={d} fill={withAlpha(WORLD_NATIONS[owner]?.color || '#888888', POLITICAL_ALPHA)} stroke="none" />
                ))}
                {borderPath && <path d={borderPath} fill="none" stroke="rgba(10,10,20,0.75)" strokeWidth={1.2 / k} strokeLinejoin="round" strokeLinecap="round" />}
              </g>
              {showHex && hexPath && k >= HEX_FROM_ZOOM && (
                <path d={hexPath} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={0.6 / k} clipPath={landPath ? 'url(#land-clip)' : undefined} data-testid="hex-mesh" />
              )}
              {selectedPath && <path d={selectedPath} fill="rgba(255,255,255,0.12)" stroke="#ffffff" strokeWidth={1.6 / k} />}
              {starts && tiles && Object.entries(starts.starts).map(([nationId, s]) => s.cities.map(({ tile, size }, i) => {
                const { lat, lon } = tiles.latLonOf(tile);
                const [x, y] = projection([lon, lat]);
                const r = (i === 0 ? 4 + size * 0.5 : 3 + size * 0.4) / Math.sqrt(k);
                return (
                  <g key={`${nationId}-${tile}`} transform={`translate(${x},${y})`} pointerEvents="none">
                    <circle r={r} fill={i === 0 ? '#f8fafc' : '#e2e8f0'} stroke={WORLD_NATIONS[nationId]?.color || '#000'} strokeWidth={2 / Math.sqrt(k)} />
                    {i === 0 && <circle r={r * 0.35} fill={WORLD_NATIONS[nationId]?.color || '#000'} />}
                    {k >= 4 && <text y={-r - 2 / k} textAnchor="middle" fontSize={11 / k} fill="#fff" stroke="rgba(0,0,0,0.7)" strokeWidth={2.5 / k} paintOrder="stroke">{i === 0 ? (WORLD_NATIONS[nationId]?.name || nationId) : (tiles.names[tile] || '')}</text>}
                  </g>
                );
              }))}
            </g>
          </svg>
        )}
        {!tiles && <div className="absolute inset-0 flex items-center justify-center text-slate-400">Loading the world…</div>}
        {sel && (
          <div data-testid="tile-card" className="absolute right-2 top-2 w-64 bg-slate-900/95 border border-slate-700 rounded-lg p-3 text-xs space-y-1">
            <div className="font-semibold text-sm">{sel.name || (sel.river ? `On the ${sel.river}` : `Tile ${sel.id}`)}</div>
            <div className="text-slate-400">{sel.lat.toFixed(2)}, {sel.lon.toFixed(2)}{sel.coastal ? ' · coastal' : ''}</div>
            <div>{sel.terrain}{sel.relief !== 'flat' ? `, ${sel.relief}` : ''}{sel.feature !== 'none' ? `, ${sel.feature}` : ''}</div>
            {sel.climate && <div>Climate {sel.climate} · {sel.elevation} m</div>}
            {sel.river && <div>River: {sel.river}</div>}
            {sel.country && <div>Modern country: {WORLD_NATIONS[sel.country]?.name || sel.country}</div>}
            {sel.owner && <div>Claimed by {WORLD_NATIONS[sel.owner]?.name || sel.owner}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default TileViewer;
