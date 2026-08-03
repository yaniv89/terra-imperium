// src/components/panels/DiplomacyPanel.jsx
// Diplomacy panel - relations with other nations

import React, { useMemo } from 'react';
// FIX: Replaced 'Handshake' with 'Flag' to resolve the export error
import { Flag, Skull, ShoppingCart, Shield, AlertTriangle } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { GamePhases, ActionTypes } from '../../data/types';
import { NATIONS_DATA } from '../../data/nations';
import { canAfford, formatNumber, getRelationColor } from '../../utils/helpers';
import { ACTION_COSTS } from '../../data/actionCosts';

const DiplomacyPanel = () => {
  const { state, dispatch, addLog } = useGame();
  
  const isPreState = state.phase === GamePhases.PRE_STATE;

  // Sort nations: at war first, then by hostility
  const sortedNations = useMemo(() => {
    return Object.values(state.nations)
      .filter(n => !n.isPlayer)
      .sort((a, b) => {
        if (a.isAtWar !== b.isAtWar) return a.isAtWar ? -1 : 1;
        return b.hostility - a.hostility;
      });
  }, [state.nations]);

  // Declare War
  const handleDeclareWar = (nationId) => {
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
    dispatch({ type: ActionTypes.DECLARE_WAR_COSTED, payload: { nationId } });
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

      {/* Nations List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600">
        {sortedNations.map(nation => {
          const nationData = NATIONS_DATA[nation.id];
          const canSeekPeace = nation.isAtWar && nation.hostility <= 60;
          const canTrade = nation.hasPeaceTreaty && !nation.hasTradeAgreement;
          const canPact = nation.hasTradeAgreement && !nation.hasMilitaryPact;

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
                  <div 
                    className="text-xs font-medium mt-0.5"
                    style={{ color: getRelationColor(nation.relationStatus) }}
                  >
                    {nation.relationStatus}
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
              </div>

              {/* Actions */}
              {!isPreState && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {/* Declare War */}
                  {!nation.isAtWar && !nation.hasPeaceTreaty && (
                    <button
                      onClick={() => handleDeclareWar(nation.id)}
                      className="px-2 py-1 text-[10px] bg-red-500/20 hover:bg-red-500/30 
                                 text-red-400 rounded transition-colors flex items-center gap-1"
                      title="Cost: 20 DP"
                    >
                      <Skull className="w-3 h-3" />
                      Declare War
                    </button>
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