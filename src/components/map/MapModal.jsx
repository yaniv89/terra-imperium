// src/components/map/MapModal.jsx
// Full-screen 2D map, opened from the MiniMap (src/components/map/MiniMap.jsx) — a quick way to
// see and click the whole flat world clearly without leaving Globe mode, since the minimap itself
// is deliberately too small to click regions on precisely.
import React from 'react';
import { X } from 'lucide-react';
import Map2DContainer from './Map2DContainer';
import { RegionInfoModal } from '../modals';

const MapModal = ({ open, onClose, selectedRegion, onSelectRegion }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col p-3 sm:p-6 bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h2 className="text-white font-bold text-sm sm:text-base">World Map</h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
          aria-label="Close map"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="relative flex-1 min-h-0">
        <Map2DContainer selectedRegion={selectedRegion} onSelectRegion={onSelectRegion} />
        <RegionInfoModal regionId={selectedRegion} onClose={() => onSelectRegion(null)} position="panel" />
      </div>
    </div>
  );
};

export default MapModal;
