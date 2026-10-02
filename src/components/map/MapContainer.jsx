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
//
// `focusRegionId` (bug fix, plan feedback: "on army tab u see in map sweden and not the selected
// region"): while ProvinceModal is open, this is the region it's managing; otherwise null. Passed
// to both map views so whichever is active re-centers on that region the moment Manage Region
// opens, instead of leaving the camera wherever it happened to be pointed.
//
// `viewportBounds`/`navigateTarget` (plan feedback: "do [the minimap] like every game mini map...
// show where we are now with a little white border square and that we can navigate with mini
// map"): whichever main view is active reports its own visible lat/lng extent up via
// `onViewportChange` (GlobeView.jsx/Map2DView.jsx share one `{centerLat, centerLng, halfWidthDeg,
// halfHeightDeg}` contract — see their own comments for how each computes it), and MiniMap.jsx
// draws that as a real "you are here" rectangle. Clicking/dragging the minimap calls
// `handleMiniMapNavigate`, which sets `navigateTarget` — a fresh `{lat,lng}` object every time —
// and both views know how to fly/pan there (only the active one is actually mounted).
import React, { useEffect, useState } from 'react';
import { GlobeContainer } from '../globe';
import Map2DContainer from './Map2DContainer';
import RegionChooser from './RegionChooser';
import MarchBar from './MarchBar';
import { MarchProvider, useMarch } from './MarchContext';
import MapModeToggle from './MapModeToggle';
import MiniMap from './MiniMap';
import MapModal from './MapModal';
import MapLegend from '../globe/MapLegend';
import { RegionInfoModal, ProvinceModal } from '../modals';
import TileSheet from './TileSheet';
import { useIsMobile } from '../../hooks/useIsMobile';
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

// While an army's march is being planned (MarchContext), a tapped province is its target instead
// of a selection.
const MapContainer = (props) => (
  <MarchProvider>
    <MapContainerInner {...props} />
  </MarchProvider>
);

const MapContainerInner = ({ selectedRegion, onSelectRegion: selectRegion }) => {
  const { state } = useGame();
  const marchCtx = useMarch();
  const marching = !!marchCtx?.march && !marchCtx.march.dragging;
  const [selectedTile, setSelectedTile] = useState(null);
  const onSelectRegion = (id) => { if (marching && id) marchCtx.aimAt(id); else { if (id) setSelectedTile(null); selectRegion(id); } };
  const onSelectTile = (tile) => { if (marching) return; setSelectedTile(tile); if (tile != null) { setManageOpen(false); selectRegion(null); } };
  const [mode, setMode] = useState(readStoredMode);
  const [modalOpen, setModalOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const isMobile = useIsMobile();
  const [viewportBounds, setViewportBounds] = useState(null);
  const [navigateTarget, setNavigateTarget] = useState(null);
  // A touch tap that covered several provinces: which one did the player mean? (RegionChooser)
  const [tapChoice, setTapChoice] = useState(null);
  // Starting a march closes the region card, so the map is free to pick the target.
  const marchFrom = marchCtx?.march?.from;
  useEffect(() => { if (marchFrom) { setManageOpen(false); selectRegion(null); } }, [marchFrom, selectRegion]);
  const playerCapitalId = getNationCapital(state.playerNationId);
  const focusRegionId = manageOpen ? selectedRegion : null;
  const handleMiniMapNavigate = (lat, lng) => setNavigateTarget({ lat, lng });

  const handleModeChange = (next) => {
    setMode(next);
    try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* private browsing / storage disabled — mode just won't persist */ }
  };

  return (
    <div className="relative w-full h-full">
      {mode === 'globe'
        ? (
          <GlobeContainer
            selectedRegion={selectedRegion}
            onSelectRegion={onSelectRegion}
            onAmbiguousTap={setTapChoice}
            focusRegionId={focusRegionId}
            navigateTarget={navigateTarget}
            onViewportChange={setViewportBounds}
            onSelectTile={onSelectTile}
          />
        )
        : (
          <Map2DContainer
            selectedRegion={selectedRegion}
            onSelectRegion={onSelectRegion}
            onAmbiguousTap={setTapChoice}
            hudOffset
            initialFocusRegionId={playerCapitalId}
            focusRegionId={focusRegionId}
            navigateTarget={navigateTarget}
            onViewportChange={setViewportBounds}
            selectedTile={selectedTile}
            onSelectTile={onSelectTile}
          />
        )}

      {/* On a phone, Manage Region grows out of this same bottom sheet — keeping both mounted
          stacked a second sheet behind it that stayed visible (and kept covering the map) whenever
          Manage Region peeked during an animation. */}
      {!(isMobile && manageOpen) && (
      <RegionInfoModal
        regionId={selectedRegion}
        onClose={() => { setManageOpen(false); onSelectRegion(null); }}
        onManage={selectedRegion ? () => setManageOpen(true) : undefined}
        position="panel-hud"
      />
      )}
      {selectedTile != null && !selectedRegion && <TileSheet tile={selectedTile} onClose={() => setSelectedTile(null)} onSelectRegion={onSelectRegion} />}
      <div className="absolute left-2 z-10 flex flex-col items-start gap-2 bottom-[calc(var(--panel-bar-height,4rem)+0.5rem)] lg:bottom-2 pl:bottom-2 pl:left-[max(env(safe-area-inset-left),0.5rem)]">
        <MiniMap onOpen={() => setModalOpen(true)} viewportBounds={viewportBounds} onNavigate={handleMiniMapNavigate} />
        <MapLegend />
      </div>
      <MapModeToggle mode={mode} onChange={handleModeChange} />
      <MarchBar onSelectRegion={selectRegion} />
      <RegionChooser choice={tapChoice} onPick={(id) => { setTapChoice(null); onSelectRegion(id); }} onClose={() => setTapChoice(null)} />

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
