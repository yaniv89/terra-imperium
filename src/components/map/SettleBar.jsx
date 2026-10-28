// src/components/map/SettleBar.jsx
// The bar at the top of the map while a settler's site is being chosen (settleMode.js): whose
// settlers they are, what the colours mean, "Next good site" (the engine's ranked sites, one tap
// each, the map centred on it) and Cancel. It stays while sites are tapped and their sheet is
// closed; a phone held sideways gets a two-line strip so the land under it stays in view.
import React from 'react';
import { Tent, Compass, X } from 'lucide-react';
import { useMapInsets } from '../../context/MapInsetsContext';
import { useT } from '../../i18n/useT';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useMapToolFlag } from './mapTool';

const SettleBar = ({ model, onNext, onCancel }) => {
  // On a phone held sideways the site sheet stands on the left and the tab rail on the right: the
  // bar takes the room between them (it used to lie over the sheet's close button).
  const insets = useMapInsets();
  const phone = useLayoutMode() === 'phone-landscape';
  const { rtl, t } = useT();
  useMapToolFlag('settle', !!model);
  if (!model) return null;
  const between = phone ? { left: insets.left + (rtl ? 56 : 16), right: insets.right + (rtl ? 16 : 56), transform: 'none', width: 'auto' } : undefined;
  return (
    <div data-testid="settle-bar" data-map-hud="" role="status" style={between}
      className="absolute left-1/2 -translate-x-1/2 top-[calc(var(--header-height,4.5rem)+0.5rem)] z-30 w-[min(560px,calc(100%-1rem))] pl:w-[min(520px,calc(100%-9rem))] rounded-xl border border-amber-400/60 bg-fa-panel/95 shadow-2xl px-3 py-2 pl:py-1 text-[12px] pl:text-[11px] text-fa-text flex items-center gap-2">
      <Tent className="w-4 h-4 text-fa-brass shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0 leading-snug pl:line-clamp-2">
        <b>{model.title}</b>: <span data-testid="settle-hint">{model.hint}</span>
      </div>
      {model.nextLabel && (
        <button type="button" onClick={onNext} data-testid="settle-next-site"
          className="relative before:content-[''] before:absolute before:-inset-1 shrink-0 min-h-[36px] px-3 rounded-lg bg-amber-600 hover:bg-amber-500 font-semibold text-fa-text flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5" aria-hidden="true" />{model.nextLabel}
        </button>
      )}
      <button type="button" onClick={onCancel} aria-label={t('settle.stop')} title={t('settle.stop')} data-testid="settle-cancel"
        className="relative before:content-[''] before:absolute before:-inset-1 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-fa-raised text-fa-muted"><X className="w-4 h-4" /></button>
    </div>
  );
};

export default SettleBar;
