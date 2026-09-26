// src/components/map/MapModeToggle.jsx
// Switches MapContainer's main view between the 3D globe and the flat 2D map.
import React from 'react';
import { Globe2, Map as MapIcon } from 'lucide-react';

const MapModeToggle = ({ mode, onChange }) => (
  <div className="absolute top-2 right-2 z-10 flex bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 shadow-xl overflow-hidden">
    <button
      onClick={() => onChange('globe')}
      className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold transition-colors ${
        mode === 'globe' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
      }`}
      title="Globe view"
    >
      <Globe2 className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Globe</span>
    </button>
    <button
      onClick={() => onChange('flat')}
      className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold transition-colors border-l border-slate-700 ${
        mode === 'flat' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
      }`}
      title="Flat map view"
    >
      <MapIcon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Map</span>
    </button>
  </div>
);

export default MapModeToggle;
