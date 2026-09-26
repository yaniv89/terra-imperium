// src/components/globe/MapLegend.jsx
// Legend for the globe's region fill colors

import React from 'react';
import { NATION_COLOR_PALETTE } from '../../data/nationColors';

// The 5 control bands only apply to YOUR OWN territory (GlobeView.jsx's fillColorFor) — every
// other nation gets its own distinct, stable color (src/data/nationColors.js) instead of a flat
// shared one, so there's no single swatch for "foreign": the sample strip below just shows a few
// real palette entries as a representative taste of it. A nation you're at war with keeps its own
// color and gets a red OUTLINE instead (GlobeView.jsx's strokeColor) rather than a fill override,
// so its identity stays visible the whole time you're fighting it.
const legendItems = [
  { color: 'bg-green-500', label: 'Your Territory: Controlled (80%+)' },
  { color: 'bg-lime-500', label: 'Your Territory: Strong (60-79%)' },
  { color: 'bg-yellow-500', label: 'Your Territory: Contested (40-59%)' },
  { color: 'bg-orange-500', label: 'Your Territory: Weak (20-39%)' },
  { color: 'bg-red-500', label: 'Your Territory: Critical (<20%)' }
];

// A handful of real, well-spread palette entries (not every color — there are 20, one per
// several nations) just to communicate "every nation has its own", sampled at a stride so
// neighboring palette entries (deliberately similar-hued light/dark pairs) don't all show at once.
const FOREIGN_SAMPLE_COLORS = NATION_COLOR_PALETTE.filter((_, i) => i % 4 === 0);

const MapLegend = ({ collapsed = false }) => {
  if (collapsed) {
    return (
      <div className="hidden lg:block bg-slate-900/90 backdrop-blur-sm p-1.5 rounded-lg border border-slate-700">
        <div className="flex gap-1">
          {legendItems.slice(0, 4).map((item, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded ${item.color}`}
              title={item.label}
            />
          ))}
        </div>
      </div>
    );
  }

  // A phone-sized screen has little room to spare even though the map is now full-bleed — an
  // always-on legend there would cover real map area for little benefit alongside the header/tab
  // bar HUD chrome. It only renders at the `lg` layout, where there's genuinely space for it.
  return (
    <div className="hidden lg:block bg-slate-900/90 backdrop-blur-sm p-2 rounded-lg text-xs space-y-1 border border-slate-700">
      <div className="text-slate-400 font-semibold mb-1.5 text-[10px] uppercase tracking-wide">
        Legend
      </div>
      {legendItems.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${item.color}`} />
          <span className="text-slate-300">{item.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {FOREIGN_SAMPLE_COLORS.map((color) => (
            <div key={color} className="w-2 h-3 rounded-sm" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span className="text-slate-300">Foreign Nations (each its own color)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded border-2 border-red-500 bg-slate-700" />
        <span className="text-slate-300">At War (red outline)</span>
      </div>
    </div>
  );
};

export default MapLegend;
