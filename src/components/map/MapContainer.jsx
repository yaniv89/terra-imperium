// src/components/map/MapContainer.jsx
// Top-level map orchestrator, replacing a direct GlobeContainer usage in App.jsx. Owns which main
// view is showing (3D globe or the flat 2D map — src/components/globe/GlobeContainer.jsx /
// src/components/map/Map2DContainer.jsx, both pure sizing wrappers), the mode toggle, the
// corner minimap (globe mode only — in flat mode the main view already IS the full 2D map, so a
// minimap of the same thing adds nothing), and the region info panel + legend that overlay
// whichever one is active. The chosen mode is remembered per browser (localStorage) so it doesn't
// reset every reload.
import React, { useState } from 'react';
import { GlobeContainer } from '../globe';
import Map2DContainer from './Map2DContainer';
import MapModeToggle from './MapModeToggle';
import MiniMap from './MiniMap';
import MapModal from './MapModal';
import MapLegend from '../globe/MapLegend';
import { RegionInfoModal } from '../modals';

const MODE_STORAGE_KEY = 'terra-imperium-map-mode';
const readStoredMode = () => {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    return stored === 'flat' ? 'flat' : 'globe';
  } catch {
    return 'globe';
  }
};

const MapContainer = ({ selectedRegion, onSelectRegion }) => {
  const [mode, setMode] = useState(readStoredMode);
  const [modalOpen, setModalOpen] = useState(false);

  const handleModeChange = (next) => {
    setMode(next);
    try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* private browsing / storage disabled — mode just won't persist */ }
  };

  return (
    <div className="relative w-full h-full">
      {mode === 'globe'
        ? <GlobeContainer selectedRegion={selectedRegion} onSelectRegion={onSelectRegion} />
        : <Map2DContainer selectedRegion={selectedRegion} onSelectRegion={onSelectRegion} />}

      <RegionInfoModal regionId={selectedRegion} onClose={() => onSelectRegion(null)} position="panel" />
      <MapLegend />
      <MapModeToggle mode={mode} onChange={handleModeChange} />
      {mode === 'globe' && <MiniMap onOpen={() => setModalOpen(true)} />}

      <MapModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedRegion={selectedRegion}
        onSelectRegion={onSelectRegion}
      />
    </div>
  );
};

export default MapContainer;
