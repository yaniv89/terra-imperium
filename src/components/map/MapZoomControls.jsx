// src/components/map/MapZoomControls.jsx
// The flat map's zoom buttons, folded into one small round button on the right edge (map HUD
// cleanup: the three-button column took too much of a phone's 390 px height). A tap opens zoom in,
// zoom out and reset view under it; a second tap folds them away. Pinch and wheel zoom never need
// it. Every button stays a 40 px touch target (the open column folds if it would not fit a short phone: it scrolls).
// With `findCities` the open panel also has a Find a city box beside the button (the magnifier promised a search).
import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, Search, X, Landmark, Swords } from 'lucide-react';
import { useT } from '../../i18n/useT';

const BTN = 'w-10 h-10 flex items-center justify-center text-fa-text hover:bg-fa-raised transition-colors disabled:opacity-30 disabled:hover:bg-transparent';

// Reset is "Fit world" (the whole world, mostly fog early on); Home (the capital) and Army (the
// selected army) are the two places a player wants back (MAP-01); each shows only when it has a place.
const MapZoomControls = ({ onZoomIn, onZoomOut, onReset, onHome = null, onArmy = null, canZoomIn = true, canZoomOut = true, canReset = true, className = '', style, findCities = null, onFindCity = null }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const found = open && findCities ? findCities(query) : [];
  const { t } = useT();
  return (
    <div style={style} className={`absolute z-10 flex flex-col items-center gap-1.5 ${className}`} data-testid="map-zoom-controls" data-map-hud="">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t('zoom.controls')}
        title={open ? t('zoom.hide') : t('zoom.show')}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-fa-panel/90 border border-fa-line shadow-lg text-fa-text hover:bg-fa-raised">
        {open ? <X className="w-4 h-4" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
      </button>
      {open && findCities && (
        <div className="absolute top-0 end-12 w-48 bg-fa-panel/95 rounded-lg border border-fa-line shadow-xl p-1.5" data-testid="map-city-search">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('zoom.findCity')} aria-label={t('zoom.findCity')} className="fa-input w-full !min-h-[36px] text-[13px]" />
          {found.map((c) => (
            <button key={c.id} type="button" onClick={() => { onFindCity(c.id); setOpen(false); setQuery(''); }} data-testid="map-city-found"
              className={`w-full text-start px-2 min-h-[36px] rounded hover:bg-fa-raised text-[13px] truncate ${c.mine ? 'text-fa-you' : 'text-fa-text'}`}>{c.name}</button>
          ))}
        </div>
      )}
      {open && (
        <div className="flex flex-col bg-fa-panel/95 rounded-lg border border-fa-line shadow-xl overflow-y-auto max-h-[calc(100dvh-var(--header-height,2.25rem)-4.5rem)]">
          <button type="button" onClick={onZoomIn} disabled={!canZoomIn} className={BTN} title={t('zoom.in')} aria-label={t('zoom.in')}>
            <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={onZoomOut} disabled={!canZoomOut} className={`${BTN} border-t border-fa-line`} title={t('zoom.out')} aria-label={t('zoom.out')}>
            <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={onReset} disabled={!canReset} className={`${BTN} border-t border-fa-line`} title={t('zoom.fit')} aria-label={t('zoom.fit')} data-testid="map-fit-world">
            <Maximize className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          {onHome && (
            <button type="button" onClick={onHome} className={`${BTN} border-t border-fa-line`} title={t('zoom.homeTip')} aria-label={t('zoom.home')} data-testid="map-home">
              <Landmark className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          {onArmy && (
            <button type="button" onClick={onArmy} className={`${BTN} border-t border-fa-line`} title={t('zoom.army')} aria-label={t('zoom.army')} data-testid="map-army">
              <Swords className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MapZoomControls;
