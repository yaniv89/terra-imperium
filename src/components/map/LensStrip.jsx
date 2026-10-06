// src/components/map/LensStrip.jsx
// The lens pill (plans/playtest-1.md P1.5): one small pill names the current lens; tapping it
// opens the strip with a label and a one-line hint per lens, closing after a pick. Keys 1 to 7
// on a keyboard (MapContainer binds them). 44 px targets.
import React, { useState } from 'react';
import { Landmark, Wheat, Heart, Crosshair, Package, Coins, Tent, Layers, X } from 'lucide-react';
import { LENSES } from './lenses';

export const ICONS = { political: Landmark, yields: Wheat, loyalty: Heart, threat: Crosshair, supply: Package, trade: Coins, settle: Tent };

const LensStrip = ({ lens, onChange }) => {
  const [open, setOpen] = useState(false);
  const current = LENSES.find((l) => l.id === lens) || LENSES[0];
  const Icon = ICONS[current.id] || Layers;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} data-testid="lens-pill" title="Map lens: what the map colours show" aria-label={`Map lens: ${current.label}`}
        className="flex items-center gap-1.5 min-h-[36px] px-2.5 rounded-full bg-slate-900/90 backdrop-blur-sm border border-slate-700 shadow-xl text-[11px] font-semibold text-slate-200 pointer-events-auto">
        <Icon className="w-3.5 h-3.5 text-emerald-300" /> {current.label}
      </button>
    );
  }
  return (
    <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl border border-slate-700 shadow-xl overflow-hidden pointer-events-auto w-[220px]" data-testid="lens-strip" role="radiogroup" aria-label="Map lens">
      <div className="flex items-center justify-between px-2.5 pt-1.5 text-[10px] uppercase tracking-wide text-slate-500">Map lens <button type="button" onClick={() => setOpen(false)} aria-label="Close lenses" className="p-1 -m-1 text-slate-400"><X className="w-3.5 h-3.5" /></button></div>
      {LENSES.map((l) => {
        const LIcon = ICONS[l.id] || Layers;
        const on = lens === l.id;
        return (
          <button key={l.id} type="button" role="radio" aria-checked={on} onClick={() => { onChange(l.id); setOpen(false); }} data-lens={l.id}
            className={`w-full flex items-center gap-2 px-2.5 min-h-[44px] text-left transition-colors ${on ? 'bg-emerald-800/60 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
            <LIcon className="w-4 h-4 shrink-0" />
            <span className="min-w-0"><span className="block text-xs font-semibold">{l.label} <span className="text-slate-500 font-normal">{l.key}</span></span><span className="block text-[10px] text-slate-400 truncate">{l.hint}</span></span>
          </button>
        );
      })}
    </div>
  );
};

export default LensStrip;
