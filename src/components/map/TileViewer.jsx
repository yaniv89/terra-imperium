// src/components/map/TileViewer.jsx
// Workstream 1c (plans/civ-map-rework.md, Part K row 1): a page for eyeballing the world grid.
// Open with `/?tileViewer`. Draws every tile on a flat (equirectangular) canvas with terrain
// colours, relief, features, rivers on their edges, the capitals and the land each nation claims
// in the chosen scenario start. Pan by dragging, zoom with the wheel or pinch, tap a tile for its
// facts. Canvas 2D on purpose: this is a data check, not the game map (workstream 2).
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { loadTiles } from '../../data/geo/tiles';
import { buildScenarioStarts, SCENARIOS, SCENARIO_IDS, DEFAULT_SCENARIO_ID } from '../../data/scenarios';
import { WORLD_NATIONS } from '../../data/worldNations';

const TERRAIN_COLORS = {
  ocean: '#14326e', coast: '#3264aa', lake: '#4682c8',
  grassland: '#5ca046', plains: '#aaaa5a', desert: '#e1c882', tundra: '#96a08c', snow: '#f0f0f5'
};
const FEATURE_TINT = { forest: '#2f6b2a', jungle: '#1e6e28', marsh: '#5a8c78', oasis: '#64b45a', floodplain: '#78be5a', ice: '#dcebfa' };

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

const tileColor = (tiles, id) => {
  const terrain = tiles.terrainOf(id); const relief = tiles.reliefOf(id); const feature = tiles.featureOf(id);
  if (relief === 'mountains') return '#6e5a50';
  let color = TERRAIN_COLORS[terrain] || '#ff00ff';
  if (FEATURE_TINT[feature]) color = FEATURE_TINT[feature];
  if (relief === 'hills') color = shade(color, 0.8);
  return color;
};

