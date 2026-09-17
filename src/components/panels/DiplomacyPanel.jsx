// src/components/panels/DiplomacyPanel.jsx
// Diplomacy tab: a browsable relations view of all 240 nations, plus six of the twelve planned
// actions — Declare War (with casus belli), Fabricate Claim, Sue for Peace, Trade Agreement,
// Military Alliance, Gift/Bribe — against src/engine/diplomacy.js's war-goal engine. Resource
// Deal, Demand Tribute, Vassalize/Release, Espionage, Join/Form Coalition and Embassy remain
// deferred as real, separate follow-up work: several of them (Vassalize, Coalitions) fit more
// naturally alongside the AI systems Tasks 23/24 build, and Espionage needs its own progression
// layer per the plan's statecraft section.

import React, { useMemo, useState } from 'react';
import { Search, Swords, Target, HeartHandshake, ShieldCheck, Gift, Flag } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { WORLD_NATIONS } from '../../data/worldNations';
import { ActionTypes } from '../../data/types';
import { ACTION_COSTS, SUE_FOR_PEACE_MIN_GOLD, SUE_FOR_PEACE_BASE_GOLD } from '../../data/actionCosts';
import { hasCasusBelli } from '../../engine/diplomacy';
import { canAfford, formatNumber, getRelationColor } from '../../utils/helpers';

// Diplomacy actions that travel visibly between the player's capital and the target nation's —
// only the ones with a registered EFFECT_REGISTRY entry are listed; Fabricate Claim and Military
// Alliance fall back to the default missile_strike visual rather than getting their own primitive
// for now, since they're rarer clicks than the four below.
const DIPLOMACY_EFFECT_BY_ACTION = {
  [ActionTypes.DECLARE_WAR]: 'declare_war',
  [ActionTypes.SUE_FOR_PEACE]: 'sue_for_peace',
  [ActionTypes.TRADE_AGREEMENT]: 'trade_agreement',
  [ActionTypes.GIFT_BRIBE]: 'gift_bribe'
};

const IconButton = ({ icon: Icon, label, onClick, disabled, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="flex items-center gap-1 px-1.5 py-1 rounded bg-slate-700/80 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-[10px]"
  >
    <Icon size={11} />
    {label}
  </button>
);

const DiplomacyPanel = () => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const [search, setSearch] = useState('');

  const dispatchIfAffordable = (type, nationId, costs) => {
    if (!canAfford(state.resources, costs)) return addLog('Not enough resources', 'action');
    const effectType = DIPLOMACY_EFFECT_BY_ACTION[type];
    if (effectType) triggerEffect(effectType, { from: state.playerNationId, to: nationId });
    dispatch({ type, payload: { nationId } });
  };

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
          const justified = hasCasusBelli(state, state.playerNationId, nation.id);
          const declareWarCosts = justified ? ACTION_COSTS.declareWarJustified : ACTION_COSTS.declareWarUnjustified;
          const sueForPeaceCosts = { gold: Math.max(SUE_FOR_PEACE_MIN_GOLD, Math.round(SUE_FOR_PEACE_BASE_GOLD - (nation.warExhaustion || 0) * 2)), actionPoints: 1 };

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
                  {nation.isAtWar && (
                    <div className="text-slate-400">
                      War Exhaustion: <span className="text-amber-400 font-mono">{nation.warExhaustion || 0}</span>
                    </div>
                  )}
                </div>
              </div>

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
                {state.nations[state.playerNationId]?.claims?.includes(nation.id) && (
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]">
                    ✓ Claim Fabricated
                  </span>
                )}
                {nation.isAtWar && (
                  <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] animate-pulse">
                    ⚔ AT WAR
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {nation.isAtWar ? (
                  <IconButton
                    icon={Flag}
                    label={`Sue for Peace (${sueForPeaceCosts.gold}g)`}
                    title="End the war — cheaper the more war-exhausted they are"
                    disabled={!canAfford(state.resources, sueForPeaceCosts)}
                    onClick={() => dispatchIfAffordable(ActionTypes.SUE_FOR_PEACE, nation.id, sueForPeaceCosts)}
                  />
                ) : (
                  <>
                    <IconButton
                      icon={Swords}
                      label={justified ? 'Declare War' : 'Declare War (unjustified)'}
                      title={justified ? 'A casus belli justifies this war' : 'No casus belli — costs more and hurts relations'}
                      disabled={!canAfford(state.resources, declareWarCosts)}
                      onClick={() => dispatchIfAffordable(ActionTypes.DECLARE_WAR, nation.id, declareWarCosts)}
                    />
                    {!state.nations[state.playerNationId]?.claims?.includes(nation.id) && (
                      <IconButton
                        icon={Target}
                        label="Fabricate Claim"
                        title="Manufacture a casus belli for a future war"
                        disabled={!canAfford(state.resources, ACTION_COSTS.fabricateClaim)}
                        onClick={() => dispatchIfAffordable(ActionTypes.FABRICATE_CLAIM, nation.id, ACTION_COSTS.fabricateClaim)}
                      />
                    )}
                    {!nation.hasTradeAgreement && (
                      <IconButton
                        icon={HeartHandshake}
                        label="Trade Agreement"
                        disabled={!canAfford(state.resources, ACTION_COSTS.tradeAgreement)}
                        onClick={() => dispatchIfAffordable(ActionTypes.TRADE_AGREEMENT, nation.id, ACTION_COSTS.tradeAgreement)}
                      />
                    )}
                    {!nation.hasMilitaryPact && (
                      <IconButton
                        icon={ShieldCheck}
                        label="Alliance"
                        title="Requires calm relations or an existing trade agreement"
                        disabled={!canAfford(state.resources, ACTION_COSTS.militaryAlliance)}
                        onClick={() => dispatchIfAffordable(ActionTypes.MILITARY_ALLIANCE, nation.id, ACTION_COSTS.militaryAlliance)}
                      />
                    )}
                    <IconButton
                      icon={Gift}
                      label="Gift"
                      title="Reduces hostility"
                      disabled={!canAfford(state.resources, ACTION_COSTS.giftBribe)}
                      onClick={() => dispatchIfAffordable(ActionTypes.GIFT_BRIBE, nation.id, ACTION_COSTS.giftBribe)}
                    />
                  </>
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
    </div>
  );
};

export default DiplomacyPanel;
