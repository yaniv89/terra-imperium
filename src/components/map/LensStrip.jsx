// src/components/map/LensStrip.jsx
// The map lenses (plans/playtest-1.md P1.5, W04 in plans/UI-DESIGN.md): one pill names the current
// lens; tapping it opens the lens list with a one-line hint each, closing after a pick. Keys 1 to 7
// on a keyboard (MapContainer binds them). With the Settle lens on, a legend says what the green
// and red tiles mean and the spacing rule; a red tile's reason shows when it is tapped (the tile
// sheet). 44 px targets; selection is a raised fill with a light outline.
import React, { useState } from 'react';
import { Landmark, Wheat, Heart, Crosshair, Package, Coins, Tent, Layers, X } from 'lucide-react';
import { LENSES } from './lenses';
import { CITY_SPACING_KM, citySpacingRings } from '../../data/geo/citySpacing';
import { getTiles } from '../../data/geo/tiles';

export const ICONS = { political: Landmark, yields: Wheat, loyalty: Heart, threat: Crosshair, supply: Package, trade: Coins, settle: Tent };

const SettleLegend = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 min-h-[32px] rounded-full bg-fa-panel/95 border border-fa-line text-[12px] text-fa-text pointer-events-auto shadow-lg" data-testid="settle-legend">
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-fa-good/80" aria-hidden="true" />Can found</span>
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-fa-danger/80" aria-hidden="true" />Blocked, tap for why</span>
    <span className="font-semibold">Cities <span className="fa-num">{citySpacingRings(getTiles())}</span> tiles apart (about <span className="fa-num">{CITY_SPACING_KM}</span> km)</span>
  </div>
);

const LensStrip = ({ lens, onChange }) => {
  const [open, setOpen] = useState(false);
  const current = LENSES.find((l) => l.id === lens) || LENSES[0];
  const Icon = ICONS[current.id] || Layers;
  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        {lens === 'settle' && <SettleLegend />}
        <button type="button" onClick={() => setOpen(true)} data-testid="lens-pill" title="Map lens: what the map colours show" aria-label={`Map lens: ${current.label}`}
          className="flex items-center gap-1.5 min-h-[40px] px-3 rounded-full bg-fa-panel/95 border border-fa-line shadow-xl text-[12px] font-semibold text-fa-text pointer-events-auto hover:bg-fa-raised">
          <Layers className="w-4 h-4 text-fa-muted" aria-hidden="true" /><Icon className="w-4 h-4" aria-hidden="true" /> {current.label}
        </button>
      </div>
    );
  }
  return (
    <div className="fa-panel shadow-2xl overflow-hidden pointer-events-auto w-[240px]" data-testid="lens-strip" role="radiogroup" aria-label="Map lens">
      <div className="flex items-center justify-between pl-3 pr-1 pt-1"><span className="fa-label">Map lens</span><button type="button" onClick={() => setOpen(false)} aria-label="Close lenses" className="w-10 h-10 flex items-center justify-center text-fa-muted hover:text-fa-text"><X className="w-4 h-4" /></button></div>
      <div className="p-1 space-y-0.5">
        {LENSES.map((l) => {
          const LIcon = ICONS[l.id] || Layers;
          const on = lens === l.id;
          return (
            <button key={l.id} type="button" role="radio" aria-checked={on} onClick={() => { onChange(l.id); setOpen(false); }} data-lens={l.id}
              className={`w-full flex items-center gap-2.5 px-2.5 min-h-[44px] rounded-lg text-left ${on ? 'fa-selected' : 'text-fa-text hover:bg-fa-raised'}`}>
              <LIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0"><span className="block text-[13px] font-semibold leading-tight">{l.label} <span className="fa-num text-fa-muted font-normal text-[11px]">{l.key}</span></span><span className="block text-[11px] text-fa-muted truncate">{l.hint}</span></span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LensStrip;
