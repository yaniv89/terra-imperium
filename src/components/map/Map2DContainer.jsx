// src/components/map/Map2DContainer.jsx
// Sizing wrapper around Map2DView, mirroring src/components/globe/GlobeContainer.jsx's own
// ResizeObserver pattern — an <svg> needs explicit pixel width/height to fit its projection to,
// the same way react-globe.gl needs pixel dimensions rather than a self-scaling viewBox alone.
import React, { useEffect, useRef, useState } from 'react';
import Map2DView from './Map2DView';

const Map2DContainer = ({ selectedRegion, onSelectRegion, hudOffset = false }) => {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-900">
      {size.width > 0 && size.height > 0 && (
        <Map2DView width={size.width} height={size.height} selectedRegion={selectedRegion} onSelectRegion={onSelectRegion} hudOffset={hudOffset} />
      )}
    </div>
  );
};

export default Map2DContainer;
