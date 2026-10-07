// src/components/map/LensStrip.jsx
// The map lenses (plans/playtest-1.md P1.5, W04 in plans/UI-DESIGN.md): one pill names the current
// lens; tapping it opens the lens list with a one-line hint each, closing after a pick. Keys 1 to 7
// on a keyboard (MapContainer binds them), Escape closes the list. With the Settle lens on, a legend
// says what the green and red tiles mean and the spacing rule; a red tile's reason shows when it is
// tapped (the tile sheet). 44 px targets; selection is a raised fill with a light outline.
// Phones (plans/ui/fix-mobile, bug 2): the open list is two columns without hints, never taller than
// the room between its bottom and the top bar, and scrolls with a finger when it still does not fit;
// with any lens other than Political on, a round button beside the pill goes back in one tap.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Landmark, Wheat, Heart, Crosshair, Package, Coins, Tent, Layers, X } from 'lucide-react';
import { LENSES } from './lenses';
import { CITY_SPACING_KM, citySpacingRings } from '../../data/geo/citySpacing';
import { getTiles } from '../../data/geo/tiles';
import { useLayoutMode } from '../../hooks/useLayoutMode';

export const ICONS = { political: Landmark, yields: Wheat, loyalty: Heart, threat: Crosshair, supply: Package, trade: Coins, settle: Tent };

const SettleLegend = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 min-h-[32px] rounded-full bg-fa-panel/95 border border-fa-line text-[12px] text-fa-text pointer-events-auto shadow-lg" data-testid="settle-legend">
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-fa-good/80" aria-hidden="true" />Can found</span>
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-fa-danger/80" aria-hidden="true" />Blocked, tap for why</span>
    <span className="font-semibold">Cities <span className="fa-num">{citySpacingRings(getTiles())}</span> tiles apart (about <span className="fa-num">{CITY_SPACING_KM}</span> km)</span>
  </div>
);

/**
 * How tall the open list may be: from its bottom edge up to just under the top bar. The list grows
 * upward from the map's bottom-left corner; on a phone held sideways seven 44 px rows did not fit,
 * the top ones (Political first) went under the top bar and nothing scrolled.
 */
export const lensListMaxHeight = (bottom, headerHeight, gap = 8) => Math.max(96, Math.floor(bottom - headerHeight - gap));

const headerHeightPx = () => {
  if (typeof document === 'undefined') return 36;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height'));
  return Number.isFinite(v) ? v : 36;
};

const LensStrip = ({ lens, onChange, onOpenChange }) => {
  const [open, setOpenState] = useState(false);
  const [maxH, setMaxH] = useState(null);
  const panelRef = useRef(null);
  const layout = useLayoutMode();
  // phones and tablets: two columns, the hint only as the button's title
  const compact = layout !== 'desktop';
  const current = LENSES.find((l) => l.id === lens) || LENSES[0];
  const Icon = ICONS[current.id] || Layers;
  const setOpen = (v) => { setOpenState(v); onOpenChange?.(v); };
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  useLayoutEffect(() => {
    if (!open) return undefined;
    const fit = () => { const el = panelRef.current; if (el) setMaxH(lensListMaxHeight(el.getBoundingClientRect().bottom, headerHeightPx())); };
    fit();
    // keep the active lens in view inside the list
    panelRef.current?.querySelector('[aria-checked="true"]')?.scrollIntoView?.({ block: 'nearest' });
    const onKey = (e) => { if (e.key === 'Escape') setOpenRef.current(false); };
    window.addEventListener('resize', fit);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const pick = (id) => { onChange(id); setOpen(false); };

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        {lens === 'settle' && <SettleLegend />}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setOpen(true)} data-testid="lens-pill" title="Map lens: what the map colours show" aria-label={`Map lens: ${current.label}`}
            className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-full bg-fa-panel/95 border border-fa-line shadow-xl text-[12px] font-semibold text-fa-text pointer-events-auto hover:bg-fa-raised">
            <Layers className="w-4 h-4 text-fa-muted" aria-hidden="true" /><Icon className="w-4 h-4" aria-hidden="true" /> {current.label}
          </button>
          {lens !== 'political' && (
            <button type="button" onClick={() => onChange('political')} data-testid="lens-political" aria-label="Back to the Political map" title="Back to the Political map"
              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-fa-panel/95 border border-fa-line shadow-xl text-fa-text pointer-events-auto hover:bg-fa-raised">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div ref={panelRef} style={maxH ? { maxHeight: maxH } : undefined}
      className={`fa-panel shadow-2xl pointer-events-auto flex flex-col overflow-hidden ${compact ? 'w-[min(340px,calc(100vw-6rem))]' : 'w-[240px]'}`}
      data-testid="lens-strip" role="radiogroup" aria-label="Map lens">
      <div className="flex items-center justify-between pl-3 pr-1 pt-1 shrink-0">
        <span className="fa-label">Map lens</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close lenses" className="w-11 h-11 flex items-center justify-center text-fa-muted hover:text-fa-text"><X className="w-4 h-4" /></button>
      </div>
      <div className={`p-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y scrollbar-thin ${compact ? 'grid grid-cols-2 gap-0.5' : 'space-y-0.5'}`} data-testid="lens-list">
        {LENSES.map((l) => {
          const LIcon = ICONS[l.id] || Layers;
          const on = lens === l.id;
          return (
            <button key={l.id} type="button" role="radio" aria-checked={on} onClick={() => pick(l.id)} data-lens={l.id} title={l.hint}
              className={`w-full flex items-center gap-2.5 px-2.5 min-h-[44px] rounded-lg text-left ${on ? 'fa-selected' : 'text-fa-text hover:bg-fa-raised'}`}>
              <LIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold leading-tight">{l.label} <span className="fa-num text-fa-muted font-normal text-[11px]">{l.key}</span></span>
                {!compact && <span className="block text-[11px] text-fa-muted truncate">{l.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LensStrip;
