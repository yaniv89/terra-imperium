// src/components/map/MapModeToggle.jsx
// Switches MapContainer's main view between the 3D globe and the flat 2D map.
import React from 'react';
import { useMapInsets } from '../../context/MapInsetsContext';
import { Globe2, Map as MapIcon } from 'lucide-react';
import { useT } from '../../i18n/useT';

const MapModeToggle = ({ mode, onChange }) => {
  const insets=useMapInsets();
  const { t } = useT();
  return (
  <div style={{insetInlineEnd:insets.end+8}} className="absolute top-[calc(var(--header-height,2.25rem)+0.5rem)] z-10 flex bg-fa-panel/90 backdrop-blur-sm rounded-lg border border-fa-line shadow-xl overflow-hidden">
    <button
      onClick={() => onChange('globe')}
      className={`flex items-center gap-1 px-2.5 min-h-[40px] text-[11px] font-semibold transition-colors ${
        mode === 'globe' ? 'fa-selected' : 'text-fa-muted hover:text-fa-text hover:bg-fa-raised'
      }`}
      title={t('mapmode.globeTip')}
    >
      <Globe2 className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{t('mapmode.globe')}</span>
    </button>
    <button
      onClick={() => onChange('flat')}
      className={`flex items-center gap-1 px-2.5 min-h-[40px] text-[11px] font-semibold transition-colors border-s border-fa-line ${
        mode === 'flat' ? 'fa-selected' : 'text-fa-muted hover:text-fa-text hover:bg-fa-raised'
      }`}
      title={t('mapmode.flatTip')}
    >
      <MapIcon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{t('mapmode.flat')}</span>
    </button>
  </div>
  );
};

export default MapModeToggle;
