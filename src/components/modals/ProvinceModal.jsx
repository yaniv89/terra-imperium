// src/components/modals/ProvinceModal.jsx
// The city sheet (W05, plans/UI-DESIGN.md; plans/civ-map-rework.md E4): opens for your OWN cities
// from the city card. Its header is the city's size in your colour, the name, capital and growth,
// and loyalty with where it is heading; its tabs:
//   Overview   yields, size, housing, amenities, what it builds (with its bar), focus, buildings,
//              and the damage alert with its repairs (Details opens Defense)
//   Build      the production queue and every unit, army, building, wonder and improvement
//   Citizens   the city's tiles, worked and locked, and land to buy
//   Buildings  the buildings and the crown's investments (CityBuildings.jsx)
//   Politics   loyalty, unrest, the governor, the crown's actions (CityPolitics.jsx)
//   Defense    the battle housing explained line by line, walls, siege and the damage
// Docked on the left on a wide screen and a phone held sideways, a bottom sheet on a phone held
// upright, capped so the map and its animations stay in view.
//
// Paired with MapContainer.jsx's `focusRegionId`, the map re-centres on the city being managed
// the moment this opens, and reports its inset so animations land in the visible part.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAutoPeek } from '../../hooks/useAutoPeek';
import { useExclusivePanel } from '../../hooks/useExclusivePanel';
import { useReportInset } from '../../context/MapInsetsContext';
import { REGIONS_DATA } from '../../data/regions';
import { loyaltyOf, loyaltyTarget } from '../../engine/loyalty';
import CityPanel from '../city/CityPanel';
import CityBuildings from '../city/CityBuildings';
import CityPolitics from '../city/CityPolitics';
import { cityRailModel } from '../city/cityRailModel';
import { cityDefenseModel } from '../city/cityDefenseModel';
import { Button, CloseButton, Label, Meter, Tabs, signed } from '../ui/atlas';

const CityDefense = ({ model }) => (
  <div className="space-y-3" data-testid="city-defense">
    <div className="fa-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Battle housing</Label>
        <span className="fa-num text-[17px] font-semibold">{model.housing}</span>
      </div>
      <p className="text-[12px] text-fa-muted mt-0.5">How many soldiers and workers the city can hold when it is attacked: its houses and the town hall. Ruined houses hold no one until they are rebuilt.</p>
      <ul className="mt-2 space-y-0.5 text-[13px]" data-testid="battle-housing-lines">
        {model.lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-3"><span>{l.label}</span><span className={`fa-num ${l.value < 0 ? 'text-fa-danger-text' : ''}`}>{signed(l.value)}</span></li>
        ))}
        <li className="flex justify-between gap-3 border-t border-fa-line pt-1 mt-1 font-semibold"><span>In battle</span><span className="fa-num">{model.housing}</span></li>
      </ul>
    </div>
    {model.alert && (
      <div className="rounded-lg border border-fa-danger bg-[rgba(229,96,77,0.12)] p-3 text-[13px]" data-testid="city-damage">
        <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="w-4 h-4 text-fa-danger-text" aria-hidden="true" />{model.alert.text}</div>
        <p className="text-[12px] text-fa-muted mt-1">Repairs are free. A damaged building is whole after a few turns; ruined houses are rebuilt one by one. Nothing is repaired while the city is under siege.</p>
      </div>
    )}
    <div className="grid grid-cols-2 gap-1.5 text-[13px]">
      <div className="fa-card px-3 py-2"><div className="text-fa-muted text-[12px]">Walls</div><div className="fa-num font-semibold">{model.walls}</div></div>
      <div className="fa-card px-3 py-2"><div className="text-fa-muted text-[12px]">Siege</div><div className="font-semibold">{model.siege ? (model.siege.by ? `By ${model.siege.by}${model.siege.encircled ? ', encircled' : ''}` : 'Recovering') : 'None'}</div></div>
    </div>
    {model.siege && <Meter value={model.siege.hp} max={Math.max(1, model.siege.maxHp)} color="var(--fa-enemy)" label={`Walls ${model.siege.hp} of ${model.siege.maxHp} HP`} />}
  </div>
);

