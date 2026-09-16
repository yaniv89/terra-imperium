// src/components/globe/MapLegend.jsx
// Legend for the globe's region fill colors

import React from 'react';

const legendItems = [
  { color: 'bg-green-500', label: 'Controlled (80%+)' },
  { color: 'bg-lime-500', label: 'Strong (60-79%)' },
  { color: 'bg-yellow-500', label: 'Contested (40-59%)' },
  { color: 'bg-orange-500', label: 'Weak (20-39%)' },
  { color: 'bg-red-500', label: 'Critical (<20%)' },
  { color: 'bg-slate-500', label: 'Foreign' },
  { color: 'bg-red-500 animate-pulse', label: 'At War', border: 'border-2 border-red-400' }
];

const MapLegend = ({ collapsed = false }) => {
  if (collapsed) {
    return (
      <div className="absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur-sm p-1.5 rounded-lg border border-slate-700 z-10">
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

  return (
    <div className="absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur-sm p-2 rounded-lg text-xs space-y-1 border border-slate-700 z-10">
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
