// src/components/map/MiniMap.jsx
// A small, always-visible flat-world overview (CK3-style corner minimap). Plan feedback ("do it
// like every game mini map... show where we are now with a little white border square and that we
// can navigate with mini map"): this used to be a plain button whose only job was opening the full
// map (MapModal.jsx) — no indication of where the main view was actually looking, and no way to
// navigate from it. It now draws a real viewport rectangle and lets you click/drag to pan the main
// view; opening the full map moved to its own small corner button so it doesn't fight that.
//
// `viewportBounds` is the shared contract GlobeView.jsx and Map2DView.jsx each report their own
// current visible area in: `{centerLat, centerLng, halfWidthDeg, halfHeightDeg}` — for the flat
// map this is the EXACT inverted screen viewport; for the globe it's an approximation (a sphere's
// visible cap isn't a lat/lng rectangle) derived from camera altitude. Good enough for a small
// indicator either way. `onNavigate(lat, lng)` is called with wherever was clicked/dragged to —
// MapContainer.jsx turns that into a fresh `navigateTarget` object both main views know how to fly
// to (see their own navigateTarget effects for why it must be a new object every time).
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Maximize2 } from 'lucide-react';
import { geoEquirectangular } from 'd3-geo';
import Map2DView from './Map2DView';
import { loadGameRegionFeatures } from '../../data/geo/loadGameRegions';

const WIDTH = 132;
const HEIGHT = 74;

const MiniMap = ({ onOpen, viewportBounds, onNavigate }) => {
  const containerRef = useRef(null);
  const [polygons, setPolygons] = useState(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadGameRegionFeatures().then((f) => { if (!cancelled) setPolygons(f.gameRegionFeatures); });
    return () => { cancelled = true; };
  }, []);

  // Same fitSize a Map2DView instance at this exact width/height would compute — kept independent
  // (rather than threaded down as a ref/prop from the background Map2DView below) so this stays a
  // plain, cheap lat/lng<->pixel conversion with no coupling to that component's internals.
  const projection = useMemo(() => {
    if (!polygons) return null;
    return geoEquirectangular().fitSize([WIDTH, HEIGHT], { type: 'FeatureCollection', features: polygons });
  }, [polygons]);

  const navigateFromEvent = useCallback((e) => {
    if (!projection || !onNavigate) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [lng, lat] = projection.invert([x, y]);
    onNavigate(lat, lng);
  }, [projection, onNavigate]);

  const handlePointerDown = (e) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    navigateFromEvent(e);
  };
  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    navigateFromEvent(e);
  };
  const handlePointerUp = () => { draggingRef.current = false; };

  // The viewport rectangle: projects `centerLng/Lat ± halfWidth/HeightDeg` through the same
  // projection above. An oversized rectangle (e.g. the globe zoomed far out) simply overflows the
  // container's own `overflow-hidden` border rather than needing explicit clamping.
  const rect = useMemo(() => {
    if (!projection || !viewportBounds) return null;
    const { centerLat, centerLng, halfWidthDeg, halfHeightDeg } = viewportBounds;
    const [x1, y1] = projection([centerLng - halfWidthDeg, centerLat + halfHeightDeg]);
    const [x2, y2] = projection([centerLng + halfWidthDeg, centerLat - halfHeightDeg]);
    return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
  }, [projection, viewportBounds]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-lg overflow-hidden border border-slate-700 shadow-xl bg-slate-900/90 group hover:border-blue-500 transition-colors cursor-crosshair"
      style={{ width: WIDTH, height: HEIGHT, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title="Click or drag to navigate"
      role="button"
      aria-label="Minimap — click or drag to navigate the map"
    >
      <Map2DView width={WIDTH} height={HEIGHT} interactive={false} selectedRegion={null} onSelectRegion={() => {}} />
      {rect && (
        <div
          className="absolute border-2 border-white/90 pointer-events-none"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, boxShadow: '0 0 0 1px rgba(0,0,0,0.5)' }}
        />
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-slate-900/70 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-slate-800"
        title="Open full map"
        aria-label="Open full map"
      >
        <Maximize2 className="w-3 h-3" />
      </button>
    </div>
  );
};

export default MiniMap;