const ProvinceModal = ({ regionId, open, onClose }) => {
  const { state } = useGame();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('overview');
  const sheetRef = useRef(null);
  // Plan §5.1/§5.2: report how much of the screen this panel covers so the map centres the region
  // (and every animation fired from here) in the part still visible, and on a phone shrink to a
  // short "peek" while an animation plays — the recruit/build effect lands just above the sheet.
  const isShown = open && !!regionId;
  useReportInset('province-panel', isMobile ? 'bottom' : 'left', sheetRef, isShown);
  const [peeking, cancelPeek] = useAutoPeek(isShown && isMobile);
  // Opening the tab panel beside it closes this one when both wouldn't leave room for the map.
  useExclusivePanel('province', isShown && !isMobile, (tucked) => { if (tucked) onClose(); });

  useEffect(() => { setTab('overview'); }, [regionId]);
  const defense = useMemo(() => (isShown ? cityDefenseModel(state, regionId) : null), [state, regionId, isShown]);
  const row = useMemo(() => (isShown ? cityRailModel(state).find((r) => r.id === regionId) : null), [state, regionId, isShown]);

  if (!open || !regionId) return null;

  const regionState = state.regions[regionId];
  const regionData = REGIONS_DATA[regionId];
  if (!regionData || !regionState) return null;

  // This only ever opens from the city card's button, itself gated to owned cities: a backstop,
  // e.g. against the city changing hands while the sheet is open.
  if (regionState.owner !== state.playerNationId) return null;
  const colour = state.nations[state.playerNationId]?.color || 'var(--fa-you)';
  const loyalty = loyaltyOf(regionState);
  const target = regionState.tile != null ? loyaltyTarget(state, regionState).total : loyalty;
  const sub = [row?.capital ? 'Capital' : null, row?.outpost ? 'Outpost' : null, row?.growthTurns ? `grows in ${row.growthTurns} turn${row.growthTurns === 1 ? '' : 's'}` : row?.starving ? 'starving' : null].filter(Boolean).join(', ');
  const tabs = [
    { id: 'overview', label: 'Overview', testId: 'city-tab-overview' },
    { id: 'build', label: 'Build', testId: 'city-tab-build', dot: row?.idle, dotLabel: 'nothing queued' },
    { id: 'tiles', label: 'Citizens', testId: 'city-tab-tiles' },
    { id: 'buildings', label: 'Buildings', testId: 'city-tab-buildings' },
    { id: 'politics', label: 'Politics', testId: 'city-tab-politics' },
    { id: 'defense', label: 'Defense', testId: 'city-tab-defense', dot: !!defense?.alert || !!regionState.siege, dotLabel: 'damage or siege' }
  ];

  return (
    // The click-outside catcher starts BELOW the top bar so End Turn and the bar stay usable.
    <div className="fixed inset-x-0 bottom-0 top-[var(--header-height,2.25rem)] z-[35]" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-labelledby="city-sheet-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="city-sheet-panel"
        className={isMobile
          ? `absolute inset-x-0 bottom-0 ${peeking ? 'max-h-[22vh]' : 'max-h-[65vh]'} transition-[max-height] duration-300 ease-out rounded-t-2xl fa-sheet border-t shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom)]`
          : 'absolute left-0 top-0 bottom-0 w-full max-w-md pl:max-w-[min(420px,52vw)] pl:pl-[env(safe-area-inset-left)] fa-sheet border-r shadow-2xl flex flex-col'}
      >
        {/* Header — tapping it while the sheet is peeking brings the full sheet straight back. */}
        <div onClick={peeking ? cancelPeek : undefined} className="px-3 pt-2.5 pb-2 shrink-0 flex items-start gap-3">
          <span className="w-9 h-9 rounded-full fa-num text-[15px] font-semibold text-fa-ink flex items-center justify-center shrink-0 mt-0.5" style={{ background: colour }} aria-label={`Size ${regionState.size || 1}`}>{regionState.size || 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 id="city-sheet-title" className="fa-heading text-[19px] leading-tight truncate">{regionData.name}</h2>
              {sub && <span className="text-[12px] text-fa-muted truncate">{sub}</span>}
            </div>
            <div className="flex items-center gap-2 mt-1" title={`Loyalty ${loyalty}, heading to ${target}. Politics explains why.`}>
              <span className="fa-label">Loyalty</span>
              <Meter value={loyalty} max={100} color={loyalty <= 25 ? 'var(--fa-danger)' : loyalty < 50 ? 'var(--fa-enemy)' : 'var(--fa-good)'} className="flex-1 max-w-[9rem]" label={`Loyalty ${loyalty} of 100`} />
              <span className="fa-num text-[13px]">{loyalty}</span>
              {target !== loyalty && <span className={`fa-num text-[12px] ${target > loyalty ? 'text-fa-good' : 'text-fa-danger-text'}`}>{signed(target - loyalty)}</span>}
            </div>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <Tabs tabs={tabs} value={tab} onChange={setTab} label="City sections" className="shrink-0" />

        {/* Content */}
        <div className="p-3 overflow-y-auto flex-1 space-y-3">
          {tab === 'overview' && defense?.alert && (
            <div className="flex items-center gap-2 rounded-lg border border-fa-danger bg-[rgba(229,96,77,0.12)] pl-3 pr-1.5 py-1.5 text-[13px]" data-testid="city-damage-alert">
              <AlertTriangle className="w-4 h-4 text-fa-danger-text shrink-0" aria-hidden="true" />
              <span className="flex-1 min-w-0">{defense.alert.text}</span>
              <Button size="sm" onClick={() => setTab('defense')}>Details</Button>
            </div>
          )}
          {tab === 'overview' && <CityPanel cityId={regionId} view="overview" />}
          {tab === 'build' && <CityPanel cityId={regionId} view="build" />}
          {tab === 'tiles' && <CityPanel cityId={regionId} view="tiles" />}
          {tab === 'buildings' && <CityBuildings cityId={regionId} />}
          {tab === 'politics' && <CityPolitics cityId={regionId} />}
          {tab === 'defense' && defense && <CityDefense model={defense} />}
        </div>
      </div>
    </div>
  );
};

export default ProvinceModal;
