// src/components/panels/DiplomacyPanel.jsx
// Diplomacy panel - relations with other nations

import React, { useMemo, useState } from 'react';
// FIX: Replaced 'Handshake' with 'Flag' to resolve the export error
import { Flag, ShoppingCart, Shield, AlertTriangle, Crosshair, Swords as SwordsGoal, Search } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GamePhases, ActionTypes } from '../../data/types';
import { WORLD_NATIONS as NATIONS_DATA } from '../../data/worldNations';
import { REGIONS_DATA } from '../../data/regions';
import { canAfford, formatNumber, getRelationColor } from '../../utils/helpers';
import { ACTION_COSTS } from '../../data/actionCosts';

// Short, human-readable description of a war goal (Phase 7) for the diplomacy card.
const describeWarGoal = (goal) => {
  if (!goal) return null;
  if (goal.type === 'capture_region') return `Capture ${REGIONS_DATA[goal.regionId]?.name || goal.regionId}`;
  if (goal.type === 'destroy_military') return `Reduce enemy military to ${formatNumber(goal.threshold)}`;
  return null;
};

const DiplomacyPanel = () => {
  const { state, dispatch, addLog } = useGame();
  const [search, setSearch] = useState('');

  const isPreState = state.phase === GamePhases.PRE_STATE;

  // Sort nations: at war first, then by hostility. With the whole world in state.nations (Phase
  // 13), this naturally pushes the ~225 passive/neutral generated nations (flat hostility: 5) to
  // the bottom, so the original conflict's nations still surface first by default — the search
  // box below is for the rest.
  const sortedNations = useMemo(() => {
    return Object.values(state.nations)
      .filter(n => !n.isPlayer)
      .filter(n => !search.trim() || n.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => {
        if (a.isAtWar !== b.isAtWar) return a.isAtWar ? -1 : 1;
        return b.hostility - a.hostility;
      });
  }, [state.nations, search]);

  // The single active war against a given nation, if any — used to show its goal (Phase 7).
  const activeWarWith = (nationId) => state.wars.find(w => w.enemy === nationId && w.active);

  // Declare War. goalType lets the player choose what this war is fought for; omitting it keeps
  // the doctrine-style auto-assigned default (see assignDefaultWarGoal in diplomacy.js).
  const handleDeclareWar = (nationId, goalType) => {
    if (isPreState) {
      addLog('Cannot declare war before independence', 'action');
      return;
    }
    const nation = state.nations[nationId];
    if (nation.isAtWar) {
      addLog('Already at war', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.declareWar)) {
      addLog('Need 20 Diplomacy Points to declare war', 'action');
      return;
    }
    dispatch({ type: ActionTypes.DECLARE_WAR_COSTED, payload: { nationId, goalType } });
  };

  // Seek Peace
  const handleSeekPeace = (nationId) => {
    const nation = state.nations[nationId];
    if (!nation.isAtWar) {
      addLog('Not at war with this nation', 'action');
      return;
    }
    if (nation.hostility > 60) {
      addLog('Nation too hostile for peace negotiations (need <60 hostility)', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.seekPeace)) {
      addLog('Not enough resources for peace treaty', 'action');
      return;
    }
    dispatch({ type: ActionTypes.SEEK_PEACE, payload: { nationId } });
  };

  // Sign Trade Agreement
  const handleSignTrade = (nationId) => {
    const nation = state.nations[nationId];
    if (!nation.hasPeaceTreaty) {
      addLog('Need peace treaty first', 'action');
      return;
    }
    if (nation.hasTradeAgreement) {
      addLog('Trade agreement already active', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.signTrade)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.SIGN_TRADE_COSTED, payload: { nationId } });
  };

  // Sign Military Pact
  const handleMilitaryPact = (nationId) => {
    const nation = state.nations[nationId];
    if (!nation.hasTradeAgreement) {
      addLog('Need trade agreement first', 'action');
      return;
    }
    if (nation.hasMilitaryPact) {
      addLog('Military pact already active', 'action');
      return;
    }
    if (!canAfford(state.resources, ACTION_COSTS.militaryPact)) {
      addLog('Not enough resources', 'action');
      return;
    }
    dispatch({ type: ActionTypes.SIGN_MILITARY_PACT_COSTED, payload: { nationId } });
  };

  return (
    <div className="space-y-2">
      {/* Pre-state warning */}
      {isPreState && (
        <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30 mb-3">
          <div className="flex items-center gap-2 text-amber-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Full diplomacy unlocked after independence</span>
          </div>
        </div>
      )}

      {/* Search — with the whole world in this list (Phase 13), finding one specific nation by
          scrolling alone isn't practical. */}
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

      {/* Nations List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600">
        {sortedNations.map(nation => {
          const nationData = NATIONS_DATA[nation.id];
          const canSeekPeace = nation.isAtWar && nation.hostility <= 60;
          const canTrade = nation.hasPeaceTreaty && !nation.hasTradeAgreement;
          const canPact = nation.hasTradeAgreement && !nation.hasMilitaryPact;
          const war = nation.isAtWar ? activeWarWith(nation.id) : null;

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
              {/* Header */}
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

              {/* Status Badges */}
              <div className="flex flex-wrap gap-1 mb-2">
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
                {war?.goalAchieved && (
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]">
                    ★ War goal achieved
                  </span>
                )}
              </div>

              {/* War goal (Phase 7) — every war now has a concrete objective instead of running
                  until hostility happens to decay enough to seek peace. */}
              {war?.goal && (
                <div className="mb-2 text-[10px] text-slate-400">
                  <span className="text-slate-500">Goal:</span> {describeWarGoal(war.goal)}
                </div>
              )}

              {/* Actions */}
              {!isPreState && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {/* Declare War — two goal choices instead of one undifferentiated action */}
                  {!nation.isAtWar && !nation.hasPeaceTreaty && (
                    <>
                      <button
                        onClick={() => handleDeclareWar(nation.id, 'capture_region')}
                        className="px-2 py-1 text-[10px] bg-red-500/20 hover:bg-red-500/30
                                   text-red-400 rounded transition-colors flex items-center gap-1"
                        title="Cost: 20 DP — war goal: capture a bordering region"
                      >
                        <Crosshair className="w-3 h-3" />
                        War for Territory
                      </button>
                      <button
                        onClick={() => handleDeclareWar(nation.id, 'destroy_military')}
                        className="px-2 py-1 text-[10px] bg-red-500/20 hover:bg-red-500/30
                                   text-red-400 rounded transition-colors flex items-center gap-1"
                        title="Cost: 20 DP — war goal: cripple their military"
                      >
                        <SwordsGoal className="w-3 h-3" />
                        War of Attrition
                      </button>
                    </>
                  )}

                  {/* Seek Peace */}
                  {canSeekPeace && (
                    <button
                      onClick={() => handleSeekPeace(nation.id)}
                      className="px-2 py-1 text-[10px] bg-green-500/20 hover:bg-green-500/30 
                                 text-green-400 rounded transition-colors flex items-center gap-1"
                      title="Cost: $20K, 30 DP, 2 AP"
                    >
                      {/* FIX: Using Flag icon instead of Handshake */}
                      <Flag className="w-3 h-3" />
                      Seek Peace
                    </button>
                  )}

                  {/* Cannot seek peace - too hostile */}
                  {nation.isAtWar && nation.hostility > 60 && (
                    <span className="px-2 py-1 text-[10px] text-slate-500 italic">
                      Too hostile for peace
                    </span>
                  )}

                  {/* Trade Agreement */}
                  {canTrade && (
                    <button
                      onClick={() => handleSignTrade(nation.id)}
                      className="px-2 py-1 text-[10px] bg-blue-500/20 hover:bg-blue-500/30 
                                 text-blue-400 rounded transition-colors flex items-center gap-1"
                      title="Cost: 15 DP, 1 AP | Effect: +$2K/turn"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      Trade (15 DP)
                    </button>
                  )}

                  {/* Military Pact */}
                  {canPact && (
                    <button
                      onClick={() => handleMilitaryPact(nation.id)}
                      className="px-2 py-1 text-[10px] bg-purple-500/20 hover:bg-purple-500/30 
                                 text-purple-400 rounded transition-colors flex items-center gap-1"
                      title="Cost: $50K, 40 DP, 2 AP | Effect: Ally joins wars"
                    >
                      <Shield className="w-3 h-3" />
                      Military Pact
                    </button>
                  )}
                </div>
              )}

              {/* Cost hints */}
              {!isPreState && (canSeekPeace || canTrade || canPact) && (
                <div className="mt-2 pt-2 border-t border-slate-700/50 text-[9px] text-slate-500">
                  {canSeekPeace && <div>Peace: $20K, 30 DP, 2 AP</div>}
                  {canTrade && <div>Trade: 15 DP, 1 AP → +$2K/turn</div>}
                  {canPact && <div>Pact: $50K, 40 DP, 2 AP → Ally in wars</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-3 p-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-red-400 font-bold">
              {sortedNations.filter(n => n.isAtWar).length}
            </div>
            <div className="text-slate-500">At War</div>
          </div>
          <div>
            <div className="text-green-400 font-bold">
              {sortedNations.filter(n => n.hasPeaceTreaty).length}
            </div>
            <div className="text-slate-500">Peace</div>
          </div>
          <div>
            <div className="text-blue-400 font-bold">
              {sortedNations.filter(n => n.hasTradeAgreement).length}
            </div>
            <div className="text-slate-500">Trade</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiplomacyPanel;