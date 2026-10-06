// src/components/city/CityRail.jsx
// The desktop city list rail (plans/civ-map-rework.md E2): docked on the left under the top bar,
// collapsible (remembered per browser), one row per city (CityList.jsx); tapping a row opens the
// city card. Desktop only: phones and tablets have the Cities tab on the rail. The C key toggles
// it. Reports its width so the map centres in the space left (MapInsets).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useReportInset } from '../../context/MapInsetsContext';
import { cityRailModel, RAIL_STORAGE_KEY } from './cityRailModel';
import CityList from './CityList';

const readCollapsed = () => { try { return localStorage.getItem(RAIL_STORAGE_KEY) === '1'; } catch { return false; } };

const CityRail = ({ onSelectRegion }) => {
  const { state } = useGame();
  const desktop = useLayoutMode() === 'desktop';
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const ref = useRef(null);
  const count = useMemo(() => cityRailModel(state).length, [state]);
  useReportInset('city-rail', 'left', ref, desktop && !collapsed);
  useEffect(() => { try { localStorage.setItem(RAIL_STORAGE_KEY, collapsed ? '1' : '0'); } catch { /* storage disabled */ } }, [collapsed]);
  // --city-rail-w: what the list covers on the left, so the "needs you" chips sit beside it.
  const shown = desktop && !!count;
  useEffect(() => {
    document.documentElement.style.setProperty('--city-rail-w', shown ? (collapsed ? '48px' : '256px') : '0px');
    return () => document.documentElement.style.setProperty('--city-rail-w', '0px');
  }, [shown, collapsed]);
  useEffect(() => {
    if (!desktop) return undefined;
    const onKey = (e) => { if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) setCollapsed((v) => !v); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desktop]);
  if (!desktop || !count) return null;
  if (collapsed) {
    return (
      <button type="button" onClick={() => setCollapsed(false)} data-testid="city-rail-open" title="Cities (C)" aria-label="Show the city list"
        className="fixed left-0 top-[calc(var(--header-height,2.25rem)+0.5rem)] z-20 min-w-[44px] min-h-[44px] rounded-r-lg bg-fa-panel/95 border border-l-0 border-fa-line text-fa-muted hover:text-fa-text flex items-center justify-center gap-1 px-1">
        <Building2 className="w-4 h-4" /><ChevronRight className="w-3 h-3" />
      </button>
    );
  }
  return (
    <div ref={ref} data-testid="city-rail" className="fixed left-0 top-[var(--header-height,2.25rem)] bottom-0 z-20 w-64 bg-fa-panel/95 border-r border-fa-line flex flex-col text-fa-text">
      <div className="flex items-center justify-between pl-3 pr-1 py-1 border-b border-fa-line shrink-0">
        <div className="fa-label flex items-center gap-1.5"><Building2 className="w-4 h-4" />Cities <span className="fa-num tracking-normal">{count}</span></div>
        <button type="button" onClick={() => setCollapsed(true)} aria-label="Hide the city list" title="Hide (C)" className="min-w-[40px] min-h-[40px] rounded text-fa-muted hover:text-fa-text hover:bg-fa-raised flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <CityList onSelect={onSelectRegion} compact />
      </div>
    </div>
  );
};

export default CityRail;