const TileViewer = () => {
  const canvasRef = useRef(null);
  const [tiles, setTiles] = useState(null);
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const [showClaims, setShowClaims] = useState(true);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 }); // pan in px, zoom factor
  const [selected, setSelected] = useState(null);
  const drag = useRef(null);

  useEffect(() => { loadTiles().then(setTiles); }, []);
  const starts = useMemo(() => (tiles ? buildScenarioStarts(tiles, scenarioId) : null), [tiles, scenarioId]);

  // Projection: equirectangular into a canvas of width W; the base scale shows the whole world.
  const project = useCallback((lat, lon, width, height) => {
    const base = width / 360;
    return [view.x + (lon + 180) * base * view.k, view.y + (90 - lat) * base * view.k + (height - 180 * base * view.k) / 2];
  }, [view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tiles) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth; const height = canvas.clientHeight;
    canvas.width = width * dpr; canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1a3a'; ctx.fillRect(0, 0, width, height);
    const claims = starts?.claimedBy;
    const polyCache = tiles._polyCache || (tiles._polyCache = new Map());
    const polyOf = (id) => { let p = polyCache.get(id); if (!p) { p = tiles.polygonOf(id); polyCache.set(id, p); } return p; };
    for (let id = 0; id < tiles.count; id++) {
      const poly = polyOf(id);
      const centre = tiles.latLonOf(id);
      // Skip polygons that straddle the dateline (drawn as two halves would be nicer; good enough here).
      if (poly.some((p) => Math.abs(p.lon - centre.lon) > 90)) continue;
      const pts = poly.map((p) => project(p.lat, p.lon, width, height));
      if (pts.every(([x]) => x < -20) || pts.every(([x]) => x > width + 20) || pts.every(([, y]) => y < -20) || pts.every(([, y]) => y > height + 20)) continue;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = tileColor(tiles, id);
      ctx.fill();
      const owner = showClaims && claims?.get(id);
      if (owner) {
        ctx.fillStyle = WORLD_NATIONS[owner]?.color || '#ffffff';
        ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
      }
      if (view.k >= 3) { ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5; ctx.stroke(); }
      // Rivers on edges: edge k runs between corners k and k+1 (corner k is the triangle with
      // neighbours k and k+1, so the edge toward neighbour k is between corners k-1 and k).
      const mask = tiles.rivers[id];
      if (mask && view.k >= 1.5) {
        const n = pts.length;
        ctx.strokeStyle = '#4aa3ff'; ctx.lineWidth = Math.min(3, 1 + view.k / 4);
        for (let k = 0; k < n; k++) {
          if (!(mask & (1 << k))) continue;
          const a = pts[(k - 1 + n) % n]; const b = pts[k];
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      }
    }
    // Capitals and extra cities.
    if (starts) {
      Object.entries(starts.starts).forEach(([nationId, s]) => {
        s.cities.forEach(({ tile, size }, i) => {
          const { lat, lon } = tiles.latLonOf(tile);
          const [x, y] = project(lat, lon, width, height);
          ctx.beginPath(); ctx.arc(x, y, i === 0 ? 3 + size * 0.4 : 2 + size * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = i === 0 ? '#ff3b3b' : '#ffd166'; ctx.fill();
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
          if (view.k >= 4 && i === 0) { ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(WORLD_NATIONS[nationId]?.name || nationId, x + 6, y - 4); }
        });
      });
    }
    if (selected != null) {
      const pts = polyOf(selected).map((p) => project(p.lat, p.lon, width, height));
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    }
  }, [tiles, starts, view, showClaims, selected, project]);

  const unproject = (px, py) => {
    const canvas = canvasRef.current; const width = canvas.clientWidth; const height = canvas.clientHeight;
    const base = width / 360;
    const lon = (px - view.x) / (base * view.k) - 180;
    const lat = 90 - (py - view.y - (height - 180 * base * view.k) / 2) / (base * view.k);
    return { lat, lon };
  };

  const onPointerDown = (e) => { drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x; const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    if (drag.current.moved) setView((v) => ({ ...v, x: drag.current.vx + dx, y: drag.current.vy + dy }));
  };
  const onPointerUp = (e) => {
    if (drag.current && !drag.current.moved && tiles) {
      const rect = e.currentTarget.getBoundingClientRect();
      const { lat, lon } = unproject(e.clientX - rect.left, e.clientY - rect.top);
      if (lat <= 90 && lat >= -90) setSelected(tiles.nearest(lat, Math.max(-180, Math.min(180, lon))));
    }
    drag.current = null;
  };
  // A native listener: React's onWheel is passive, so preventDefault (no page scroll) is refused.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  });
  const onWheel = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left; const py = e.clientY - rect.top;
    setView((v) => {
      const k = Math.max(1, Math.min(40, v.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      const ratio = k / v.k;
      return { k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  };

  const sel = selected != null && tiles ? {
    id: selected, ...tiles.latLonOf(selected), terrain: tiles.terrainOf(selected), relief: tiles.reliefOf(selected), feature: tiles.featureOf(selected),
    climate: tiles.climate[selected] >= 0 ? tiles.climateNames[tiles.climate[selected]] : null, elevation: tiles.elevation[selected], roughness: tiles.roughness[selected],
    country: tiles.countryOf(selected), name: tiles.names[selected], river: tiles.riverNames[selected], neighbors: tiles.neighbors[selected].length,
    owner: starts?.claimedBy.get(selected) || null, coastal: tiles.coastal[selected] === 1
  } : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="flex flex-wrap items-center gap-3 p-2 text-xs bg-slate-900 border-b border-slate-800">
        <span className="font-semibold">World grid viewer</span>
        {tiles && <span className="text-slate-400">{tiles.count} tiles, {tiles.land.reduce((a, b) => a + b, 0)} land</span>}
        <label className="flex items-center gap-1">Start
          <select aria-label="Scenario" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className="bg-slate-800 rounded p-1">
            {SCENARIO_IDS.map((id) => <option key={id} value={id}>{SCENARIOS[id].name} ({SCENARIOS[id].year < 0 ? `${-SCENARIOS[id].year} BCE` : SCENARIOS[id].year})</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showClaims} onChange={(e) => setShowClaims(e.target.checked)} /> claims</label>
        {starts && <span className="text-slate-400">claimed {(starts.claimedBy.size / tiles.land.reduce((a, b) => a + b, 0) * 100).toFixed(1)}% of land</span>}
        <button type="button" className="px-2 py-1 bg-slate-800 rounded" onClick={() => setView({ x: 0, y: 0, k: 1 })}>Reset</button>
        <span className="text-slate-500">drag to pan, wheel to zoom, tap a tile</span>
      </div>
      <div className="relative flex-1">
        <canvas
          ref={canvasRef} data-testid="tile-viewer-canvas" className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        />
        {!tiles && <div className="absolute inset-0 flex items-center justify-center text-slate-400">Loading the world grid…</div>}
        {sel && (
          <div data-testid="tile-card" className="absolute right-2 top-2 w-64 bg-slate-900/95 border border-slate-700 rounded-lg p-3 text-xs space-y-1">
            <div className="font-semibold text-sm">{sel.name || (sel.river ? `On the ${sel.river}` : `Tile ${sel.id}`)}</div>
            <div className="text-slate-400">{sel.lat.toFixed(2)}, {sel.lon.toFixed(2)} · {sel.neighbors} neighbours{sel.coastal ? ' · coastal' : ''}</div>
            <div>{sel.terrain}{sel.relief !== 'flat' ? `, ${sel.relief}` : ''}{sel.feature !== 'none' ? `, ${sel.feature}` : ''}</div>
            {sel.climate && <div>Climate {sel.climate} · {sel.elevation} m (roughness {sel.roughness})</div>}
            {sel.river && <div>River: {sel.river}</div>}
            {sel.country && <div>Modern country: {WORLD_NATIONS[sel.country]?.name || sel.country}</div>}
            {sel.owner && <div>Claimed at start by {WORLD_NATIONS[sel.owner]?.name || sel.owner}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default TileViewer;
