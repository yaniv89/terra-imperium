// src/components/panels/DiplomacyPanel.jsx
// Diplomacy tab — a browsable, read-only view of relations with all 240 nations. The full action
// set described in the plan (Declare War with a chosen casus belli, Trade Agreements, Alliances,
// Vassalize, Espionage, ...) is Phase D work, built against the new diplomacy/casus-belli system.

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { WORLD_NATIONS } from '../../data/worldNations';
import { formatNumber, getRelationColor } from '../../utils/helpers';

const DiplomacyPanel = () => {
  const { state } = useGame();
  const [search, setSearch] = useState('');

  // Sort nations: at war first, then by hostility, so the ones that matter surface first; the
  // search box is for finding one specific nation among all 240.
  const sortedNations = useMemo(() => {
    return Object.values(state.nations)
      .filter(n => !n.isPlayer)
      .filter(n => !search.trim() || n.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => {
        if (a.isAtWar !== b.isAtWar) return a.isAtWar ? -1 : 1;
        return b.hostility - a.hostility;
      });
  }, [state.nations, search]);

  return (
    <div className="space-y-2">
      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nations..."
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600">
        {sortedNations.map(nation => {
          const nationData = WORLD_NATIONS[nation.id];

          return (
            <div
              key={nation.id}
              className={`
                p-3 rounded-lg border transition-all
                ${nation.isAtWar
                  ? 'bg-red-500/10 border-red-500/30'
                  : nation.hasPeaceTreaty
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-slate-800/50 border-slate-700'
                }
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold text-sm text-white flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: nationData?.color }}
                    />
                    {nation.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-xs font-medium"
                      style={{ color: getRelationColor(nation.relationStatus) }}
                    >
                      {nation.relationStatus}
                    </span>
                    {nation.doctrine && (
                      <span className="text-[9px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1">
                        {nation.doctrine}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-slate-400">
                    Hostility: <span className="text-orange-400 font-mono">{nation.hostility}</span>
                  </div>
                  <div className="text-slate-400">
                    Military: <span className="text-red-400 font-mono">{formatNumber(nation.militaryStrength)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {nation.hasPeaceTreaty && (
                  <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
                    ✓ Peace Treaty
                  </span>
                )}
                {nation.hasTradeAgreement && (
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                    ✓ Trade Agreement
                  </span>
                )}
                {nation.hasMilitaryPact && (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px]">
                    ✓ Military Pact
                  </span>
                )}
                {nation.isAtWar && (
                  <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] animate-pulse">
                    ⚔ AT WAR
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 p-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-red-400 font-bold">{sortedNations.filter(n => n.isAtWar).length}</div>
            <div className="text-slate-500">At War</div>
          </div>
          <div>
            <div className="text-green-400 font-bold">{sortedNations.filter(n => n.hasPeaceTreaty).length}</div>
            <div className="text-slate-500">Peace</div>
          </div>
          <div>
            <div className="text-blue-400 font-bold">{sortedNations.filter(n => n.hasTradeAgreement).length}</div>
            <div className="text-slate-500">Trade</div>
          </div>
        </div>
      </div>

      <div className="text-slate-500 text-xs text-center pt-2">
        War, trade and alliance actions are coming in a future update.
      </div>
    </div>
  );
};

export default DiplomacyPanel;
