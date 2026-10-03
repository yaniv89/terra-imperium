// src/components/city/CityBuildings.jsx
// The city sheet's Buildings tab (plans/civ-map-rework.md E4): every line, what stands, the next
// tier with its production cost, and a one-tap queue. 44 px targets.
import React from 'react';
import { Plus, Check } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { cityBuildingsModel } from './cityPoliticsModel';

const CityBuildings = ({ cityId }) => {
  const { state, dispatch } = useGame();
  const rows = cityBuildingsModel(state, cityId);
  if (!rows) return null;
  const mine = state.regions[cityId]?.owner === state.playerNationId;
  return (
    <ul className="space-y-1" data-testid="city-buildings">
      {rows.map((r) => (
        <li key={r.category} className="flex items-center gap-2 rounded-lg px-2 py-1.5 min-h-[44px] text-xs bg-slate-800/60 border border-slate-700/60">
          <div className="min-w-0 flex-1">
            <div className="text-slate-100">{r.label}</div>
            <div className="text-slate-400 truncate">{r.built.length ? r.built.join(', ') : 'nothing yet'}{r.next ? ` · next ${r.next.name} (${r.next.cost})` : ' · complete'}{r.next?.needs ? ` · needs ${r.next.needs}` : ''}</div>
          </div>
          {r.next && mine && (r.next.queued
            ? <span className="text-emerald-300 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> queued</span>
            : <button type="button" disabled={!r.next.canBuild} onClick={() => dispatch({ type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId, item: { kind: 'building', category: r.category, tier: r.built.length } } })} aria-label={`Queue ${r.next.name}`} className="min-w-[44px] min-h-[44px] rounded-lg bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-40 text-white flex items-center justify-center"><Plus className="w-4 h-4" /></button>)}
        </li>
      ))}
    </ul>
  );
};

export default CityBuildings;
