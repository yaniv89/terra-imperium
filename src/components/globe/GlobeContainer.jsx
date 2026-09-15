// src/components/globe/GlobeContainer.jsx
// Sizing + lazy-load wrapper around GlobeView. react-globe.gl needs explicit pixel width/height
// (unlike the flat map's SVG viewBox, which scales itself) — a ResizeObserver keeps it in sync
// with its flex-layout container. The three.js-based renderer (~1MB+) is only fetched once this
// mounts, so switching to Globe View is the only thing that pays for it.
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';

const GlobeView = lazy(() => import('./GlobeView'));

const GlobeContainer = ({ selectedCountryId, onSelectCountry }) => {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-2xl">
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
          Loading globe renderer…
        </div>
      }>
        {size.width > 0 && size.height > 0 && (
          <GlobeView
            width={size.width}
            height={size.height}
            selectedCountryId={selectedCountryId}
            onSelectCountry={onSelectCountry}
          />
        )}
      </Suspense>
    </div>
  );
};

export default GlobeContainer;
