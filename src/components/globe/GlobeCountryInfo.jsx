// src/components/globe/GlobeCountryInfo.jsx
// Read-only info card for a globe country click. Deliberately NOT wired to the game's real
// action system (RegionInfoModal, ActionPanel, etc.) — the globe's country ids (real-world ISO
// codes) don't correspond to the game's hand-authored region ids yet. That join happens in
// Phase 13, once regions/nations are rebuilt on the real world data.
import React from 'react';
import { X, Globe2 } from 'lucide-react';
import countriesMeta from '../../data/geo/countries-meta.json';
import { COUNTRY_HIGHLIGHT_COLORS } from './nationCountryMap';

const GlobeCountryInfo = ({ countryId, onClose }) => {
  if (!countryId) return null;
  const meta = countriesMeta[countryId];
  if (!meta) return null;

  const isConflictNation = Boolean(COUNTRY_HIGHLIGHT_COLORS[countryId]);

  return (
    <div className="absolute top-2 left-2 z-10 bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-700 p-3 max-w-[220px] shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-white font-semibold text-sm">
          <Globe2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          {meta.name}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {meta.continent && <div className="text-xs text-slate-400 mt-1">{meta.continent}</div>}
      {isConflictNation ? (
        <div className="text-xs text-amber-400 mt-2">Playable on the flat map — switch views for details.</div>
      ) : (
        <div className="text-xs text-slate-500 mt-2">Not yet part of the playable campaign.</div>
      )}
    </div>
  );
};

export default GlobeCountryInfo;
