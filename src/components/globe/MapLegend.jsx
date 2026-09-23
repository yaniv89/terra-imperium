// src/components/globe/MapLegend.jsx
// Legend for the globe's region fill colors

import React from 'react';

// The 5 control bands below only apply to YOUR OWN territory (GlobeView.jsx's fillColorFor) —
// a foreign nation instead keeps its own color (so the map stays readable as "whose territory is
// this" at a glance) with that same color darkening as ITS control drops, shown here as one
// gradient swatch rather than 5 discrete ones since the actual hue varies per nation.
const legendItems = [
  { color: 'bg-green-500', label: 'Your Territory: Controlled (80%+)' },
  { color: 'bg-lime-500', label: 'Your Territory: Strong (60-79%)' },
  { color: 'bg-yellow-500', label: 'Your Territory: Contested (40-59%)' },
  { color: 'bg-orange-500', label: 'Your Territory: Weak (20-39%)' },
  { color: 'bg-red-500', label: 'Your Territory: Critical (<20%)' },
  { color: 'bg-gradient-to-r from-slate-700 to-slate-300', label: 'Foreign: own color, darker = weaker hold' },
  { color: 'bg-red-500 animate-pulse', label: 'At War', border: 'border-2 border-red-400' },
  { color: 'bg-transparent', label: 'Your Border', border: 'border-2 border-amber-400' }
];

const MapLegend = ({ collapsed = false }) => {
  if (collapsed) {
    return (
      <div className="hidden lg:block absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur-sm p-1.5 rounded-lg border border-slate-700 z-10">
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

  // The globe shares vertical space with the rest of the UI on mobile (App.jsx stacks
  // everything in a column below `lg`, leaving the globe only ~250px tall), so an always-on
  // legend there covers real map area for little benefit. It only renders at the `lg` layout,
  // where the globe gets a dedicated two-thirds-width column with room to spare.
  return (
    <div className="hidden lg:block absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur-sm p-2 rounded-lg text-xs space-y-1 border border-slate-700 z-10">
      <div className="text-slate-400 font-semibold mb-1.5 text-[10px] uppercase tracking-wide">
        Legend
      </div>
      {legendItems.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${item.color} ${item.border || ''}`} />
          <span className="text-slate-300">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default MapLegend;
