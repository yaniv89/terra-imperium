// src/components/city/CityRail.jsx
// The desktop city list rail (plans/civ-map-rework.md E2): docked on the left under the header,
// collapsible (remembered per browser), one 44 px row per city with size, growth, what it builds
// and the flags; tapping a row opens the city card. Desktop only: phones and tablets keep the map.
// The C key toggles it. Reports its width so the map centres in the space left (MapInsets).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Building2, Castle, Flame, AlertTriangle, Hourglass, Crown } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useReportInset } from '../../context/MapInsetsContext';
import { cityRailModel, RAIL_STORAGE_KEY } from './cityRailModel';
import GameIcon from '../ui/GameIcon';

const readCollapsed = () => { try { return localStorage.getItem(RAIL_STORAGE_KEY) === '1'; } catch { return false; } };

const CityRail = ({ onSelectRegion }) => {
  const { state } = useGame();
  const desktop = useLayoutMode() === 'desktop';
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const ref = useRef(null);
  const rows = useMemo(() => cityRailModel(state), [state]);
  useReportInset('city-rail', 'left', ref, desktop && !collapsed);
  useEffect(() => { try { localStorage.setItem(RAIL_STORAGE_KEY, collapsed ? '1' : '0'); } catch { /* storage disabled */ } }, [collapsed]);
  useEffect(() => {
    if (!desktop) return undefined;
    const onKey = (e) => { if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) setCollapsed((v) => !v); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desktop]);
  if (!desktop || !rows.length) return null;
  if (collapsed) {
    return (
      <button type="button" onClick={() => setCollapsed(false)} data-testid="city-rail-open" title="Cities (C)" aria-label="Show the city list"
        className="fixed left-0 top-[calc(var(--header-height,4.5rem)+0.5rem)] z-20 min-w-[44px] min-h-[44px] rounded-r-lg bg-slate-900/90 border border-l-0 border-slate-700 text-slate-300 hover:text-white flex items-center justify-center gap-1 px-1">
        <Building2 className="w-4 h-4" /><ChevronRight className="w-3 h-3" />
      </button>
    );
  }
  return (
    <div ref={ref} data-testid="city-rail" className="fixed left-0 top-[var(--header-height,4.5rem)] bottom-0 z-20 w-64 bg-slate-900/90 backdrop-blur-md border-r border-slate-700/60 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60 shrink-0">
        <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-blue-300" />Cities <span className="text-slate-500 font-normal">({rows.length})</span></div>
        <button type="button" onClick={() => setCollapsed(true)} aria-label="Hide the city list" title="Hide (C)" className="min-w-[32px] min-h-[32px] rounded text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
      </div>
      <ul className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onSelectRegion?.(r.id)} data-testid="city-rail-row" data-city-id={r.id} className="w-full text-left px-3 py-1.5 min-h-[44px] border-b border-slate-800/80 hover:bg-slate-800/70 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-slate-800 border border-slate-600 text-[11px] font-bold text-white flex items-center justify-center shrink-0">{r.size}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-xs text-slate-100 truncate">{r.capital && <GameIcon group="markers" id="capital" size={14} title="Capital" fallback={<Crown className="w-3 h-3 text-amber-300 shrink-0" />} />}{r.name}{r.outpost ? <span className="text-slate-500"> (outpost)</span> : ''}</span>
                <span className="block text-[10px] text-slate-400 truncate">
                  {r.outpost ? 'Growing into a city' : r.idle ? 'Nothing queued' : `${r.building}${r.buildTurns ? ` · ${r.buildTurns} t` : ''}`}
                  {r.growthTurns ? ` · grows in ${r.growthTurns}` : ''}
                </span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                {r.idle && <Hourglass className="w-3.5 h-3.5 text-amber-300" title="Nothing queued" />}
                {r.besieged && <Castle className="w-3.5 h-3.5 text-red-300" title="Under siege" />}
                {r.starving && <Flame className="w-3.5 h-3.5 text-orange-300" title="Starving" />}
                {r.restless && <AlertTriangle className="w-3.5 h-3.5 text-red-300" title={`Unrest ${r.unrest}`} />}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CityRail;
