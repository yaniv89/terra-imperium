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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cameraTarget, battlePlaces, freshBattleReport, latLngOfTile } from './mapCamera';
import { GlobeContainer } from '../globe';
import Map2DContainer from './Map2DContainer';
import RegionChooser from './RegionChooser';
import MarchBar from './MarchBar';
import MarchAttackPrompt from './MarchAttackPrompt';
import PreBattleModal from '../battle/PreBattleModal';
import { MarchProvider, useMarch } from './MarchContext';
import { getTiles } from '../../data/geo/tiles';
import MapModeToggle from './MapModeToggle';
import MiniMap from './MiniMap';
import MapModal from './MapModal';
import MapLegend from '../globe/MapLegend';
import { RegionInfoModal, ProvinceModal } from '../modals';
import TileSheet from './TileSheet';
import ArmySheet from './ArmySheet';
import { stackOn } from './armySheetModel';
import { orderedStack, unitAfterTap, cycleUnit } from './tileStack';
import NationSheet from './NationSheet';
import LensStrip from './LensStrip';
import { LENSES } from './lenses';
import SettleBar from './SettleBar';
import { settleModeFor, settleModeOver, settleSites, settleUnit, nextSite, settleBarModel, idleSettlerOn, firstIdleSettler } from './settleMode';
import { SELECT_ARMY, SELECT_TILE, SELECT_NATION, FOCUS_REGION, MANAGE_CITY, FOCUS_PLACE, OPEN_FIELD_ATTACK, pointAtTile } from './marchEvents';
import { SET_MAP_LENS } from '../ui/uiEvents';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { ActionTypes } from '../../data/types';
import { useGame } from '../../context/GameContext';
import { getNationCapital } from '../../data/regions';
import { useMapPrefs } from './mapPrefs';
import { isIndependentNation } from '../../data/independents';
import { openIndependent } from '../independents/independentEvents';
import { useT } from '../../i18n/useT';

