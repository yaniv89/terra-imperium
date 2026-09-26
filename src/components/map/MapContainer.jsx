// src/components/map/MapContainer.jsx
// Top-level map orchestrator, rendered as the app's full-bleed base layer (App.jsx) with GameHeader
// and PanelDrawer floating over it, instead of sitting in its own bounded flex cell (plan feedback:
// "combine the map and the play panel"). Owns which main view is showing (3D globe or the flat 2D
// map — src/components/globe/GlobeContainer.jsx / src/components/map/Map2DContainer.jsx, both pure
// sizing wrappers), the mode toggle, the corner minimap, and the region info panel + legend that
// overlay whichever one is active. The chosen mode is remembered per browser (localStorage) so it
// doesn't reset every reload.
//
// MiniMap and MapLegend are clustered together in one bottom-left corner box (rather than each
// hardcoding its own absolute corner) so the entire right edge stays exclusively PanelDrawer's, and
// `position="panel-hud"` tells RegionInfoModal to offset itself below GameHeader's real height via
// the --header-height custom property GameHeader publishes — see RegionInfoModal.jsx's own comment.
//
// Plan feedback ("mini map to show where we at"): MiniMap now always renders, not just in globe
// mode — the flat map now opens zoomed in on the player's capital by default (see Map2DView.jsx's
// `initialFocusRegionId`) rather than always showing the whole world, so a "where am I" overview
// is genuinely useful there too, not just in globe mode.
import React, { useState } from 'react';
import { GlobeContainer } from '../globe';
import Map2DContainer from './Map2DContainer';
import MapModeToggle from './MapModeToggle';
import MiniMap from './MiniMap';
import MapModal from './MapModal';
import MapLegend from '../globe/MapLegend';
import { RegionInfoModal, ProvinceModal } from '../modals';
import { useGame } from '../../context/GameContext';
import { getNationCapital } from '../../data/regions';

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
  const { state } = useGame();
  const [mode, setMode] = useState(readStoredMode);
  const [modalOpen, setModalOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const playerCapitalId = getNationCapital(state.playerNationId);

  const handleModeChange = (next) => {
    setMode(next);
    try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* private browsing / storage disabled — mode just won't persist */ }
  };

  return (
    <div className="relative w-full h-full">
      {mode === 'globe'
        ? <GlobeContainer selectedRegion={selectedRegion} onSelectRegion={onSelectRegion} />
        : <Map2DContainer selectedRegion={selectedRegion} onSelectRegion={onSelectRegion} hudOffset initialFocusRegionId={playerCapitalId} />}

      <RegionInfoModal
        regionId={selectedRegion}
        onClose={() => { setManageOpen(false); onSelectRegion(null); }}
        onManage={selectedRegion ? () => setManageOpen(true) : undefined}
        position="panel-hud"
      />
      <div className="absolute left-2 z-10 flex flex-col items-start gap-2 bottom-[calc(var(--panel-bar-height,4rem)+0.5rem)] lg:bottom-2">
        <MiniMap onOpen={() => setModalOpen(true)} />
        <MapLegend />
      </div>
      <MapModeToggle mode={mode} onChange={handleModeChange} />

      <MapModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedRegion={selectedRegion}
        onSelectRegion={onSelectRegion}
      />
      <ProvinceModal regionId={selectedRegion} open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
};

export default MapContainer;
