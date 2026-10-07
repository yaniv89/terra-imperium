// src/components/map/MapZoomControls.jsx
// The flat map's zoom buttons, folded into one small round button on the right edge (map HUD
// cleanup: the three-button column took too much of a phone's 390 px height). A tap opens zoom in,
// zoom out and reset view under it; a second tap folds them away. Pinch and wheel zoom never need
// it. Every button stays a 40 px touch target.
import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, Search, X } from 'lucide-react';

const BTN = 'w-10 h-10 flex items-center justify-center text-fa-text hover:bg-fa-raised transition-colors disabled:opacity-30 disabled:hover:bg-transparent';

const MapZoomControls = ({ onZoomIn, onZoomOut, onReset, canZoomIn = true, canZoomOut = true, canReset = true, className = '', style }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={style} className={`absolute z-10 flex flex-col items-center gap-1.5 ${className}`} data-testid="map-zoom-controls">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Map zoom controls"
        title={open ? 'Hide zoom buttons' : 'Zoom buttons'}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-fa-panel/90 border border-fa-line shadow-lg text-fa-text hover:bg-fa-raised">
        {open ? <X className="w-4 h-4" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
      </button>
      {open && (
        <div className="flex flex-col bg-fa-panel/95 rounded-lg border border-fa-line shadow-xl overflow-hidden">
          <button type="button" onClick={onZoomIn} disabled={!canZoomIn} className={BTN} title="Zoom in" aria-label="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={onZoomOut} disabled={!canZoomOut} className={`${BTN} border-t border-fa-line`} title="Zoom out" aria-label="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={onReset} disabled={!canReset} className={`${BTN} border-t border-fa-line`} title="Reset view" aria-label="Reset view">
            <Maximize className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MapZoomControls;
