// src/components/map/MiniMap.jsx
// A small, always-visible flat-world overview (CK3-style corner minimap) — click it to open the
// same map at full size in a modal (MapModal.jsx). Non-interactive itself (Map2DView's own
// `interactive={false}` mode: no per-region click/hover, thinner strokes) since at this size no
// single region is reliably tappable; it's a quick-glance shortcut into the real 2D map, not a
// second way to select regions.
import React from 'react';
import { Maximize2 } from 'lucide-react';
import Map2DView from './Map2DView';

const WIDTH = 132;
const HEIGHT = 74;

const MiniMap = ({ onOpen }) => (
  <button
    onClick={onOpen}
    className="absolute bottom-2 right-2 z-10 rounded-lg overflow-hidden border border-slate-700 shadow-xl
               bg-slate-900/90 group hover:border-blue-500 transition-colors"
    style={{ width: WIDTH, height: HEIGHT }}
    title="Open full map"
    aria-label="Open full map"
  >
    <Map2DView width={WIDTH} height={HEIGHT} interactive={false} selectedRegion={null} onSelectRegion={() => {}} />
    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
      <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  </button>
);

export default MiniMap;
