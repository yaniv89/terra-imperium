// src/components/map/MapSettings.jsx
// The map's two settings (mapPrefs.js) in the settings window: the old SVG map instead of the
// WebGL map, and the globe (hidden by default, leaving in a later release).
import React from 'react';
import { useMapPrefs, setMapPrefs } from './mapPrefs';

const MapSettings = () => {
  const prefs = useMapPrefs();
  return (
    <div className="space-y-2 mb-4" data-testid="map-settings">
      <p className="text-slate-400 text-xs uppercase tracking-wide font-semibold">Map</p>
      <label className="flex items-start gap-2 text-sm text-slate-200 cursor-pointer">
        <input type="checkbox" className="w-5 h-5 mt-0.5" checked={prefs.renderer === 'svg'} onChange={(e) => setMapPrefs({ renderer: e.target.checked ? 'svg' : 'webgl' })} data-testid="map-old-renderer" />
        <span>Old map drawing<span className="block text-xs text-slate-500">The previous, slower map. Only if the new map shows something wrong on this device.</span></span>
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-200 cursor-pointer">
        <input type="checkbox" className="w-5 h-5 mt-0.5" checked={prefs.globe} onChange={(e) => setMapPrefs({ globe: e.target.checked })} data-testid="map-show-globe" />
        <span>Show the globe<span className="block text-xs text-slate-500">The old 3D globe view and its switch. It leaves the game in a coming release.</span></span>
      </label>
    </div>
  );
};

export default MapSettings;
