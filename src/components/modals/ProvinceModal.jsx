// src/components/modals/ProvinceModal.jsx
// The city sheet's frame (plans/civ-map-rework.md E4): opens for your OWN cities only from the
// region card's "Manage" button, docked left on a wide screen, a bottom sheet on a phone, capped
// at 65vh so the map and its animations stay in view. The tabs are the city sheet
// (src/components/city/): City, Tiles, Buildings, Politics. The old Overview, Economy and
// Military tabs are gone: their crown actions moved into Politics and Buildings, units are on
// the army sheet, recruitment is the production queue.
//
// Paired with MapContainer.jsx's `focusRegionId`, the map re-centres on the city being managed
// the moment this opens, and reports its inset so animations land in the visible part.
import React, { useState, useEffect, useRef } from 'react';
import { X, Building2 } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAutoPeek } from '../../hooks/useAutoPeek';
import { useExclusivePanel } from '../../hooks/useExclusivePanel';
import { useReportInset } from '../../context/MapInsetsContext';
import { REGIONS_DATA } from '../../data/regions';
import CityPanel from '../city/CityPanel';
import CityBuildings from '../city/CityBuildings';
import CityPolitics from '../city/CityPolitics';

// The city sheet (plans/civ-map-rework.md E4): City and Tiles (src/components/city/CityPanel.jsx),
// Buildings (with the crown's development investments) and Politics (loyalty, unrest, the
// governor, the crown's actions). The old Overview, Economy and Military tabs
// retired: units live on the army sheet, recruitment in the production queue.
const TABS = [
  { id: 'city', label: 'City' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'politics', label: 'Politics' }
];

const ProvinceModal = ({ regionId, open, onClose }) => {
  const { state } = useGame();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('city');
  const sheetRef = useRef(null);
  // Plan §5.1/§5.2: report how much of the screen this panel covers so the map centres the region
  // (and every animation fired from here) in the part still visible, and on a phone shrink to a
  // short "peek" while an animation plays — the recruit/build effect lands just above the sheet.
  const isShown = open && !!regionId;
  useReportInset('province-panel', isMobile ? 'bottom' : 'left', sheetRef, isShown);
  const [peeking, cancelPeek] = useAutoPeek(isShown && isMobile);
  // Opening the tab panel beside it closes this one when both wouldn't leave room for the map.
  useExclusivePanel('province', isShown && !isMobile, (tucked) => { if (tucked) onClose(); });

  useEffect(() => { setTab('city'); }, [regionId]);

  if (!open || !regionId) return null;

  const regionState = state.regions[regionId];
  const regionData = REGIONS_DATA[regionId];
  if (!regionData || !regionState) return null;

  const ownerName = state.nations[regionState.owner]?.name || regionState.owner;
  // This modal only ever opens via RegionInfoModal's "Manage Region" button, which is itself
  // gated to owned regions — this is a defensive backstop, e.g. against the region changing hands
  // while the modal happens to still be open.
  if (regionState.owner !== state.playerNationId) return null;

  return (
    // The click-outside catcher starts BELOW the header so End Turn and the resource bar stay usable
    // while a region is being managed (it used to cover them — and on desktop both side panels were
    // drawn over the header too).
    <div className="fixed inset-x-0 bottom-0 top-[var(--header-height,4.5rem)] z-[35]" onClick={onClose}>
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className={isMobile
          ? `absolute inset-x-0 bottom-0 ${peeking ? 'max-h-[22vh]' : 'max-h-[65vh]'} transition-[max-height] duration-300 ease-out rounded-t-2xl bg-slate-900 border-t border-slate-700 shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom)]`
          : 'absolute left-0 top-0 bottom-0 w-full max-w-md pl:max-w-[min(400px,46vw)] pl:pl-[env(safe-area-inset-left)] bg-slate-900 border-r border-slate-700 shadow-2xl flex flex-col'}
      >
        {/* Header — tapping it while the sheet is peeking brings the full sheet straight back. */}
        <div onClick={peeking ? cancelPeek : undefined} className="p-4 border-b border-slate-700 shrink-0 flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <Building2 size={20} className="text-blue-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-white truncate">{regionData.name}</div>
              <div className="text-slate-500 text-[10px] capitalize">{regionData.terrain} · {ownerName}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-2 py-2 text-xs font-semibold border-b-2 transition-colors ${
                tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {tab === 'city' && <CityPanel cityId={regionId} view="city" />}
          {tab === 'tiles' && <CityPanel cityId={regionId} view="tiles" />}
          {tab === 'buildings' && <CityBuildings cityId={regionId} />}
          {tab === 'politics' && <CityPolitics cityId={regionId} />}
        </div>
      </div>
    </div>
  );
};

export default ProvinceModal;