export const MINIMAP_STORAGE_KEY = 'terra-imperium-minimap-open';
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
  const { state, dispatch } = useGame();
  const { t } = useT();
  const marchCtx = useMarch();
  const marching = !!marchCtx?.march && !marchCtx.march.dragging;
  const [selectedTile, setSelectedTile] = useState(null);
  const [fieldAttack, setFieldAttack] = useState(null); // { from, tile }: the card of an attack picked on a tile's sheet
  const [selectedArmy, setSelectedArmy] = useState(null);
  const [unitPick, setUnitPick] = useState(null); // { tile, unitId }: the unit of a tile's stack that shows (one model per tile, tileStack.js)
  const [selectedNation, setSelectedNation] = useState(null); // the nation sheet (NationSheet.jsx)
  const [lens, setLens] = useState('political'); // lenses.js; keys 1 to 7 on a keyboard
  const [lensOpen, setLensOpen] = useState(false); // the open lens list sits over the needs-you chips
  // The mini map folds behind a small button (plans/playtest-1.md P1.5), closed by default on a phone.
  const [miniOpen, setMiniState] = useState(() => { try { const v = localStorage.getItem(MINIMAP_STORAGE_KEY); if (v != null) return v === '1'; } catch { /* storage off */ } return typeof window === 'undefined' ? true : window.innerWidth >= 1024; });
  const setMini = (v) => { setMiniState(v); try { localStorage.setItem(MINIMAP_STORAGE_KEY, v ? '1' : '0'); } catch { /* storage off */ } };
  // Settling is a mode (settleMode.js): it forces the settle view round its settler whatever
  // `lens` holds, and gives that lens back when it ends.
  const [settle, setSettle] = useState(null);
  // The camera's moves from outside the map (plans/ui/map-camera/): only to a place that exists
  // (mapCamera.js), never to an undefined or empty spot.
  const stateRef = useRef(state);
  stateRef.current = state;
  const selectedArmyRef = useRef(selectedArmy);
  selectedArmyRef.current = selectedArmy;
  const flyTo = (ll) => { if (ll) setNavigateTarget({ lat: ll.lat, lng: ll.lng }); };
  // Turn to a settler: the mode is on, its tile is selected (the site sheet), the map centres on it.
  const startSettle = (unit) => {
    if (!unit) return false;
    marchCtx?.cancel?.();
    settleStartedRef.current = Date.now();
    setSettle(settleModeFor(unit)); setSelectedTile(unit.tile); setSelectedArmy(null); setSelectedNation(null); setManageOpen(false); selectRegion(null);
    flyTo(latLngOfTile(unit.tile));
    return true;
  };
  const settleStartedRef = useRef(0);
  const startSettleRef = useRef(startSettle);
  startSettleRef.current = startSettle;
  // The player picks a lens: any tool mode over it ends.
  const pickLens = (id) => { setSettle(null); setLens(id); };
  useEffect(() => {
    const onKey = (e) => { if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; const l = LENSES.find((x) => x.key === e.key); if (l) { setSettle(null); setLens(l.id); } };
    const onLens = (e) => {
      const l = LENSES.find((x) => x.id === e.detail);
      if (!l) return;
      // "Show good sites" with settlers waiting is the settle mode for the first of them
      if (l.id === 'settle' && startSettleRef.current(firstIdleSettler(stateRef.current))) return;
      setSettle(null); setLens(l.id);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(SET_MAP_LENS, onLens);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(SET_MAP_LENS, onLens); };
  }, []);
  // The place itself is outlined (pointAtTile), so "Show on map" always lands on something to see:
  // a remembered capital in the Stone Age is a home tile with no town drawn on it (playtest run
  // 40550097406 step 72: "jumped to a sea view with no visible city or marker").
  const flyToPlaces = (places) => {
    const t = cameraTarget(stateRef.current, places, { selectedArmyTile: selectedArmyRef.current });
    flyTo(t);
    if (t?.from === 'place' && t.tile != null) pointAtTile(t.tile);
  };
  // After a battle the player fought (Command, Auto, an attack answered), the map centres on it:
  // its tile, the city fought for, else the selected army, else the capital.
  const reports = state.battleReports;
  const seenReportRef = useRef(reports?.[0]?.id ?? null);
  useEffect(() => {
    const top = reports?.[0]?.id ?? null;
    if (top === seenReportRef.current) return;
    const fresh = freshBattleReport(reports, seenReportRef.current, stateRef.current.turnNumber);
    seenReportRef.current = top;
    if (fresh) flyToPlaces(battlePlaces(fresh));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);
  // The next prompt opens an army sheet or a tile sheet from the header (marchEvents.js), the map
  // centred on it.
  useEffect(() => {
    const onArmy = (e) => { setSelectedArmy(e.detail); setSelectedTile(null); setManageOpen(false); selectRegion(null); flyTo(latLngOfTile(e.detail)); };
    // (the tile of settlers that wait, the "Idle" chip: the settle mode for them)
    const onTile = (e) => { if (startSettleRef.current(idleSettlerOn(stateRef.current, e.detail))) return; setSelectedTile(e.detail); setSelectedArmy(null); setManageOpen(false); selectRegion(null); flyTo(latLngOfTile(e.detail)); };
    // (a "go home" fly that comes with the settle mode, Research's Map button, does not pull the map off the settler)
    const onPlace = (e) => { if ((!e.detail || (Array.isArray(e.detail) && !e.detail.length)) && Date.now() - settleStartedRef.current < 400) return; flyToPlaces(e.detail); };
    // An independent has its own sheet (IndependentSheet): a major's card would offer treaties and gifts the reducer refuses.
    const onNation = (e) => { if (isIndependentNation(stateRef.current.nations?.[e.detail])) { openIndependent(e.detail); return; } setSelectedNation(e.detail); setSelectedTile(null); setSelectedArmy(null); setManageOpen(false); selectRegion(null); };
    const onFocus = (e) => setEventFocus(e.detail || null);
    // End Turn's "Choose production: <city>" (turnBlockers.js): the city's sheet on its Build tab, the map centred on it.
    const onManage = (e) => { const { regionId, tab } = e.detail || {}; if (!regionId) return; setSelectedTile(null); setSelectedArmy(null); setSelectedNation(null); selectRegion(regionId); setTabRequest({ regionId, tab: tab || 'overview' }); setManageOpen(true); };
    const onEngage = (e) => { if (e.detail?.tile == null) return; setManageOpen(false); setFieldAttack(e.detail); };
    window.addEventListener(SELECT_ARMY, onArmy); window.addEventListener(SELECT_TILE, onTile); window.addEventListener(SELECT_NATION, onNation); window.addEventListener(FOCUS_REGION, onFocus); window.addEventListener(MANAGE_CITY, onManage); window.addEventListener(FOCUS_PLACE, onPlace); window.addEventListener(OPEN_FIELD_ATTACK, onEngage);
    return () => { window.removeEventListener(SELECT_ARMY, onArmy); window.removeEventListener(SELECT_TILE, onTile); window.removeEventListener(SELECT_NATION, onNation); window.removeEventListener(FOCUS_REGION, onFocus); window.removeEventListener(MANAGE_CITY, onManage); window.removeEventListener(FOCUS_PLACE, onPlace); window.removeEventListener(OPEN_FIELD_ATTACK, onEngage); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // the tile of one of your armies: its sheet (ArmySheet.jsx)
  // On a tablet the city card stays open under a tile or army sheet (E2: two sheets stacked).
  const layoutMode = useLayoutMode();
  const stacking = layoutMode === 'tablet';
  // Tapping a tile's flag selects its top unit; tapping it again cycles to the next unit of the tile (Civilization).
  const onSelectArmy = (tile) => {
    if (marching) { if (tile != null) marchCtx.aimAt(tile); return; }
    if (tile != null) {
      const ordered = orderedStack(stackOn(stateRef.current, tile));
      const same = selectedArmyRef.current === tile;
      const id = unitAfterTap(ordered, same, unitPick?.tile === tile ? unitPick.unitId : null);
      setUnitPick(id ? { tile, unitId: id } : null);
    }
    setSelectedArmy(tile); setSelectedTile(null); setManageOpen(false); if (!stacking) selectRegion(null);
  };
  // The sheet's prev and next arrows.
  const cycleUnitPick = (dir) => {
    if (selectedArmy == null) return;
    const ordered = orderedStack(stackOn(stateRef.current, selectedArmy));
    const next = cycleUnit(ordered, unitPick?.tile === selectedArmy ? unitPick.unitId : null, dir);
    if (next) setUnitPick({ tile: selectedArmy, unitId: next.id });
  };
  const onSelectRegion = (id) => { if (marching && id) marchCtx.aimAt(id); else { if (id) { setSelectedTile(null); setSelectedArmy(null); setSelectedNation(null); } selectRegion(id); } };
  // In march mode any tile (sea included, for a fleet) is the target; otherwise only land opens the tile sheet.
  const onSelectTile = (tile) => {
    if (marching) { if (tile != null) marchCtx.aimAt(tile); return; }
    const land = tile != null && getTiles().land[tile] === 1 ? tile : null;
    // One of your settlers that waits, tapped on the map: the settle mode for it. While the mode
    // is on, every tap is a site to look at and the mode stays (I086).
    const waiting = land != null ? idleSettlerOn(state, land) : null;
    if (waiting && waiting.id !== settle?.unitId && startSettle(waiting)) return;
    if (settle && land == null) return; // the sea, or the same tile again: the site sheet stays
    setSelectedTile(land);
    if (land != null) { setManageOpen(false); setSelectedArmy(null); if (!stacking || settle) selectRegion(null); }
  };
  // The mode ends by itself when its settler has a destination, founded, or is gone; a march ends it too.
  const settleOver = settleModeOver(state, settle);
  useEffect(() => { if (settleOver) setSettle(null); }, [settleOver]);
  const sites = useMemo(() => (settle ? settleSites(state, settle) : []), [settle, state]);
  const settleUnitNow = settleUnit(state, settle);
  const settleView = useMemo(() => (settleUnitNow ? { tile: settleUnitNow.tile, sites: sites.map((s) => ({ tile: s.tile, poor: s.warnings.length > 0 })) } : null), [settleUnitNow, sites]);
  const goNextSite = () => { const s = nextSite(sites, selectedTile); if (!s) return; setSelectedTile(s.tile); setSelectedArmy(null); setManageOpen(false); selectRegion(null); flyTo(latLngOfTile(s.tile)); };
  // While a land march's target is picked, the political map shows the supply lens (where your
  // supply lines reach: EU4's supply map mode while moving armies; playtest issue 6).
  const shownLens = settleView ? 'settle' : marching && !marchCtx.march.naval && lens === 'political' ? 'supply' : lens;
  const stacked = stacking && !!selectedRegion && (selectedTile != null || selectedArmy != null);
  const [storedMode, setMode] = useState(readStoredMode);
  // The globe is hidden behind a setting for one release (decision 28): off, the flat map is the map.
  const { globe: globeAllowed } = useMapPrefs();
  const mode = globeAllowed ? storedMode : 'flat';
  const [modalOpen, setModalOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [tabRequest, setTabRequest] = useState(null); // { regionId, tab }: the city sheet opens on this tab (MANAGE_CITY)
  const [eventFocus, setEventFocus] = useState(null); // the event sheet's city (marchEvents.js focusRegion)
  const [viewportBounds, setViewportBounds] = useState(null);
  const [navigateTarget, setNavigateTarget] = useState(null);
  // A touch tap that covered several provinces: which one did the player mean? (RegionChooser)
  const [tapChoice, setTapChoice] = useState(null);
  // Starting a march closes the region card, so the map is free to pick the target.
  const marchFrom = marchCtx?.march?.from;
  useEffect(() => { if (marchFrom) { setManageOpen(false); setSettle(null); selectRegion(null); } }, [marchFrom, selectRegion]);
  const playerCapitalId = getNationCapital(state.playerNationId);
  const focusRegionId = manageOpen ? selectedRegion : eventFocus;
  const handleMiniMapNavigate = (lat, lng) => setNavigateTarget({ lat, lng });

  const handleModeChange = (next) => {
    setMode(next);
    try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* private browsing / storage disabled — mode just won't persist */ }
  };

  return (
    <div className="relative w-full h-full" data-stacked={stacked ? '1' : undefined}>
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
            onSelectArmy={onSelectArmy}
            lens={shownLens}
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
            onSelectArmy={onSelectArmy}
            selectedArmy={selectedArmy}
            selectedUnit={selectedArmy != null && unitPick?.tile === selectedArmy ? unitPick : null}
            lens={shownLens}
            settle={settleView}
          />
        )}

      {/* On a phone, Manage Region grows out of this same bottom sheet — keeping both mounted
          stacked a second sheet behind it that stayed visible (and kept covering the map) whenever
          Manage Region peeked during an animation. */}
      {!manageOpen && (
      <RegionInfoModal
        regionId={selectedRegion}
        onClose={() => { setManageOpen(false); onSelectRegion(null); }}
        onManage={selectedRegion ? () => setManageOpen(true) : undefined}
        position="panel-hud"
      />
      )}
      {/* Closing the site sheet keeps the settle mode (its bar stays): I086. */}
      {selectedTile != null && (stacking || !selectedRegion) && <TileSheet tile={selectedTile} onClose={() => setSelectedTile(null)} onAttack={setFieldAttack} onSelectRegion={onSelectRegion} settleUnitId={settleUnitNow?.id || null} onSettle={startSettle} />}
      {selectedArmy != null && (stacking || !selectedRegion) && selectedTile == null && <ArmySheet tile={selectedArmy} unitId={unitPick?.tile === selectedArmy ? unitPick.unitId : null} onCycleUnit={cycleUnitPick} onClose={() => setSelectedArmy(null)} onSelectRegion={onSelectRegion} />}
      {selectedNation && !selectedRegion && selectedTile == null && selectedArmy == null && <NationSheet nationId={selectedNation} onClose={() => setSelectedNation(null)} onSelectRegion={onSelectRegion} />}
      <div className={`absolute start-[calc(var(--city-rail-w,0px)+0.75rem)] ${lensOpen ? 'z-20' : 'z-10'} flex flex-col items-start gap-2 bottom-[calc(var(--panel-bar-height,4rem)+0.75rem)] lg:bottom-3 pl:bottom-3 pl:start-[max(var(--safe-start),0.75rem)]`} data-map-hud="group">
        {miniOpen && <MapLegend />}
        {miniOpen && <div className="relative"><MiniMap onOpen={() => setModalOpen(true)} viewportBounds={viewportBounds} onNavigate={handleMiniMapNavigate} /><button type="button" onClick={() => setMini(false)} aria-label={t('minimap.hide')} data-testid="minimap-hide" className="absolute -top-2 -end-2 w-8 h-8 rounded-full bg-fa-panel border border-fa-line text-fa-text text-sm pointer-events-auto">×</button></div>}
        <div className="flex items-end gap-2">
          <LensStrip lens={shownLens} onChange={pickLens} onOpenChange={setLensOpen} />
          {!miniOpen && <button type="button" onClick={() => setMini(true)} aria-label={t('minimap.show')} data-testid="minimap-show" className="min-h-[40px] px-3 rounded-full bg-fa-panel/95 border border-fa-line shadow-xl text-[12px] font-semibold text-fa-text pointer-events-auto hover:bg-fa-raised">{t('minimap.world')}</button>}
        </div>
      </div>
      {globeAllowed && <MapModeToggle mode={mode} onChange={handleModeChange} />}
      <MarchBar />
      {settleView && !marching && <SettleBar model={settleBarModel(state, settle, sites, selectedTile)} onNext={goNextSite} onCancel={() => setSettle(null)} onSendHome={(unitId) => { dispatch({ type: ActionTypes.DISBAND_SETTLERS, payload: { unitId } }); setSettle(null); }} />}
      <MarchAttackPrompt />
      {fieldAttack && <PreBattleModal fromRegionId={fieldAttack.from} tile={fieldAttack.tile} onClose={() => setFieldAttack(null)} />}
      <RegionChooser choice={tapChoice} onPick={(id) => { setTapChoice(null); onSelectRegion(id); }} onClose={() => setTapChoice(null)} />

      <MapModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedRegion={selectedRegion}
        onSelectRegion={onSelectRegion}
      />
      <ProvinceModal regionId={selectedRegion} open={manageOpen} onClose={(how) => { setManageOpen(false); setTabRequest(null); if (how?.toMap) onSelectRegion(null); }} tabRequest={tabRequest} />
    </div>
  );
};

export default MapContainer;
