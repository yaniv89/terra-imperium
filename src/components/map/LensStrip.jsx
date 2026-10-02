// src/components/map/LensStrip.jsx
// The lens strip (plans/civ-map-rework.md E5): one row of buttons bottom left; keys 1 to 5 on a
// keyboard (MapContainer binds them). 44 px targets.
import React from 'react';
import { Landmark, Wheat, Heart, Crosshair, Package } from 'lucide-react';
import { LENSES } from './lenses';

const ICONS = { political: Landmark, yields: Wheat, loyalty: Heart, threat: Crosshair, supply: Package };

const LensStrip = ({ lens, onChange }) => (
  <div className="flex bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 shadow-xl overflow-hidden pointer-events-auto" data-testid="lens-strip" role="radiogroup" aria-label="Map lens">
    {LENSES.map((l) => {
      const Icon = ICONS[l.id];
      const on = lens === l.id;
      return (
        <button key={l.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(l.id)} title={`${l.label} (${l.key}): ${l.hint}`} data-lens={l.id}
          className={`flex items-center justify-center min-w-[44px] min-h-[44px] text-[10px] font-semibold transition-colors ${on ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
          <Icon className="w-4 h-4" />
        </button>
      );
    })}
  </div>
);

export default LensStrip;
