// src/components/map/MapModeToggle.jsx
// Switches MapContainer's main view between the 3D globe and the flat 2D map.
import React from 'react';
import { useMapInsets } from '../../context/MapInsetsContext';
import { Globe2, Map as MapIcon } from 'lucide-react';

const MapModeToggle = ({ mode, onChange }) => {
  const insets=useMapInsets();
  return (
  <div style={{right:insets.right+8}} className="absolute top-[calc(var(--header-height,2.25rem)+0.5rem)] z-10 flex bg-fa-panel/90 backdrop-blur-sm rounded-lg border border-fa-line shadow-xl overflow-hidden">
    <button
      onClick={() => onChange('globe')}
      className={`flex items-center gap-1 px-2.5 min-h-[40px] text-[11px] font-semibold transition-colors ${
        mode === 'globe' ? 'fa-selected' : 'text-fa-muted hover:text-fa-text hover:bg-fa-raised'
      }`}
      title="Globe view"
    >
      <Globe2 className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Globe</span>
    </button>
    <button
      onClick={() => onChange('flat')}
      className={`flex items-center gap-1 px-2.5 min-h-[40px] text-[11px] font-semibold transition-colors border-l border-fa-line ${
        mode === 'flat' ? 'fa-selected' : 'text-fa-muted hover:text-fa-text hover:bg-fa-raised'
      }`}
      title="Flat map view"
    >
      <MapIcon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Map</span>
    </button>
  </div>
  );
};

export default MapModeToggle;
